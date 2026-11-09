// Regresión de Cloudflare Assets: /index.html redirige a / antes de entrar en caché.
// Solo localhost, almacenamiento de prueba y ninguna llamada a cuentas reales.
import {chromium, webkit} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp, cp, readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {estatico} from '../../herramientas/estatico.mjs';

const temp = await mkdtemp(join(tmpdir(), 'agendappx-safari-'));
const vieja = join(temp, 'vieja'), nueva = join(temp, 'nueva');
await mkdir(join(vieja, 'comunidad'), {recursive:true});
await mkdir(join(vieja, 'planes'), {recursive:true});
await cp(fileURLToPath(new URL('../../dist/pwa/', import.meta.url)), nueva, {recursive:true});
await writeFile(join(vieja, 'index.html'), '<!doctype html><html lang="es"><h1>Versión anterior</h1><script src="/arranque-prueba.js"></script></html>');
await writeFile(join(vieja, 'arranque-prueba.js'), "navigator.serviceWorker.register('/sw.js');");
await writeFile(join(vieja, 'comunidad/index.html'), '<h1>Comunidad anterior</h1>');
await writeFile(join(vieja, 'planes/index.html'), '<h1>Planes anteriores</h1>');
// Es el comportamiento publicado antes de la reparación, sin normalizar Response.redirected.
await writeFile(join(vieja, 'sw.js'), `
const CACHE='ritmo-belleza-safari-anterior';
const ASSETS=['./','./index.html','./comunidad/index.html','./planes/index.html','./arranque-prueba.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{if(event.data?.tipo==='RITMO_ACTUALIZAR'&&event.source?.type==='window'&&new URL(event.source.url).origin===self.location.origin)event.waitUntil(self.skipWaiting());});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 let recurso=url.pathname.replace(new URL(self.registration.scope).pathname,'./');
 if(recurso.endsWith('/'))recurso+='index.html';
 if(['./comunidad','./planes'].includes(recurso))recurso+='/index.html';
 if(event.request.mode==='navigate'&&/^\\.\\/[a-z0-9][a-z0-9-]{2,59}\\/?$/.test(recurso)&&!['./api','./salud','./webhooks','./calendario'].includes(recurso))recurso='./comunidad/index.html';
 if(!ASSETS.includes(recurso))return;
 event.respondWith(caches.match(new URL(recurso,self.registration.scope).href,{ignoreSearch:true}).then(c=>c||fetch(event.request)));
});`);

let actual = vieja;
const accesos = [];
const server = createServer((req,res) => {
 const path = new URL(req.url, 'http://localhost').pathname;
 accesos.push(path);
 if (path.endsWith('/index.html')) {
  res.writeHead(301, {Location:path.slice(0, -10), 'Cache-Control':'no-store'}).end();
  return;
 }
 if (path.startsWith('/api/')) {
  res.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify(path === '/api/cuentas/config' ? {habilitado:false} : path.includes('/explorar') ? {negocios:[],trabajos:[]} : {}));
  return;
 }
 if (path === '/ab-beauty-room') req.url = '/comunidad/';
 void estatico(req,res,actual);
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const motor = process.env.SAFARI_PRUEBA === 'webkit' ? webkit : chromium;
let browser;
try {
 browser = await motor.launch({headless:true,...(motor===chromium?{channel:'msedge'}:{})});
 const context = await browser.newContext({viewport:{width:390,height:844}});
 await context.route('https://**', r => r.abort());
 let p = await context.newPage();
 await p.goto(base+'/');
 await p.waitForFunction(() => navigator.serviceWorker.controller);
 assert.equal(await p.evaluate(async()=> (await caches.match('/index.html')).redirected), true, 'El escenario debe contener la redirección real guardada');
 const pendiente = JSON.stringify({pending:[{id:'sin-sincronizar',foto:'datos-de-prueba'}]});
 await p.evaluate(async valor => {
  localStorage.setItem('belleza.v1.sync', valor);
  localStorage.setItem('prueba-sesion', 'sesion-conservada');
  document.cookie='prueba_sesion=conservada; path=/; SameSite=Lax';
  await new Promise((resolve,reject)=>{
   const r=indexedDB.open('prueba-fotos',1);
   r.onupgradeneeded=()=>r.result.createObjectStore('fotos');
   r.onerror=()=>reject(r.error);
   r.onsuccess=()=>{const db=r.result,t=db.transaction('fotos','readwrite');t.objectStore('fotos').put(new Uint8Array([1,2,3]),'pendiente');t.oncomplete=()=>{db.close();resolve();};};
  });
 }, pendiente);
 let rechazoAnterior = false;
 try {await p.goto(base+'/', {waitUntil:'domcontentloaded',timeout:15000});}
 catch {rechazoAnterior = true;}
 if (motor === webkit) assert.equal(rechazoAnterior, true, 'WebKit debe reproducir el rechazo de la versión anterior');
 // Abrir el enlace desde el chat crea otra pestaña y evita la navegación de error
 // pendiente de Chromium. La sesión y el SW anterior siguen en el mismo contexto.
 await p.close(); p = await context.newPage();
 actual = nueva;
 // El enlace con / final atraviesa el SW antiguo y llega a la reparación por red.
 const respuesta = await p.goto(base+'/recuperar-acceso/');
 assert.equal(respuesta.status(), 200);
 assert.equal(respuesta.request().redirectedFrom(), null);
 await p.getByRole('heading', {name:'Vuelve a tu agenda'}).waitFor();
 for (const width of [320,390,768]) {
  await p.setViewportSize({width,height:844});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), true);
 }
 await p.setViewportSize({width:390,height:844});
 if (process.env.SAFARI_CAPTURA) await p.screenshot({path:process.env.SAFARI_CAPTURA});
 await Promise.all([p.waitForURL(base+'/', {timeout:60000}), p.getByRole('button',{name:'Reparar y abrir Agendappx'}).click()]);
 await p.locator('#tabbar').waitFor();
 assert.equal(await p.evaluate(()=>localStorage.getItem('belleza.v1.sync')), pendiente);
 assert.equal(await p.evaluate(()=>localStorage.getItem('prueba-sesion')), 'sesion-conservada');
 assert.match(await p.evaluate(()=>document.cookie), /prueba_sesion=conservada/);
 assert.deepEqual(await p.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('prueba-fotos',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('fotos').objectStore('fotos').get('pendiente');t.onsuccess=()=>{db.close();resolve(Array.from(t.result));};};})), [1,2,3]);
 // Las tres páginas cacheadas mantienen encabezados, HTML y no propagan la redirección.
 for (const path of ['/', '/comunidad/', '/planes/', '/ab-beauty-room']) {
  await p.goto(base+path);
  const resultado=await p.evaluate(async()=>{const r=await fetch(location.pathname,{redirect:'manual'});return {ok:r.ok,redirected:r.redirected,tipo:r.headers.get('content-type'),csp:r.headers.get('content-security-policy'),html:await r.text()};});
  assert.equal(resultado.ok, true, path);
  assert.equal(resultado.redirected, false, path);
  assert.match(resultado.tipo, /text\/html/);
  assert.match(resultado.csp, /default-src 'self'/);
  assert.match(resultado.html, /Agendappx/);
 }
 const nuevoCache = await p.evaluate(async()=> (await caches.keys()).find(k=>k.startsWith('ritmo-belleza-')));
 assert.notEqual(nuevoCache, 'ritmo-belleza-safari-anterior');
 await context.setOffline(true);
 for (const path of ['/', '/comunidad/', '/planes/', '/ab-beauty-room']) {
  await p.goto(base+path);
  assert.match(await p.title(), /Agendappx/);
 }
 await context.setOffline(false);
 // Sin actualización pendiente, el botón sigue abriendo la agenda sin borrar nada.
 await p.goto(base+'/recuperar-acceso/');
 await Promise.all([p.waitForURL(base+'/'), p.getByRole('button',{name:'Reparar y abrir Agendappx'}).click()]);
 assert.equal(await p.evaluate(()=>localStorage.getItem('prueba-sesion')), 'sesion-conservada');
 assert.ok(accesos.includes('/recuperar-acceso/'));
 await context.close();
 console.log(`${motor===webkit?'WebKit':'Chromium'}: redirecciones reales, recuperación con SW anterior, sesión/cookies/cola/fotos intactas, agenda/directorio/planes/perfil sin redirección y sin conexión, tamaños 320/390/768 y segundo intento verificados.`);
} finally {
 await browser?.close(); server.closeAllConnections(); server.close(); await once(server,'close');
 if (!resolve(temp).startsWith(resolve(tmpdir())+sep)) throw new Error('Temporal fuera del directorio permitido');
 await rm(temp, {recursive:true,force:true});
}
