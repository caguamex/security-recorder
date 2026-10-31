// UI local: sesión de clienta simulada para reproducir la barra que perdía el registro.
// El login usa el SDK real sin sesión; no se envían códigos ni se contactan servicios reales.
import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';
const raiz=fileURLToPath(new URL('../../dist/pwa/',import.meta.url));
const capturas=new URL('../../imagenes/comunidad-acceso-ios/',import.meta.url);await mkdir(capturas,{recursive:true});
const configuracion={habilitado:true,supabaseURL:'https://zkqwephmuflbuagevvxj.supabase.co',llavePublica:'sb_publishable_prueba_local',acceso:{whatsapp:true,contrasena:true,correo:false},registro:{habilitado:true,turnstileSiteKey:'solo-pruebas'},inicioPublico:true};
const escrituras=[],errores=[];let base;
const json=(res,d)=>res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(d));
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,base).pathname;
 if(path==='/cliente-acceso-prueba.html')return res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><html lang="es-MX"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/comunidad/real.css"><link rel="stylesheet" href="/acceso-neutro.css"></head><body><dialog id="hoja" open><div class="hoja-cabecera"><button id="cerrar">✕</button><h2>Iniciar sesión</h2><button id="listo">✓</button></div><div id="cuerpo-hoja"><section id="acceso-cliente"></section></div></dialog><script src="/cuentas.js"></script><script>window.addEventListener("load",()=>window.AgendappxCuentas.montar(document.getElementById("acceso-cliente"),{cliente:true}));</script></body></html>');
 if(path==='/api/cuentas/config')return json(res,configuracion);
 if(path==='/api/publico/explorar'&&req.method==='POST'){for await(const _ of req);return json(res,{negocios:[]});}
 if(path==='/api/publico/social'&&req.method==='POST'){for await(const _ of req);return json(res,{trabajos:[]});}
 if(path.startsWith('/api/')){if(req.method!=='GET')escrituras.push(path);return res.writeHead(401,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Inicia sesión con tu cuenta.'}));}
 if(path==='/comunidad/cuentas-cliente.js')return res.writeHead(200,{'Content-Type':'text/javascript'}).end(`window.AgendappxCuentas={listo:Promise.resolve(),sesionCliente:async()=>window.__clienta?{nombre:'Camila',guardados:[],siguiendo:[],meGusta:[]}:null,salir:async()=>{window.__clienta=false;document.dispatchEvent(new Event('agendappx:sesion'));}};`);
 const file=resolve(raiz,'.'+(path==='/'?'/index.html':path.endsWith('/')?path+'index.html':path));
 if(!file.startsWith(resolve(raiz)+sep))return res.writeHead(403).end();
 const tipo={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg'}[extname(file)]||'application/octet-stream';
 if(path==='/belleza.js')await new Promise(ok=>setTimeout(ok,100)); // Config rápida, app aún descargando.
 res.writeHead(200,{'Content-Type':tipo});res.end(await readFile(file));
 }catch{if(!res.headersSent)res.writeHead(404);res.end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
async function comprobarPantalla(p){assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No debe desbordar a los lados');}
async function captura(p,nombre){await p.screenshot({path:fileURLToPath(new URL(nombre+'.png',capturas)),animations:'disabled'});}
try{
 for(const [nombre,motor] of [['edge',chromium],['webkit',webkit]]){
  const b=await motor.launch({headless:true,...(nombre==='edge'?{channel:process.env.BROWSER_CHANNEL||'msedge'}:{})});
  try{
   for(const autenticada of [false,true]){
    const c=await b.newContext({viewport:{width:390,height:844},locale:'es-MX',serviceWorkers:'block'});
    await c.addInitScript(valor=>{window.__clienta=valor;},autenticada);
    const p=await c.newPage();p.on('pageerror',e=>errores.push(e.message));
    await p.goto(base+'/comunidad/');await p.locator('#registro-salon').waitFor();
    assert.equal(await p.locator('[data-vista=social]').getAttribute('aria-selected'),'true','Comunidad abre primero en publicaciones');
    assert.equal(await p.locator('.categorias').count(),0,'No sustituye el feed inicial por casillas de fotos vacías');
    await p.locator('#ubicacion-filtro').click();await p.getByRole('heading',{name:'Tu ubicación',exact:true}).waitFor();await p.locator('#cerrar').click();
    await p.locator('[data-categoria=Cejas]').click();assert.equal(await p.locator('#buscar').inputValue(),'Cejas');await p.locator('[data-categoria=""]').click();assert.equal(await p.locator('#buscar').inputValue(),'');
    assert.equal(await p.locator('#registro-salon').getAttribute('href'),'/#registro');
    assert.match(await p.locator('#registro-salon').innerText(),/Regístrate como negocio/);
    assert.equal(await p.locator('#entrar-negocio').innerText(),autenticada?'Mi cuenta':'Entrar');
    assert.equal(await p.locator('#pestanas [data-tab]').count(),autenticada?4:1);
    const bounds=await p.locator('#registro-salon').boundingBox();assert.ok(bounds.y>0&&bounds.y+bounds.height<844,'El registro queda dentro de la pantalla');
    for(const tema of ['light','dark']){
     await p.evaluate(tema=>document.documentElement.dataset.theme=tema,tema);await comprobarPantalla(p);
     if(nombre==='edge')await captura(p,'comunidad-'+(autenticada?'con-sesion':'visitante')+'-'+tema);
    }
    if(autenticada){await p.locator('[data-tab=perfil]').click();await p.getByRole('button',{name:'Editar nombre público'}).waitFor();assert.equal(await p.locator('#registro-salon').isVisible(),true);
     // Una actualización de sesión no debe volver a ocultar el registro ni duplicarlo.
     await p.evaluate(()=>document.dispatchEvent(new Event('agendappx:sesion')));assert.equal(await p.locator('#registro-salon').count(),1);await p.locator('#registro-salon').waitFor();}
    for(const width of [320,768,1440]){await p.setViewportSize({width,height:960});await comprobarPantalla(p);}
    await c.close();
   }
   const c=await b.newContext({viewport:{width:390,height:844},locale:'es-MX',serviceWorkers:'block'});
   await c.route('https://zkqwephmuflbuagevvxj.supabase.co/**',r=>{throw new Error('La UI sin sesión no debe contactar Auth real: '+new URL(r.request().url()).pathname);});
   const p=await c.newPage();p.on('pageerror',e=>errores.push(e.message));await p.goto(base+'/#entrar');await p.locator('#auth-cuenta').waitFor();
   assert.equal(await p.locator('#sheetCard .sh-nav b').innerText(),'Agendappx');assert.equal(await p.locator('#sheetCard [data-done]').isVisible(),false);
   assert.equal(await p.locator('#sheetCard .grab').isVisible(),false);assert.equal(await p.locator('#registro-abrir').innerText(),'Regístrate como negocio');
   for(const tema of ['White','Dark']){
    await p.evaluate(tema=>document.documentElement.dataset.modo=tema==='Dark'?'dark':'light',tema);await comprobarPantalla(p);
    await p.locator('#sheetCard').evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{}))));
    const geometria=await p.locator('#sheetCard').boundingBox();assert.ok(geometria.y<=1&&geometria.height>=843,'El acceso ocupa la pantalla, sin Hoy detrás');
    for(const id of ['#auth-cuenta','#auth-pass']){const rect=await p.locator(id).boundingBox();assert.ok(rect.width>=330&&rect.height>=50,'Campos amplios y completos');}
    if(nombre==='edge')await captura(p,'entrar-'+tema.toLowerCase());
   }
   await p.locator('#auth-pass').fill('EjemploSoloLocal8');await p.locator('[data-ver=auth-pass]').click();assert.equal(await p.locator('#auth-pass').getAttribute('type'),'text');await p.locator('[data-ver=auth-pass]').click();assert.equal(await p.locator('#auth-pass').getAttribute('type'),'password');await p.locator('#auth-pass').fill('');
   await p.locator('#auth-con-codigo').click();await p.locator('#auth-destino').waitFor();assert.equal(await p.locator('#auth-clave').isVisible(),false);assert.equal(await p.locator('#auth-correo').isVisible(),false);
   if(nombre==='edge')await captura(p,'entrar-whatsapp');
   await p.locator('#auth-con-clave').click();await p.locator('#auth-cuenta').waitFor();
   const paginaRegistro=await c.newPage();paginaRegistro.on('pageerror',e=>errores.push(e.message));await paginaRegistro.goto(base+'/#registro');await paginaRegistro.locator('#registro-paso-cuenta').waitFor();assert.equal(await paginaRegistro.locator('.sh-nav b').innerText(),'Agendappx');
   for(const tema of ['light','dark']){await paginaRegistro.evaluate(tema=>document.documentElement.dataset.modo=tema,tema);await comprobarPantalla(paginaRegistro);if(nombre==='edge')await captura(paginaRegistro,'registro-'+tema);}
   for(const width of [320,768,1440]){await p.setViewportSize({width,height:960});await comprobarPantalla(p);}
   const paginaCliente=await c.newPage();paginaCliente.on('pageerror',e=>errores.push(e.message));await paginaCliente.goto(base+'/cliente-acceso-prueba.html');await paginaCliente.locator('#auth-cuenta').waitFor();
   assert.equal(await paginaCliente.locator('#titulo-hoja').count(),0);assert.equal(await paginaCliente.locator('.hoja-cabecera h2').innerText(),'Agendappx');assert.equal(await paginaCliente.locator('#listo').isVisible(),false);assert.equal(await paginaCliente.locator('#registro-abrir').innerText(),'Crear mi cuenta');
   for(const tema of ['light','dark']){await paginaCliente.evaluate(tema=>document.documentElement.dataset.theme=tema,tema);await comprobarPantalla(paginaCliente);const marco=await paginaCliente.locator('#hoja').boundingBox();assert.ok(marco.y<=1&&marco.height>=843);if(nombre==='edge')await captura(paginaCliente,'acceso-clienta-'+tema);}
   await c.close();console.log(nombre+': registro visible con y sin sesión; perfil de clienta conservado; acceso Neutro, White/Dark y WhatsApp; 320/390/768/1440.');
  }finally{await b.close();}
 }
 assert.deepEqual(escrituras,[],'No debe crear cuentas, solicitar códigos ni cambiar datos');assert.deepEqual(errores,[]);
}finally{server.closeAllConnections();server.close();}
