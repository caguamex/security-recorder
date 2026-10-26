// Dos versiones servidas en localhost: no despliega ni modifica la base publicada.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estatico } from '../../herramientas/estatico.mjs';
const temporal = await mkdtemp(join(tmpdir(), 'ritmo-actualizacion-'));
const fuente = fileURLToPath(new URL('../../dist/pwa/', import.meta.url));
const destino = process.env.ACTUALIZACION_CAPTURAS || fileURLToPath(new URL('../../imagenes/', import.meta.url));
await mkdir(destino,{recursive:true});
for (const version of ['uno','dos','incompleta']) {
 const dir=join(temporal,version); await cp(fuente,dir,{recursive:true});
 const sw=await readFile(join(dir,'sw.js'),'utf8');
 await writeFile(join(dir,'sw.js'),sw.replace(/const CACHE = '[^']+';/,`const CACHE = 'ritmo-belleza-prueba-${version}';`)+(version==='incompleta'?"\nself.addEventListener('install', event => event.waitUntil(fetch('./no-existe.js').then(r=>{if(!r.ok)throw new Error('Recurso incompleto');})));":''));
 await writeFile(join(dir,'pwa.js'),(await readFile(join(dir,'pwa.js'),'utf8'))+`\nwindow.VERSION_PRUEBA='${version}';`);
}
let actual=join(temporal,'uno');
const server=createServer((req,res)=>void estatico(req,res,actual));
server.listen(0,'127.0.0.1'); await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
let context;
const tab=(p,name)=>p.locator('#tabbar').getByRole('tab',{name,exact:true});
try {
 context=await browser.newContext({viewport:{width:390,height:844}});
 const a=await context.newPage(), errors=[]; a.on('pageerror',e=>errors.push(e.message));
 await a.goto(base); await a.waitForFunction(()=>navigator.serviceWorker.controller);
 assert.equal(await a.locator('#pwa-update').isHidden(),true,'No avisar al instalar por primera vez');
 await tab(a,'Clientas').click(); await a.getByRole('button',{name:'Nueva clienta',exact:true}).click();
 await a.locator('#k-nombre').fill('Guardada antes de actualizar');
 await a.getByRole('button',{name:'Guardar',exact:true}).click();
 const copia=await a.evaluate(()=>localStorage.getItem('belleza.v1.sync'));
 assert.ok(JSON.parse(copia).pending.length>0);
 // Una descarga incompleta no cambia la versión ni ofrece activar recursos incompletos.
 actual=join(temporal,'incompleta');
 await a.evaluate(async()=>{const r=await navigator.serviceWorker.ready;await r.update();await new Promise(resolve=>{const w=r.installing;if(!w||w.state==='redundant')return resolve();w.addEventListener('statechange',()=>{if(w.state==='redundant')resolve();});});});
 assert.equal(await a.locator('#pwa-update').isHidden(),true);
 assert.equal(await a.evaluate(()=>window.VERSION_PRUEBA),'uno');
 actual=join(temporal,'dos');
 await a.evaluate(async()=>{const r=await navigator.serviceWorker.ready;await r.update();});
 await a.getByText('Hay una nueva versión disponible.',{exact:true}).waitFor();
 assert.equal(await a.evaluate(()=>window.VERSION_PRUEBA),'uno');
 await a.screenshot({path:join(destino,'pwa-nueva-version.png')});
 // Más tarde permite seguir trabajando. Reabrir la página vuelve a ofrecer la versión pendiente.
 await a.getByRole('button',{name:'Más tarde',exact:true}).click();
 assert.equal(await a.locator('#pwa-update').isHidden(),true);
 await a.reload(); await a.getByText('Hay una nueva versión disponible.',{exact:true}).waitFor();
 assert.equal(await a.evaluate(()=>window.VERSION_PRUEBA),'uno');
 // La segunda pestaña tiene un formulario propio que no debe perderse por actualizar la primera.
 const b=await context.newPage(); await b.goto(base);
 await tab(b,'Servicios').click(); await b.getByRole('button',{name:'Nuevo servicio',exact:true}).click();
 await b.locator('#s-nombre').fill('Borrador en la otra pestaña');
 await tab(a,'Clientas').click(); await a.getByRole('button',{name:'Nueva clienta',exact:true}).click();
 await a.locator('#k-nombre').fill('Borrador que conservar');
 const dialog=a.waitForEvent('dialog'); const clicA=a.getByRole('button',{name:'Actualizar ahora',exact:true}).click();
 const warning=await dialog; assert.match(warning.message(),/cambios sin guardar/); await warning.dismiss(); await clicA;
 assert.equal(await a.locator('#k-nombre').inputValue(),'Borrador que conservar');
 assert.equal(await a.evaluate(()=>window.VERSION_PRUEBA),'uno');
 await a.getByRole('button',{name:'Cancelar',exact:true}).click();
 await context.setOffline(true);
 // La nueva versión ya está completa en caché: actualizar conserva la cola local aun sin conexión.
 await Promise.all([a.waitForEvent('load'),a.getByRole('button',{name:'Actualizar ahora',exact:true}).click()]);
 await a.waitForFunction(()=>window.VERSION_PRUEBA==='dos');
 assert.equal(await a.evaluate(()=>localStorage.getItem('belleza.v1.sync')),copia);
 assert.equal(await a.locator('#pwa-update').isHidden(),true);
 assert.equal(await b.locator('#s-nombre').inputValue(),'Borrador en la otra pestaña');
 assert.equal(await b.evaluate(()=>window.VERSION_PRUEBA),'uno');
 await b.getByText('Hay una nueva versión disponible.',{exact:true}).waitFor();
 // Aceptar la advertencia descarta solo ese borrador y recarga una sola vez.
 let cargas=0; b.on('load',()=>cargas++);
 const dialogB=b.waitForEvent('dialog'); const clicB=b.getByRole('button',{name:'Actualizar ahora',exact:true}).click();
 const confirmacion=await dialogB;
 await Promise.all([b.waitForEvent('load'),confirmacion.accept(),clicB]);
 await b.waitForFunction(()=>window.VERSION_PRUEBA==='dos');
 assert.equal(cargas,1);
 assert.equal(await b.evaluate(()=>localStorage.getItem('belleza.v1.sync')),copia);
 // El aviso no desborda en tamaños de teléfono, tablet y computadora.
 await context.setOffline(false);
 actual=join(temporal,'uno'); await a.evaluate(async()=>{const r=await navigator.serviceWorker.ready;await r.update();});
 await a.getByText('Hay una nueva versión disponible.',{exact:true}).waitFor();
 for(const width of [390,768,1440]) {
  await a.setViewportSize({width,height:900});
  assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const box=await a.locator('#pwa-update').boundingBox(), nav=await a.locator('#tabbar').boundingBox();
  assert.ok(box.y+box.height<=nav.y,'El aviso queda por encima de la navegación');
 }
 assert.deepEqual(errors,[]);
 console.log('Actualización: primera instalación sin aviso, descarga fallida, versión pendiente, Más tarde, advertencia/cancelación de borrador, actualización sin internet, cola local intacta, otra pestaña protegida y tamaños 390/768/1440 verificados.');
} finally {
 await context?.close(); await browser.close();
 await new Promise(r=>server.close(r));
 const ruta=resolve(temporal);
 if(dirname(ruta)!==resolve(tmpdir())||!basename(ruta).startsWith('ritmo-actualizacion-'))throw new Error('Ruta temporal fuera del destino esperado');
 await rm(ruta,{recursive:true,force:true});
}
