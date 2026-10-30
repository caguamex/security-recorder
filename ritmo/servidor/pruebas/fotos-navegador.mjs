// Fotos reales de referencia, dos navegadores aislados y PostgreSQL local; sin escrituras en producción.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { entorno } from './entorno.mjs';
const env = await entorno();
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
const errores = [], contexts = [];
const destino = process.env.FOTOS_CAPTURAS || fileURLToPath(new URL('../../imagenes/', import.meta.url));
await mkdir(destino, { recursive: true });
const fotoA = fileURLToPath(new URL('../../belleza/trabajos/lifting-cejas.jpg', import.meta.url));
const fotoB = fileURLToPath(new URL('../../belleza/trabajos/extensiones-1.jpg', import.meta.url));
const tab = (page, name) => page.locator('#tabbar').getByRole('tab', { name, exact: true });
async function abrir() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); contexts.push(ctx);
  const p = await ctx.newPage(); p.on('pageerror', e => errores.push(e.message));
  await p.goto(env.base); await p.waitForFunction(() => navigator.serviceWorker.controller);
  await tab(p, 'Negocio').click(); await p.getByRole('button', { name: /Sincronización/ }).click();
  await p.getByText('Configuración avanzada', { exact: true }).click(); await p.getByLabel('Token de acceso', { exact: true }).fill(env.token);
  await p.getByRole('button', { name: 'Conectar', exact: true }).click();
  await p.waitForFunction(() => document.querySelector('#sync-status')?.textContent.includes('Sincronizado'));
  await p.getByRole('button', { name: 'Listo', exact: true }).click();
  await tab(p, 'Servicios').click(); return p;
}
async function sync(p) {
  await tab(p, 'Negocio').click(); await p.getByRole('button', { name: /Sincronización/ }).click();
  await p.getByRole('button', { name: 'Sincronizar ahora', exact: true }).click();
  await p.waitForFunction(() => document.querySelector('#sync-status')?.textContent.includes('Sincronizado'));
  await p.getByRole('button', { name: 'Listo', exact: true }).click(); await tab(p, 'Servicios').click();
}
async function subir(p, path) {
  await p.locator('#s-foto').setInputFiles(path);
  await p.getByText('Foto lista. Toca Guardar para conservarla.', { exact: true }).waitFor();
  assert.equal(await p.locator('#s-foto-preview').evaluate(el => el.complete && el.naturalWidth > 0), true);
  return p.locator('#s-foto-preview').getAttribute('src');
}
async function put(data, version=0) {
  const r=await fetch(env.base+'/api/objetos/'+data.id,{method:'PUT',headers:{Authorization:'Bearer '+env.token,'Content-Type':'application/json'},body:JSON.stringify({data,baseVersion:version,mutationId:randomUUID()})});
  return {status:r.status,body:await r.json()};
}
try {
  const a = await abrir();
  await a.getByRole('button', { name: 'Nuevo servicio', exact: true }).click();
  await a.locator('#s-nombre').fill('Diseño de cejas'); await a.locator('#s-cat').selectOption('Cejas');
  await a.locator('#s-precio').fill('250');
  const primera = await subir(a, fotoA); assert.ok(primera.length <= 48000);
  await a.screenshot({path:destino+'/servicio-subir-foto.png'});
  await a.getByRole('button', { name: 'Guardar', exact: true }).click(); await sync(a);
  await a.screenshot({path:destino+'/servicio-con-foto.png'});
  const registros = (await env.repo.snapshot()).records.filter(r => r.data?.kind === 'servicio');
  assert.equal(registros.length, 1); assert.equal(registros[0].data.foto, primera);
  const id = registros[0].id;
  assert.equal(await a.locator('.trabajo-fondo').getAttribute('src'), primera);
  const b = await abrir(); assert.equal(await b.locator('.trabajo-mini').getAttribute('src'), primera);
  // Abrir el selector desde el botón visible también funciona.
  await a.locator('[data-servicio]').click();
  const chooser = a.waitForEvent('filechooser'); await a.getByRole('button', {name:'Cambiar foto',exact:true}).click();
  await (await chooser).setFiles(fotoB);
  await a.getByText('Foto lista. Toca Guardar para conservarla.', {exact:true}).waitFor();
  await a.getByRole('button', {name:'Cancelar',exact:true}).click();
  assert.equal(await a.locator('.trabajo-mini').getAttribute('src'), primera);
  // Un archivo inválido conserva la foto anterior y permite corregirlo.
  await a.locator('[data-servicio]').click();
  await a.locator('#s-foto').setInputFiles({name:'archivo.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
  await a.getByText('Elige una foto JPG, PNG o WebP.', {exact:true}).waitFor();
  assert.equal(await a.locator('#s-foto-preview').getAttribute('src'), primera);
  await a.locator('#s-foto').setInputFiles({name:'imagen-rota.jpg',mimeType:'image/jpeg',buffer:Buffer.from('no es una foto')});
  await a.getByText(/No se pudo abrir la foto/).waitFor();
  assert.equal(await a.locator('#s-foto-preview').getAttribute('src'), primera);
  await a.context().setOffline(true);
  const segunda = await subir(a, fotoB); assert.notEqual(segunda, primera);
  await a.getByRole('button', {name:'Guardar',exact:true}).click(); await a.reload(); await tab(a,'Servicios').click();
  assert.equal(await a.locator('.trabajo-mini').getAttribute('src'), segunda);
  await a.context().setOffline(false); await sync(a); await sync(b);
  assert.equal(await b.locator('.trabajo-fondo').getAttribute('src'), segunda);
  await b.getByRole('button',{name:'Ver fotos de Diseño de cejas',exact:true}).click();
  assert.equal(await b.locator('.trabajo-galeria img').getAttribute('src'), segunda);
  await b.getByRole('button',{name:'Listo',exact:true}).click();
  await b.locator('[data-servicio]').click(); await b.getByRole('button',{name:'Quitar foto',exact:true}).click();
  await b.getByRole('button',{name:'Guardar',exact:true}).click(); await sync(b); await sync(a);
  assert.equal(await a.locator('.trabajo-mini').count(),0); assert.equal(await a.locator('.trabajo-fondo').count(),0);
  assert.equal((await env.repo.snapshot()).records.find(r=>r.id===id).data.foto,null);
  // La API no permite URLs externas, SVG, fotos enormes ni JPEG mal formado.
  for(const foto of ['https://externo.example/foto.jpg','data:image/svg+xml;base64,PHN2Zy8+','data:image/jpeg;base64,/9j/AAAA','data:image/jpeg;base64,/9j/'+'A'.repeat(48000)]) {
    assert.equal((await put({id:'foto-invalida',kind:'servicio',nombre:'Servicio',precio:100,duracion:60,foto})).status,400);
  }
  assert.equal((await put({id:'foto-clienta',kind:'clienta',nombre:'Clienta',foto:primera})).status,400);
  assert.equal(await a.locator('[data-servicio]').count(),1);
  for (const width of [390,768,1440]) { await a.setViewportSize({width,height:900}); assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true); }
  assert.deepEqual(errores,[]);
  console.log('Fotos: carga, reducción, tarjeta, vista completa, cancelación, archivo inválido, recarga sin internet, sincronización entre dos dispositivos, eliminación y validación de API verificadas.');
} finally { for(const c of contexts) await c.close(); await browser.close(); await env.cerrar(); }
