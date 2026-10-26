import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {entorno} from './entorno.mjs';
const env=await entorno();
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const destino=process.env.DISENO_CAPTURAS||fileURLToPath(new URL('../../imagenes/',import.meta.url));await mkdir(destino,{recursive:true});
const tab=(p,n)=>p.locator('#tabbar').getByRole('tab',{name:n,exact:true});
let a,b;
try {
 const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX'});a=await ctx.newPage();const errors=[];a.on('pageerror',e=>errors.push(e.message));
 await a.goto(env.base);
 await tab(a,'Ajustes').click();
 await a.getByRole('button',{name:/Sincronización/}).click();await a.getByLabel('Token de acceso',{exact:true}).fill(env.token);await a.getByRole('button',{name:'Conectar',exact:true}).click();await a.waitForFunction(()=>document.querySelector('#sync-status')?.textContent.includes('Sincronizado'));await a.getByRole('button',{name:'Listo',exact:true}).click();
 for(const tema of ['Clásico iOS','Rosa champaña','Negro y dorado','Ritmo','Cristal pastel']) {
  await tab(a,'Ajustes').click();await a.getByRole('radio',{name:tema,exact:true}).click();
  for(const modo of ['☀️ White','🌙 Dark']) {
   await a.getByRole('tab',{name:modo,exact:true}).click();
   assert.equal(await a.evaluate(()=>document.documentElement.dataset.modo==='dark'),modo==='🌙 Dark');
   for(const seccion of ['Agenda','Clientas','Servicios','Ajustes']) {
    await tab(a,seccion).click();
    assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await a.getByRole('button',{name:'Nueva cita',exact:true}).isVisible(),true);
    await a.getByRole('button',{name:'Nueva cita',exact:true}).click();await a.getByRole('dialog',{name:'Nueva cita',exact:true}).waitFor();
    await a.getByRole('button',{name:'Cancelar',exact:true}).click();
   }
   await tab(a,'Servicios').click();await a.locator('#screen').getByRole('tab',{name:'Promociones',exact:true}).click();
   assert.equal(await tab(a,'Servicios').getAttribute('aria-selected'),'true');assert.equal(await a.locator('#tabbar [data-tab="promos"]').isVisible(),false);
   await tab(a,'Ajustes').click();
   const bg=await a.locator('#tabbar').evaluate(el=>getComputedStyle(el).backgroundColor);
   if(modo==='🌙 Dark'||tema==='Negro y dorado')assert.notEqual(bg,'rgb(255, 255, 255)');
  }
 }
 await a.getByRole('radio',{name:'Clásico iOS',exact:true}).click();
 await a.getByRole('tab',{name:'☀️ White',exact:true}).click();await tab(a,'Agenda').click();await a.screenshot({path:destino+'/diseno-integrado-white.png'});
 await tab(a,'Ajustes').click();await a.getByRole('tab',{name:'🌙 Dark',exact:true}).click();await a.screenshot({path:destino+'/diseno-integrado-ajustes.png'});
 await tab(a,'Agenda').click();await a.screenshot({path:destino+'/diseno-integrado-dark.png'});
 await a.reload();assert.equal(await a.evaluate(()=>document.documentElement.dataset.modo),'dark');
 // La apariencia elegida viaja con los ajustes y no se acepta un modo desconocido.
 await tab(a,'Ajustes').click();await a.getByRole('button',{name:/Sincronización/}).click();await a.getByRole('button',{name:'Sincronizar ahora',exact:true}).click();await a.waitForFunction(()=>document.querySelector('#sync-status')?.textContent.includes('Sincronizado'));
 const snapshot=await env.repo.snapshot();const ajustes=snapshot.records.find(r=>r.id==='__settings');assert.equal(ajustes.data.modo,'dark');
 const r=await fetch(env.base+'/api/objetos/__settings',{method:'PUT',headers:{Authorization:'Bearer '+env.token,'Content-Type':'application/json'},body:JSON.stringify({data:{modo:'desconocido'},baseVersion:ajustes.version,mutationId:crypto.randomUUID()})});assert.equal(r.status,400);
 const ctxB=await browser.newContext({viewport:{width:390,height:844}});b=await ctxB.newPage();await b.goto(env.base);await tab(b,'Ajustes').click();await b.getByRole('button',{name:/Sincronización/}).click();await b.getByLabel('Token de acceso',{exact:true}).fill(env.token);await b.getByRole('button',{name:'Conectar',exact:true}).click();await b.waitForFunction(()=>document.documentElement.dataset.modo==='dark');
 for(const width of [390,768,1440]){await a.setViewportSize({width,height:900});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);console.log('Diseño: 5 temas × White/Dark, 4 secciones y Nueva cita desde cada una; Promociones integrada, contraste de barra, recarga, sincronización de apariencia y validación verificadas.');
} finally {await browser.close();await env.cerrar();}
