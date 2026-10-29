import {chromium} from '../servidor/node_modules/playwright/index.mjs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {join,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../vista-neutro-ios/',import.meta.url));
const shots=fileURLToPath(new URL('../imagenes/neutro-ios/',import.meta.url));await mkdir(shots,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.includes('..'))throw Error();const file=join(root,path==='/'?'index.html':path);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.svg':'image/svg+xml'};res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],outbound=[];
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX',isMobile:true,hasTouch:true});
 await ctx.route('**/*',r=>{if(!r.request().url().startsWith(url)){outbound.push(r.request().url());return r.abort();}return r.continue();});
 const p=await ctx.newPage();p.on('pageerror',e=>{errors.push(e.message);console.log('ERROR_UI',e.message);});p.on('response',r=>{if(r.status()>=400)console.log('HTTP_ERROR',r.status(),r.url());});
 await p.goto(url);console.log('INICIO',await p.title(),errors);await p.locator('h1').filter({hasText:'Hoy'}).waitFor({timeout:7000});
 const routes=['hoy','agenda','clientas','servicios','negocio','explorar','salon','social','apariencia','planes','mi-plan','equipo','horarios','whatsapp','conexiones','login','favoritos','mis-citas','estadisticas','promociones','facebook','trabajos','resenas','perfil'];
 for(const theme of ['light','dark']){
  await p.evaluate(t=>{localStorage.setItem('agendappx.neutro.preview.apariencia',t);document.documentElement.dataset.theme=t;},theme);
  for(const route of routes){
   await p.goto(url+'/#'+route);await p.locator('#dock button').first().waitFor();
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,route+' overflow '+theme);
   const broken=await p.locator('img').evaluateAll(a=>a.filter(x=>x.complete&&x.naturalWidth===0).map(x=>x.src));assert.deepEqual(broken,[],route+' imágenes');
   if(['hoy','agenda','negocio','explorar','salon','social','planes','servicios'].includes(route))await p.screenshot({path:shots+'/'+route+'-'+theme+'.png',fullPage:false,animations:'disabled'});
  }
 }
 await p.goto(url+'/#hoy');await p.getByRole('button',{name:'Agregar',exact:true}).click();await p.getByRole('button',{name:'Nueva cita',exact:true}).click();
 await p.locator('#appointment-form').waitFor();await p.screenshot({path:shots+'/nueva-cita.png',animations:'disabled'});
 await p.locator('input[name=name]').fill('Ejemplo local');await p.locator('#new-service').selectOption('volumen');assert.match(await p.locator('#new-summary').textContent(),/850/);
 await p.locator('#appointment-form button[type=submit]').click();await p.getByRole('heading',{name:'Cita preparada'}).waitFor();await p.locator('#sheet-close').click();
 await p.goto(url+'/#servicios');await p.locator('#search').fill('CEJAS');assert.equal(await p.locator('#results .service-card').count(),1);await p.locator('#search').fill('no existe');await p.getByText('Sin coincidencias',{exact:true}).waitFor();
 await p.goto(url+'/#apariencia');await p.getByRole('tab',{name:'Dark',exact:true}).click();assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
 await p.getByRole('switch',{name:'Reducir transparencia'}).click();assert.equal(await p.locator('html').getAttribute('data-transparency'),'solid');await p.getByRole('tab',{name:'White',exact:true}).click();
 await p.goto(url+'/#salon');await p.getByRole('tab',{name:'Horarios',exact:true}).click();await p.getByRole('button',{name:'17:00',exact:true}).click();await p.getByRole('button',{name:/Agendar cita/}).click();assert.equal(await p.getByLabel('Hora de la cita').inputValue(),'17:00');await p.locator('#sheet-close').click();
 for(const width of [768,1440]){await p.setViewportSize({width,height:1000});await p.goto(url+'/#hoy');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:shots+'/hoy-'+width+'.png',animations:'disabled'});}
 assert.deepEqual(outbound,[]);assert.deepEqual(errors,[]);console.log(JSON.stringify({pantallas:routes.length,modos:2,anchos:[390,768,1440],busqueda:true,hoja_cita:true,apariencia:true,reducir_transparencia:true,horarios:true,errores:errors,solicitudes_externas:outbound,capturas:shots}));await ctx.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
