// Junta index.html + core.js + parser.js + app.js en un solo archivo que abre con doble clic.
// Uso: node ritmo/herramientas/empaquetar.mjs   →   ritmo/dist/ritmo.html
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

// Ritmo Belleza
let bel = readFileSync(join(raiz, 'belleza', 'index.html'), 'utf8');
bel = bel.replace('<script src="core.js"></script>', () => `<script>\n${readFileSync(join(proto, 'core.js'), 'utf8')}</script>`)
  .replace('<script src="sincronizacion.js"></script>', () => `<script>\n${readFileSync(join(raiz, 'belleza', 'sincronizacion.js'), 'utf8')}</script>`)
  .replace('<script src="belleza.js"></script>', () => `<script>\n${readFileSync(join(raiz, 'belleza', 'belleza.js'), 'utf8')}</script>`);
// El documento de un solo archivo también conserva las fotos sin conexión.
bel = bel.replace(/\.\/trabajos\/[a-z0-9-]+\.jpg/g, recurso =>
  'data:image/jpeg;base64,' + readFileSync(join(raiz, 'belleza', recurso)).toString('base64'));
writeFileSync(join(raiz, 'dist', 'belleza.html'), pagina.replace(html, () => bel));
console.log('Listo: ritmo/dist/belleza.html');

// Publicación PWA: documento completo, recursos locales y caché versionada por contenido.
const fuente = join(raiz, 'belleza'), pwa = join(raiz, 'dist', 'pwa');
mkdirSync(pwa, { recursive: true });
for (const recurso of ['belleza.js', 'sincronizacion.js', 'pwa.js', 'manifest.webmanifest', 'iconos', 'fuentes', 'trabajos']) {
  cpSync(join(fuente, recurso), join(pwa, recurso), { recursive: true });
}
cpSync(join(proto, 'core.js'), join(pwa, 'core.js'));
let cuerpo = readFileSync(join(fuente, 'index.html'), 'utf8')
  .replace(/<link[^>]+https:\/\/fonts\.[^>]+>\s*/g, '');
const metadatos = `<link rel="manifest" href="./manifest.webmanifest">
<meta name="theme-color" content="#F2F2F7">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Ritmo Belleza">
<link rel="apple-touch-icon" href="./iconos/icono-180.png">
<link rel="icon" href="./iconos/icono-192.png">
<link rel="stylesheet" href="./fuentes/fuentes.css">`;
const documento = pagina.replace('<head>', '<head>' + metadatos).replace(html, () => cuerpo + '\n<script src="pwa.js"></script>');
writeFileSync(join(pwa, 'index.html'), documento);
function archivos(dir, prefijo = './') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? archivos(join(dir, e.name), prefijo + e.name + '/') : e.name === 'sw.js' ? [] : [prefijo + e.name]);
}
const recursos = archivos(pwa).sort();
const hash = createHash('sha256');
for (const recurso of recursos) hash.update(recurso).update(readFileSync(join(pwa, recurso)));
const worker = readFileSync(join(fuente, 'sw.js'), 'utf8');
hash.update(worker);
writeFileSync(join(pwa, 'sw.js'), worker.replace('__VERSION__', hash.digest('hex').slice(0, 16))
  .replace('__ASSETS__', JSON.stringify(['./', ...recursos])));
console.log('Listo: ritmo/dist/pwa/');
