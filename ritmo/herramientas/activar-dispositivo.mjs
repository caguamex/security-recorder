// Uso privado del operador: emite un enlace de un solo uso; nunca imprime su contenido.
// node ritmo/herramientas/activar-dispositivo.mjs --secretos <archivo privado> --salida <archivo privado nuevo>
import { readFile, open, unlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2), get = name => args[args.indexOf(name) + 1];
try {
  if (!args.includes('--secretos') || !args.includes('--salida')) throw new Error('Indica --secretos y --salida con rutas privadas absolutas.');
  const origen = get('--secretos'), destino = get('--salida');
  if (!origen || !destino || !isAbsolute(origen) || !isAbsolute(destino)) throw new Error('Las rutas privadas deben ser absolutas.');
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  const dentro = path => { const rel = relative(repo, resolve(path)); return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel)); };
  if (dentro(origen) || dentro(destino)) throw new Error('Guarda secretos y enlaces fuera del repositorio.');
  const config = JSON.parse(await readFile(origen, 'utf8'));
  if (typeof config.APP_TOKEN !== 'string' || config.APP_TOKEN.length < 32) throw new Error('Falta la clave privada del operador.');
  const base = new URL(config.PUBLIC_URL || 'https://ritmo-belleza.antonio-t-22.workers.dev');
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Se requiere el origen HTTPS de Agendappx.');
  // No sobrescribe archivos; no imprime una respuesta que pueda contener credenciales.
  const archivo = await open(destino, 'wx', 0o600);
  let completo = false;
  try {
    const response = await fetch(new URL('/api/dispositivos/enlaces', base), {
      method:'POST', redirect:'error', cache:'no-store', signal:AbortSignal.timeout(15000),
      headers:{Authorization:'Bearer '+config.APP_TOKEN,'Content-Type':'application/json'},body:'{}'
    });
    if (!response.ok) throw new Error('No se pudo crear el enlace privado. Comprueba que la corrección esté publicada.');
    const result = await response.json();
    const url = new URL(result.activacionUrl);
    if (url.origin !== base.origin || !/^#activar-dispositivo=[a-f0-9]{64}$/.test(url.hash)) throw new Error('El servidor devolvió un enlace inesperado.');
    await archivo.writeFile(JSON.stringify({ activacionUrl:url.href,vence:result.vence,
      indicacion:'En el celular donde usas Agendappx: Ajustes → Apple Calendar → Activar sincronización. Pega este enlace privado y confirma. No compartir: permite acceder a la agenda.' },null,2), 'utf8');
    completo = true;
  } finally { await archivo.close(); if (!completo) await unlink(destino); }
  console.log('Enlace de un solo uso guardado en el archivo privado. Caduca en 15 minutos.');
} catch { console.error('No se pudo preparar la activación. Revisa las rutas privadas, el acceso del operador y la versión publicada. No se mostraron claves.'); process.exitCode=1; }
