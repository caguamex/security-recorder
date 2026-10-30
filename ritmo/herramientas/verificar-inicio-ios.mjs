import {chromium} from '../servidor/node_modules/playwright/index.mjs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../vista-neutro-ios/',import.meta.url));
const shots=fileURLToPath(new URL('../imagenes/inicio-ios-preview/',import.meta.url));
await mkdir(shots,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.includes('..'))throw Error();const file=join(root,path==='/'?'index.html':path);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],outbound=[];
const vistas=[['01-inicio','Inicio'],['02-buscar','Buscar'],['03-agendar','Agendar sin cuenta'],['04-whatsapp','Registro · WhatsApp'],['05-codigo','Registro · Código'],['06-salon','Registro · Salón'],['07-listo','Salón listo'],['08-hoy','Hoy · barra A'],['09-menu','Menú del ＋'],['10-nueva-cita','Nueva cita'],['11-agenda','Agenda']];
try{
 const c=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX',isMobile:true,hasTouch:true});
 await c.route('**/*',r=>{if(!r.request().url().startsWith(url)){outbound.push(r.request().url());return r.abort();}return r.continue();});
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 const foto=async nombre=>{assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,nombre);await p.screenshot({path:join(shots,nombre+'.png'),animations:'disabled'});};
 for(const theme of ['light','dark']){
  await p.goto(url+'/#apariencia');await p.getByRole('tab',{name:theme==='dark'?'Dark':'White',exact:true}).click();
  await p.goto(url);await p.getByRole('button',{name:'Entrar',exact:true}).waitFor();
  assert.equal(await p.locator('#dock .registro-capsula').count(),1);assert.equal(await p.locator('#dock .inicio-visitante').count(),1);
  assert.equal(await p.getByText('Tu salón y tu agenda en un solo lugar',{exact:true}).count(),0);
  await foto('01-inicio-'+theme);
  await p.locator('#search').fill('CÉJAS');await p.getByRole('heading',{name:/Locales que hacen/}).waitFor();assert.equal(await p.locator('.local-busqueda').count(),1);await foto('02-buscar-'+theme);
  await p.locator('#search').fill('ceja');assert.equal(await p.locator('.local-busqueda').count(),1);await p.locator('#search').fill('no existe');await p.getByText('No hay coincidencias. Prueba otra búsqueda.').waitFor();
  await p.goto(url);await p.locator('[data-demo-reservar]').first().click();await p.getByRole('button',{name:'Pedir cita',exact:true}).waitFor();await foto('03-agendar-'+theme);await p.locator('#sheet-close').click();
  await p.locator('#dock .registro-capsula').click();await p.getByRole('heading',{name:'Registra tu salón',exact:true}).waitFor();await foto('04-whatsapp-'+theme);
  await p.locator('#inicio-telefono input[name=telefono]').fill('5512345678');await p.locator('input[name=consentimiento]').check();await p.getByRole('button',{name:'Enviar código por WhatsApp',exact:true}).click();await p.getByRole('heading',{name:'Escribe el código',exact:true}).waitFor();
  await foto('05-codigo-'+theme);assert.equal(await p.getByText(/Prefiero recibirlo por correo/).count(),0);
  for(let i=1;i<=6;i++)await p.getByLabel(`Dígito ${i} del código de ejemplo`,{exact:true}).fill(String(i));await p.getByRole('button',{name:'Verificar código de ejemplo'}).click();
  await p.getByRole('heading',{name:'Crea tu salón',exact:true}).waitFor();await p.locator('#inicio-salon [name=nombre]').fill('Antonio');await p.getByLabel('Negocio',{exact:true}).fill('AB’ Beauty Room');await p.getByLabel('Colonia o ciudad',{exact:true}).fill('Centro · Monclova');await foto('06-salon-'+theme);
  await p.getByRole('button',{name:'Crear mi salón',exact:true}).click();await p.getByRole('heading',{name:'¡Listo, Antonio!',exact:true}).waitFor();await foto('07-listo-'+theme);
  await p.getByRole('button',{name:'Ir a mi agenda',exact:true}).click();await p.getByRole('heading',{name:'Hoy',exact:true}).waitFor();assert.equal(await p.locator('#dock .tabbar>button').count(),5);const rect=await p.locator('.crear-central').boundingBox();assert.equal(rect.width,50);assert.equal(rect.height,50);await foto('08-hoy-'+theme);
  await p.getByRole('button',{name:'Agregar',exact:true}).click();await p.getByRole('menu',{name:'Crear'}).waitFor();assert.equal(await p.getByRole('menuitem').count(),4);await foto('09-menu-'+theme);
  await p.getByRole('menuitem',{name:/Nueva cita/}).click();await p.locator('#appointment-form').waitFor();assert.equal(await p.locator('input[type=time]').count(),0);await p.getByRole('switch',{name:'Confirmar por WhatsApp'}).waitFor();assert.equal(await p.locator('.svc-photo img').count(),4);await foto('10-nueva-cita-'+theme);await p.locator('#sheet-close').click();
  await p.goto(url+'/#agenda');await p.getByRole('heading',{name:'Agenda',exact:true}).waitFor();assert.equal(await p.locator('[data-person]').count(),3);await foto('11-agenda-'+theme);
  const ev=await p.locator('.event').evaluateAll(a=>a.map(x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width};}));assert.equal(ev[0].y,ev[1].y);assert.ok(ev[0].x+ev[0].w<=ev[1].x||ev[1].x+ev[1].w<=ev[0].x);assert.equal(await p.locator('.day small').allTextContents().then(a=>a.join('')),'LMMJVSD');
  await p.goto(url+'/#salon');await p.getByRole('heading',{name:/AB.*Beauty Room/}).waitFor();assert.equal(await p.getByRole('heading',{name:'Registra tu salón'}).count(),0);
 }
 for(const width of [320,768,1440]){await p.setViewportSize({width,height:900});for(const r of ['inicio','registro','codigo','crear-salon','listo','hoy','agenda']){await p.goto(url+'/#'+r);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,r+' '+width);}}
 const rotas=await p.locator('img').evaluateAll(a=>a.filter(x=>x.complete&&!x.naturalWidth).map(x=>x.src));assert.deepEqual(rotas,[]);assert.deepEqual(outbound,[]);assert.deepEqual(errors,[]);
 const galeria=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agendappx · capturas de Inicio iOS</title><style>body{margin:0;padding:24px;background:#f2f2f7;color:#111;font:16px system-ui}h1{font-size:27px}a{color:inherit}nav{position:sticky;top:0;padding:16px 0;background:#f2f2f7;display:flex;gap:20px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:25px}figure{margin:0}img{width:100%;max-width:390px;border-radius:22px;border:1px solid #ccc}figcaption{font-weight:600;margin:9px 0 20px}h2{scroll-margin-top:70px}p{max-width:700px;line-height:1.5}</style><h1>Agendappx · Inicio y registro</h1><p>Capturas reales de la vista previa a 390 × 844 px. Fotos de AB’ Beauty Room y datos ilustrativos. Esta vista no envía mensajes ni crea cuentas.</p><nav><a href="../">Probar la vista</a><a href="#white">White</a><a href="#dark">Dark</a></nav>${[['light','White','white'],['dark','Dark','dark']].map(([t,n,id])=>`<h2 id="${id}">${n}</h2><section>${vistas.map(([f,titulo])=>`<figure><a href="${f}-${t}.png"><img loading="lazy" src="${f}-${t}.png" alt="${titulo} · ${n}"></a><figcaption>${titulo}</figcaption></figure>`).join('')}</section>`).join('')}</html>`;
 await writeFile(join(shots,'index.html'),galeria);await c.close();console.log(JSON.stringify({pantallas:11,modos:2,anchos:[320,390,768,1440],registroTresPasos:true,barraA:true,reservaSinCuenta:true,errores:errors,solicitudesExternas:outbound,capturas:shots}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
