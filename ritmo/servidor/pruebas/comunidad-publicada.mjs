// Solo archivos públicos y estado local en un navegador aislado. No solicita APIs privadas.
import {chromium,webkit} from 'playwright';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const engine=existsSync(webkit.executablePath())?webkit:chromium;
const browser=await engine.launch({headless:true,...(engine===chromium?{channel:process.env.BROWSER_CHANNEL||'msedge'}:{})});
try{
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'es-MX',timezoneId:'America/Mexico_City'}),p=await c.newPage(),errores=[],api=[];
 p.on('pageerror',e=>errores.push(e.message));p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
 await p.goto('https://ritmo-belleza.antonio-t-22.workers.dev/comunidad/');await p.getByRole('heading',{name:'Descubre cerca de ti'}).waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForFunction(()=>[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0;}).every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.locator('#buscar').fill('UÑA');await p.waitForURL('**/#buscar');assert.equal(await p.locator('.tile').count(),1);await p.locator('.tile [data-guardar]').click();
 await p.locator('#nav-movil a[href="#guardados"]').click();await p.waitForURL('**/#guardados');assert.equal(await p.locator('.tile').count(),1);await p.reload();assert.equal(await p.locator('.tile').count(),1);
 await p.locator('.tile [data-reservar]').click();const fecha=await p.locator('#reserva-fecha option').nth(1).getAttribute('value');await p.locator('#reserva-fecha').selectOption(fecha);await p.locator('[data-hora="10:00"]').click();await p.locator('#reservar').click();await p.getByText('Esta reserva no se envió al negocio ni se agregó a su agenda.').waitFor();await p.getByRole('button',{name:'Ver mis citas de prueba'}).click();await p.locator('.booking').waitFor();
 await p.locator('#nav-movil [data-accion="publicar"]').click();await p.locator('#publicar-titulo').fill('Trabajo de prueba aislada');await p.locator('#publicar-texto').fill('Foto de prueba, sin envío ni agenda real.');await p.locator('#publicar-foto').setInputFiles(fileURLToPath(new URL('../../comunidad/assets/cejas.jpg',import.meta.url)));await p.waitForFunction(()=>{const e=document.querySelector('#foto-preview');return e&&!e.hidden;});await p.locator('#publicar-consentimiento').check();await p.locator('#publicar-guardar').click();await p.waitForURL('**/#inicio');await p.getByRole('heading',{name:'Trabajo de prueba aislada'}).waitFor();
 // Comprobar convivencia con el service worker de la agenda, sin abrir sesiones reales.
 await p.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;});await p.reload();await p.getByRole('heading',{name:'Descubre cerca de ti'}).waitFor();
 assert.deepEqual(api,[]);assert.deepEqual(errores,[]);await p.screenshot({path:fileURLToPath(new URL('../../imagenes/comunidad/publicada-iphone.png',import.meta.url)),fullPage:false});
 console.log('Comunidad publicada: motor '+(engine===webkit?'WebKit':'Chromium móvil')+', 390px, fotos, búsqueda, guardados al recargar, foto propia, reserva local y convivencia con service worker correctos. Cero llamadas a APIs. Prueba física de Safari pendiente del usuario.');await c.close();
}finally{await browser.close();}
