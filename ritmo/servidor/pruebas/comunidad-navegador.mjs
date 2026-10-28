// Prueba aislada: únicamente servidor local, ninguna cuenta ni servicio externo.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../../',import.meta.url)),carpeta=new URL('../../imagenes/comunidad/',import.meta.url);await mkdir(carpeta,{recursive:true});
const server=spawn(process.execPath,['ritmo/herramientas/servir-comunidad.mjs'],{cwd:root,env:{...process.env,COMUNIDAD_PORT:'0'},windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser;
try{
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No inició la vista local.')),12000);server.stdout.on('data',d=>{const m=/http:\/\/127.0.0.1:\d+/.exec(d.toString());if(m){clearTimeout(timer);resolve(m[0]);}});server.once('error',reject);});
 browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
 const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX'}),p=await ctx.newPage(),errores=[],externas=[];
 p.on('pageerror',e=>errores.push(e.message));p.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))externas.push(r.url());});
 await p.goto(url);await p.evaluate(()=>document.fonts.ready);await p.locator('.post-photo').first().waitFor();
 for(const width of [390,768,1440]){await p.setViewportSize({width,height:950});for(const tema of ['light','dark']){await p.evaluate(t=>document.documentElement.dataset.theme=t,tema);await p.waitForTimeout(220);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Desbordamiento a '+width);await p.screenshot({path:fileURLToPath(new URL('inicio-'+width+'-'+tema+'.png',carpeta)),fullPage:false});}}
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>document.documentElement.dataset.theme='light');
 await p.locator('#buscar').fill('UÑA');await p.waitForURL('**/#buscar');assert.equal(await p.locator('.tile').count(),1);assert.match(await p.locator('.tile').innerText(),/Francesas/);
 await p.locator('.tile [data-guardar]').click();await p.locator('#nav-movil a[href="#guardados"]').click();assert.equal(await p.locator('.tile').count(),1);await p.reload();assert.equal(await p.locator('.tile').count(),1);
 await p.locator('#buscar').fill('zzzinexistente');await p.waitForURL('**/#buscar');await p.getByRole('heading',{name:'No encontramos ese estilo'}).waitFor();await p.getByRole('button',{name:'Explorar trabajos'}).click();
 await p.locator('.tile [data-perfil="ab-beauty-room"]').first().click();await p.getByRole('heading',{name:'AB Beauty Room',exact:true}).waitFor();await p.getByRole('tab',{name:'Servicios',exact:true}).click();await p.screenshot({path:fileURLToPath(new URL('perfil-movil.png',carpeta))});await p.locator('[data-reservar="ab-beauty-room/cejas"]').click();
 const dia=await p.locator('#reserva-fecha option').nth(1).getAttribute('value');await p.locator('#reserva-fecha').selectOption(dia);await p.locator('[data-hora="10:00"]').click();await p.screenshot({path:fileURLToPath(new URL('horarios-movil.png',carpeta))});await p.locator('#reservar').click();await p.getByText('Esta reserva no se envió al negocio ni se agregó a su agenda.').waitFor();await p.getByRole('button',{name:'Ver mis citas de prueba'}).click();await p.locator('.booking').waitFor();assert.equal(await p.locator('.booking').count(),1);await p.reload();assert.equal(await p.locator('.booking').count(),1);
 await p.locator('#nav-movil [data-accion="publicar"]').click();await p.locator('#publicar-negocio').selectOption('ab-beauty-room');await p.locator('#publicar-titulo').fill('<img src=x onerror=alert(1)>');await p.locator('#publicar-texto').fill('Trabajo de prueba del editor local.');await p.locator('#publicar-foto').setInputFiles(fileURLToPath(new URL('../../comunidad/assets/cejas.jpg',import.meta.url)));await p.waitForFunction(()=>{const i=document.querySelector('#foto-preview');return i&&!i.hidden;});await p.locator('#publicar-consentimiento').check();await p.locator('#publicar-guardar').click();await p.waitForURL('**/#inicio');assert.match(await p.locator('.post').first().innerText(),/<img src=x onerror=alert\(1\)>/);assert.equal(await p.locator('.post [onerror]').count(),0);await p.reload();assert.match(await p.locator('.post').first().innerText(),/Trabajo de prueba del editor local/);
 await p.locator('.post').first().locator('[data-seguir]').click();await p.locator('[data-modo="siguiendo"]').click();assert.ok(await p.locator('.post').count()>=2);assert.equal(await p.locator('.post [data-perfil="distrito-barber"]').count(),0);
 await p.screenshot({path:fileURLToPath(new URL('publicacion-movil.png',carpeta)),fullPage:true});
 // Reinicio exclusivo de esta demostración: no limpia otras claves ni crea llamadas de red.
 await p.evaluate(()=>localStorage.setItem('belleza.v1.test','conservar'));p.once('dialog',d=>d.accept());await p.setViewportSize({width:1440,height:950});await p.locator('[data-accion="restablecer"]').click();assert.equal(await p.evaluate(()=>localStorage.getItem('belleza.v1.test')),'conservar');await p.locator('#nav-lateral a[href="#citas"]').click();await p.getByRole('heading',{name:'Tu próxima cita empieza con una idea'}).waitFor();
 assert.deepEqual(errores,[]);assert.deepEqual(externas,[]);console.log('Comunidad: búsqueda, vacíos, guardados persistentes, perfil/servicio, reserva local, foto/consentimiento, escape de HTML, seguir, reinicio aislado y White/Dark a 390/768/1440 verificados. Cero solicitudes externas.');await ctx.close();
}finally{await browser?.close();server.kill();}
