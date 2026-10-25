// Junta index.html + core.js + parser.js + app.js en un solo archivo que abre con doble clic.
// Uso: node ritmo/herramientas/empaquetar.mjs   →   ritmo/dist/ritmo.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const proto = join(raiz, 'prototipo');
let html = readFileSync(join(proto, 'index.html'), 'utf8');
for (const archivo of ['core.js', 'parser.js', 'app.js']) {
  const js = readFileSync(join(proto, archivo), 'utf8');
  if (js.includes('</script')) throw new Error(`${archivo} contiene </script>`);
  html = html.replace(`<script src="${archivo}"></script>`, () => `<script>\n${js}</script>`);
}
// El mismo esqueleto mínimo que usa Claude al publicar la página.
const pagina = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px/1.4 system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>
${html}
</body></html>
`;
mkdirSync(join(raiz, 'dist'), { recursive: true });
writeFileSync(join(raiz, 'dist', 'ritmo.html'), pagina);
console.log('Listo: ritmo/dist/ritmo.html (' + Math.round(pagina.length / 1024) + ' KB)');
