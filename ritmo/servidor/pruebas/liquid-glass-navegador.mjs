// App real y almacén local aislado. Nunca contacta cuentas, WhatsApp o datos de producción.
import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';
const raiz=fileURLToPath(new URL('../../dist/pwa/',import.meta.url));
const destino=process.env.GLASS_CAPTURAS||fileURLToPath(new URL('../../imagenes/liquid-glass/',import.meta.url));await mkdir(destino,{recursive:true});
const errores=[],externas=[];let base;
const servidor=createServer(async(req,res)=>{try{
 const path=new URL(req.url,base).pathname;
 if(path==='/api/cuentas/config')return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({habilitado:false,inicioPublico:false,acceso:{whatsapp:true,contrasena:true,correo:false}}));
 if(path.startsWith('/api/'))return res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({negocios:[],trabajos:[]}));
 const f=resolve(raiz,'.'+(path==='/'?'/index.html':path.endsWith('/')?path+'index.html':path));
 if(!f.startsWith(resolve(raiz)+sep))return res.writeHead(403).end();
 const tipo={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'}[extname(f)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':tipo});res.end(await readFile(f));
 }catch{if(!res.headersSent)res.writeHead(404);res.end();}});
servidor.listen(0,'127.0.0.1');await once(servidor,'listening');base='http://127.0.0.1:'+servidor.address().port;
const tab=(p,n)=>p.locator('#tabbar').getByRole('tab',{name:n,exact:true});
const color=(p,id)=>p.locator('.ev[data-cita="'+id+'"]').evaluate(e=>getComputedStyle(e).getPropertyValue('--c').trim());
async function pantalla(p){assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sin desbordamiento horizontal');}
try{
 for(const [nombre,motor] of [['edge',chromium],['webkit',webkit]]){
  const b=await motor.launch({headless:true,...(nombre==='edge'?{channel:'msedge'}:{})});
  try{for(const modo of ['light','dark']){
   const ctx=await b.newContext({viewport:{width:390,height:844},locale:'es-MX',timezoneId:'America/Mexico_City',serviceWorkers:'block',colorScheme:modo});
   await ctx.route('**/*',async r=>{if(!r.request().url().startsWith(base)){externas.push(r.request().url().split('?')[0]);return r.abort();}await r.continue();});
   await ctx.addInitScript(modo=>{
    if(localStorage.getItem('prueba-sembrada'))return;
    const d=new Date(),fecha=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    const items=[{id:'clienta-ana',kind:'clienta',nombre:'Ana Martínez',telefono:''},{id:'clienta-lucia',kind:'clienta',nombre:'Lucía Torres',telefono:''},{id:'clienta-elena',kind:'clienta',nombre:'Elena Ruiz',telefono:''},
     {id:'s1',kind:'servicio',nombre:'Diseño de cejas',categoria:'Cejas',duracion:60,precio:300},{id:'s2',kind:'servicio',nombre:'Lifting de pestañas',categoria:'Pestañas',duracion:60,precio:450},
     ...[['a','clienta-ana','s1','13:00','ale'],['b','clienta-ana','s2','14:00','sofi'],['c','clienta-lucia','s1','13:00','sofi'],['d','clienta-elena','s2','15:00','ale']].map(([id,clienta,servicio,start,especialista])=>({id,kind:'cita',clienta,servicio,start,especialista,date:fecha,estado:'confirmada',enviados:{}}))];
    localStorage.setItem('belleza.v1.items',JSON.stringify(items));localStorage.setItem('belleza.v1.settings',JSON.stringify({modo:modo==='dark'?'dark':'',negocio:'Salón de prueba local',abre:'10:00',cierra:'20:00',hideExamples:true}));
    localStorage.setItem('agendappx.cliente.apariencia',modo);localStorage.setItem('prueba-sembrada','si');
   },modo);
   const p=await ctx.newPage();p.on('pageerror',e=>errores.push(e.message));await p.goto(base);
   await p.waitForFunction(()=>{const e=document.querySelector('.hoy-cifras>div');return e&&getComputedStyle(e).backgroundImage;});const material=await p.evaluate(()=>{const s=getComputedStyle(document.querySelector('.hoy-cifras>div'));return {fondo:s.backgroundImage,arriba:s.borderTopColor,abajo:s.borderBottomColor,filtro:s.backdropFilter};});assert.match(material.fondo,/linear-gradient/,'Las tarjetas tienen el material de la referencia');assert.notEqual(material.arriba,material.abajo,'Reflejo direccional sin contorno uniforme');await writeFile(destino+'/'+nombre+'-'+modo+'-material.json',JSON.stringify(material,null,2));
   await tab(p,'Agenda').click();await p.locator('.ev').first().waitFor();
   const ana=await color(p,'a');assert.equal(ana,await color(p,'b'),'Misma clienta: distinto servicio y especialista, mismo color');
   assert.notEqual(ana,await color(p,'c'),'Distinta clienta: mismo servicio, distinto acento en esta muestra');
   const posiciones=await p.locator('.ev[data-cita="a"],.ev[data-cita="c"]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().x));assert.notEqual(posiciones[0],posiciones[1],'Citas simultáneas lado a lado');
   const estado=await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('belleza.v1.sync'));return {records:s.records.filter(r=>r.id!=='__settings'),pending:s.pending.filter(r=>r.id!=='__settings'),conflicts:s.conflicts};});
   await pantalla(p);await p.screenshot({animations:'disabled',path:destino+'/'+nombre+'-'+modo+'-agenda.png'});
   await p.locator('[data-especialista=sofi]').click();assert.equal(await color(p,'b'),ana);assert.equal(await p.locator('.ev[data-cita="a"]').count(),0);
   await p.locator('[data-especialista=""]').click();
   await tab(p,'Clientas').click();assert.equal(await p.locator('[data-clienta=clienta-ana] .av').evaluate(e=>getComputedStyle(e).getPropertyValue('--c').trim()),ana);
   await p.screenshot({animations:'disabled',path:destino+'/'+nombre+'-'+modo+'-clientas.png'});
   await tab(p,'Hoy').click();assert.equal(await p.locator('.cita-clienta[data-cita="a"]').evaluate(e=>getComputedStyle(e).getPropertyValue('--c').trim()),ana);
   await p.screenshot({animations:'disabled',path:destino+'/'+nombre+'-'+modo+'-hoy.png'});
   for(const ancho of [320,390,768,1440]){await p.setViewportSize({width:ancho,height:844});await pantalla(p);const nav=await p.locator('#tabbar').boundingBox(),fab=await p.locator('#fab').boundingBox();assert.ok(fab.x>=nav.x&&fab.x+fab.width<=nav.x+nav.width&&fab.y>=nav.y&&fab.y+fab.height<=nav.y+nav.height+1,'El más está dentro de la cápsula');}
   await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'Crear',exact:true}).click();await p.screenshot({animations:'disabled',path:destino+'/'+nombre+'-'+modo+'-menu.png'});
   await p.locator('#sheetCard').getByRole('button',{name:'Nueva cita',exact:true}).click();await p.getByRole('dialog',{name:'Nueva cita',exact:true}).waitFor();await p.waitForFunction(()=>getComputedStyle(document.querySelector('#sheet')).opacity==='1'&&getComputedStyle(document.querySelector('#sheetCard')).opacity==='1');assert.equal(await p.locator('input[type=time]').count(),0);await p.screenshot({animations:'disabled',path:destino+'/'+nombre+'-'+modo+'-nueva-cita.png'});await p.locator('[data-close]').click();
   await tab(p,'Negocio').click();await p.screenshot({animations:'disabled',path:destino+'/'+nombre+'-'+modo+'-negocio.png'});
   await p.getByRole('button',{name:/^Servicios y precios/}).click();await p.screenshot({animations:'disabled',path:destino+'/'+nombre+'-'+modo+'-servicios.png'});
   await ctx.setOffline(true);await tab(p,'Agenda').click();assert.equal(await color(p,'a'),ana);await ctx.setOffline(false);await p.reload();await tab(p,'Agenda').click();assert.equal(await color(p,'a'),ana);assert.deepEqual(await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('belleza.v1.sync'));return {records:s.records.filter(r=>r.id!=='__settings'),pending:s.pending.filter(r=>r.id!=='__settings'),conflicts:s.conflicts};}),estado,'La apariencia no altera citas, clientas, servicios ni sus pendientes');
   await p.evaluate(()=>document.documentElement.dataset.transparencia='solida');assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--lg-chrome').trim()),modo==='dark'?'#191b1f':'#fff');
   assert.equal(await p.locator('#tabbar').evaluate(e=>getComputedStyle(e).backdropFilter),'none','Reducir transparencia apaga el filtro');assert.equal(await p.locator('#tabbar').evaluate(e=>getComputedStyle(e).backgroundImage),'none','La alternativa sólida elimina el degradado');
   for(const ruta of ['/comunidad/','/plataforma/','/planes/','/recuperar-acceso/']){await p.goto(base+ruta);await p.locator('link[href="/estilo-liquid-glass.css"]').waitFor({state:'attached'});await pantalla(p);assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--lg-bg').trim()),modo==='dark'?'#08090b':'#eef2f4');await p.screenshot({animations:'disabled',path:destino+'/'+nombre+'-'+modo+'-'+ruta.split('/')[1]+'.png'});}
   await ctx.close();
   // La apariencia también debe ser visible cuando todavía no hay citas ni fotografías.
   const vacio=await b.newContext({viewport:{width:390,height:844},locale:'es-MX',serviceWorkers:'block',colorScheme:modo});
   await vacio.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
   await vacio.addInitScript(m=>{try{localStorage.setItem('belleza.v1.settings',JSON.stringify({modo:m==='dark'?'dark':'white',examplesOff:true,abre:'10:00',cierra:'20:00'}));}catch{}},modo);
   const v=await vacio.newPage();v.on('pageerror',e=>errores.push(e.message));await v.goto(base);await v.locator('.hoy-cifras>div').first().waitFor();assert.equal(await v.locator('.hoy-cifras>div').first().innerText(),'0\nCitas de hoy');await pantalla(v);await v.screenshot({animations:'disabled',path:destino+'/'+nombre+'-'+modo+'-hoy-vacio.png'});await tab(v,'Agenda').click();assert.equal(await v.locator('.ev').count(),0);await v.screenshot({animations:'disabled',path:destino+'/'+nombre+'-'+modo+'-agenda-vacia.png'});await vacio.close();
  }}finally{await b.close();}
 }
 assert.deepEqual(errores,[]);assert.deepEqual(externas,[]);
 await writeFile(destino+'/verificacion.json',JSON.stringify({motores:['Edge','WebKit'],modos:['White','Black'],anchos:[320,390,768,1440],colorPor:'clienta',datos:'vacío y con citas ficticias, solo locales',material:'degradado y reflejos direccionales de la referencia',errores,externas},null,2));
 console.log('Liquid Glass: Edge/WebKit, White/Black, colores por clienta entre servicios/especialistas, citas simultáneas, filtros, recarga/offline, datos conservados y superficies compartidas aprobados.');
}finally{servidor.closeAllConnections();servidor.close();}
