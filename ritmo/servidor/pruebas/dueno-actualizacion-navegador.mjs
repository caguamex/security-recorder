// Regresión del iPhone del dueño: el SW anterior conservaba el panel con QR después de publicar
// el acceso solo con WhatsApp. Mismo contexto: 61cb2a6 → b158896 (falla) → versión actual.
// Solo localhost, PostgreSQL local, OTP ficticio y Auth simulado; ningún envío ni cuenta real.
// Un proxy local rechaza cualquier conexión externa y la prueba exige que no haya ninguna.
import {chromium,webkit} from 'playwright';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {createServer,request as httpRequest} from 'node:http';
import {fileURLToPath} from 'node:url';
import {mkdtemp,mkdir,writeFile,readFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {entornoSocial,ids,sesiones} from './social-entorno.mjs';
import {VerificadorJWT} from '../build/cuentas/jwt.js';
import {rutasCuentas} from '../build/cuentas/http.js';
import {crearServidor} from '../build/http.js';

const raiz=fileURLToPath(new URL('../../../',import.meta.url)),actualDist=fileURLToPath(new URL('../../dist/pwa/',import.meta.url));
const temp=await mkdtemp(join(tmpdir(),'agendappx-dueno-act-')),sitio=join(temp,'sitio');
// Publica en el directorio servido una compilación guardada en Git o la de esta copia.
const sdk={};
async function publicar(version){
 await publicarArchivos(version);sdk[version]=await readFile(join(sitio,'cuentas.js'),'utf8');
}
async function publicarArchivos(version){
 await rm(sitio,{recursive:true,force:true});await mkdir(sitio,{recursive:true});
 if(version==='actual'){await cp(actualDist,sitio,{recursive:true});return;}
 const git=(...a)=>execFileSync('git',a,{cwd:raiz,maxBuffer:64*1024*1024});
 const lista=git('ls-tree','-r','--name-only',version,'ritmo/dist/pwa').toString().trim().split('\n');
 assert.ok(lista.length>50,'Falta la compilación '+version+' en el historial de Git');
 for(const f of lista){const destino=join(sitio,f.slice('ritmo/dist/pwa/'.length));await mkdir(dirname(destino),{recursive:true});await writeFile(destino,git('show',version+':'+f));}
}
await publicar('61cb2a6');

const e=await entornoSocial(),supabase='https://zkqwephmuflbuagevvxj.supabase.co';
const sql=async(q,a)=>{const c=await e.pool.connect();try{return await c.query(q,a);}finally{c.release();}};
await sql("SELECT set_config('ritmo.plataforma_admin',$1,false)",[ids.nueva]);
for(const m of ['20261030180000_panel_plataforma.sql','20261030190000_codigos_manuales.sql','20261030214547_dueno_solo_whatsapp.sql'])await sql(await readFile(new URL('../../supabase/migrations/'+m,import.meta.url),'utf8'));
await sql('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[sesiones.nueva,ids.nueva]);
const par=await generateKeyPair('ES256',{extractable:true}),jwk={...await exportJWK(par.publicKey),kid:'local-dueno',alg:'ES256'};
const jwt=new VerificadorJWT(supabase,{fetch:async()=>Response.json({keys:[jwk]})});let base='';
const cuentas={habilitado:true,supabaseURL:supabase,llavePublica:'sb_publishable_prueba_local',salones:new Set([ids.salon]),acceso:{whatsapp:true,correo:false},get origen(){return base;}};
const interno=crearServidor({salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})},'a'.repeat(40),sitio,{cuentas:rutasCuentas(e.poolAPI,jwt,cuentas)});
const usuario=()=>({id:ids.nueva,phone:'525511111111',phone_confirmed_at:new Date().toISOString(),aud:'authenticated',role:'authenticated',factors:[]});
const sesion=async()=>({access_token:await new SignJWT({session_id:sesiones.nueva,aal:'aal1',role:'authenticated'}).setProtectedHeader({alg:'ES256',kid:'local-dueno'}).setSubject(ids.nueva).setIssuer(supabase+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey),refresh_token:'solo-pruebas',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:usuario()});
const cuenta={pedidos:0,enroll:0};
// WebKit no pasa por context.route las peticiones de una página controlada por el SW:
// el OTP ficticio lo atiende el propio servidor local, igual en ambos navegadores.
const json=(res,d)=>res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(d));
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://local').pathname,solicitud='aaaaaaaa-1111-4111-8111-11111111111'+cuenta.pedidos;
 if(req.method==='POST'&&path==='/api/acceso/solicitar'){for await(const _ of req);cuenta.pedidos++;return json(res,{id:'aaaaaaaa-1111-4111-8111-11111111111'+cuenta.pedidos,prueba:'a'.repeat(64)});}
 if(req.method==='POST'&&path==='/api/acceso/verificar'){for await(const _ of req);await sql("INSERT INTO ritmo.acceso_solicitudes(id,prueba_hash,destino_hash,ip_hash,usuario_id,canal,tipo,estado,codigo_hash,vence_en) VALUES($1,$2,$2,$2,$3,'whatsapp','sms','usado',$2,now()+interval '10 minutes') ON CONFLICT DO NOTHING",[solicitud,'a'.repeat(64),ids.nueva]);await sql('UPDATE ritmo.acceso_sesiones SET solicitud_otp=$1 WHERE sesion_id=$2',[solicitud,sesiones.nueva]);return json(res,await sesion());}
 // Supabase Auth simulado (ver addInitScript en contexto()).
 if(path.startsWith('/sb/')){for await(const _ of req);const ruta=path.slice(3);
  // Respuesta observada en el iPhone al intentar inscribir la autenticadora.
  if(ruta==='/auth/v1/factors'){cuenta.enroll++;return res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({code:500,error_code:'unexpected_failure',msg:'Error generating QR Code'}));}
  const d=ruta==='/auth/v1/user'?usuario():ruta==='/auth/v1/token'?await sesion():ruta==='/auth/v1/logout'?{}:null;
  if(!d)return res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({msg:'Ruta Auth inesperada: '+ruta}));
  return json(res,d);}
 interno.emit('request',req,res);
});
server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
// Proxy de seguridad: reenvía solo este servidor local y rechaza cualquier otra conexión,
// de modo que una petición que escape de la intercepción nunca llega a Supabase real.
const externas=[];
const proxy=createServer((req,res)=>{let u;try{u=new URL(req.url);}catch{res.writeHead(400).end();return;}
 if(u.origin!==base){externas.push(u.host);res.writeHead(403).end();return;}
 const f=httpRequest({host:'127.0.0.1',port:server.address().port,path:u.pathname+u.search,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
 f.on('error',()=>res.destroy());req.pipe(f);});
proxy.on('connect',(req,socket)=>{externas.push(req.url);socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');});
proxy.listen(0,'127.0.0.1');await once(proxy,'listening');

let browser,motor;
async function contexto(){
 const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX',colorScheme:'dark'});
 // El arnés (no la app) redirige Supabase Auth al servidor local antes de que cargue el SDK:
 // context.route no ve esas peticiones en WebKit cuando el SW controla la página.
 await ctx.addInitScript(supa=>{const f=window.fetch.bind(window);window.fetch=(input,init)=>{const u=typeof input==='string'?input:input instanceof URL?input.href:input.url;return u.startsWith(supa)?f('/sb'+u.slice(supa.length),input instanceof Request?{method:input.method,headers:input.headers,body:init?.body,...init}:init):f(input,init);};},supabase);
 return ctx;
}
const registro=p=>p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return {cachés:(await caches.keys()).filter(k=>k.startsWith('ritmo-belleza-')).sort(),espera:!!r?.waiting};});
const servido=p=>p.evaluate(()=>fetch('/cuentas.js').then(r=>r.text()));
// La comprobación de navegación del navegador instala la versión nueva sin activarla.
async function enEspera(p){for(const fin=Date.now()+30000;Date.now()<fin;await p.waitForTimeout(250))if(await p.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration('/'))?.waiting))return;throw new Error('El navegador no instaló la versión nueva');}
const datos=p=>p.evaluate(()=>new Promise((ok,mal)=>{const r=indexedDB.open('prueba-fotos',1);r.onupgradeneeded=()=>r.result.createObjectStore('fotos');r.onerror=()=>mal(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('fotos').objectStore('fotos').get('pendiente');t.onsuccess=()=>{db.close();ok({cola:localStorage.getItem('belleza.v1.sync'),auth:!!localStorage.getItem('agendappx.auth'),cookie:document.cookie,foto:t.result?Array.from(t.result):null});};};}));
async function entrarConCodigoViejo(p){
 await p.goto(base+'/plataforma/');await p.locator('#auth-destino').waitFor();
 await p.locator('#auth-destino').fill('5511111111');await p.locator('#auth-pedir').click();
 try{await p.locator('#auth-otp-valor').waitFor({state:'visible'});}catch(x){console.log(nombre()+' estado del acceso:',await p.locator('#auth-status').textContent(),'· códigos pedidos:',cuenta.pedidos);throw x;}
 await p.locator('#auth-otp-valor').fill('482913');await p.locator('#auth-confirmar').click();
 await p.getByText('Error generating QR Code').waitFor();
}
const panelVisible=p=>p.locator('[data-salon]').first().waitFor({timeout:30000});
const errores=[],nombre=()=>motor===webkit?'WebKit':'Edge/Chromium';
async function recorrido(){
 cuenta.pedidos=cuenta.enroll=0;errores.length=0;await publicar('61cb2a6');
 // A) Caso del iPhone: solo el panel abierto, como el navegador integrado de la captura.
 let ctx=await contexto();let p=await ctx.newPage();
 await p.goto(base+'/');await p.waitForFunction(()=>navigator.serviceWorker.controller);await p.close();
 p=await ctx.newPage();p.on('pageerror',x=>errores.push(x.message));
 await entrarConCodigoViejo(p);assert.equal(cuenta.enroll,1);assert.equal(cuenta.pedidos,1);
 const cacheVieja=(await registro(p)).cachés;
 await publicar('b158896');assert.notEqual(sdk.b158896,sdk['61cb2a6']);
 await p.reload();await enEspera(p);
 // Recargar y «Actualizar» no salen del SW anterior: el error se repite con el SDK viejo.
 for(let i=0;i<2;i++){await p.reload();await p.getByText('Error generating QR Code').waitFor();}
 await p.locator('#recargar').click();await p.waitForTimeout(800);
 assert.equal(await p.getByText('Error generating QR Code').count(),1);
 assert.equal(await servido(p),sdk['61cb2a6'],'El SW anterior sigue entregando el SDK de 61cb2a6');
 const espera=await registro(p);assert.equal(espera.espera,true,'b158896 queda en espera indefinidamente');assert.ok(cacheVieja.every(c=>espera.cachés.includes(c)));
 assert.ok(cuenta.enroll>=3,'El cliente anterior vuelve a pedir la autenticadora');
 console.log(nombre()+' reproducido: con el SW de 61cb2a6, b158896 queda en espera; recargar y Actualizar repiten «Error generating QR Code».');

 await publicar('actual');
 // Esta recarga todavía la responde el SW anterior; la versión nueva recarga el panel al activarse.
 await p.reload();await panelVisible(p);
 const enrollAntes=cuenta.enroll;await p.waitForTimeout(1000);
 assert.equal(cuenta.enroll,enrollAntes,'La versión corregida no llama a MFA');assert.equal(cuenta.pedidos,1,'La sesión se conserva sin pedir otro código');
 const tras=await registro(p);assert.equal(tras.espera,false);assert.equal(tras.cachés.length,1);assert.ok(!cacheVieja.includes(tras.cachés[0]));
 assert.equal(await servido(p),sdk.actual);
 assert.equal(await p.getByText('Error generating QR Code').count(),0);
 assert.equal(await p.evaluate(()=>JSON.parse(atob(JSON.parse(localStorage.getItem('agendappx.auth')).access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).aal),'aal1');
 if(motor===chromium)await p.screenshot({path:fileURLToPath(new URL('../../imagenes/acceso-dueno/04-panel-tras-actualizar.png',import.meta.url)),animations:'disabled',clip:{x:0,y:0,width:390,height:580}});
 await ctx.setOffline(true);
 for(const ruta of ['/plataforma/','/']){await p.goto(base+ruta);assert.match(await p.title(),/Agendappx/,ruta);}
 await ctx.setOffline(false);await ctx.close();
 console.log(nombre()+' corregido: una recarga instala la versión nueva, recarga solo el panel y entra sin QR ni otro código; panel y agenda abren sin conexión.');

 // B) Con la agenda abierta y datos locales sin sincronizar no hay activación automática.
 await publicar('61cb2a6');
 ctx=await contexto();const agenda=await ctx.newPage();
 await agenda.goto(base+'/');await agenda.waitForFunction(()=>navigator.serviceWorker.controller);
 const cola=JSON.stringify({pending:[{id:'sin-sincronizar',foto:'datos-de-prueba'}]});
 await agenda.evaluate(async valor=>{localStorage.setItem('belleza.v1.sync',valor);document.cookie='prueba_sesion=conservada; path=/; SameSite=Lax';window.__sinRecargar=true;
  await new Promise((ok,mal)=>{const r=indexedDB.open('prueba-fotos',1);r.onupgradeneeded=()=>r.result.createObjectStore('fotos');r.onerror=()=>mal(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('fotos','readwrite');t.objectStore('fotos').put(new Uint8Array([1,2,3]),'pendiente');t.oncomplete=()=>{db.close();ok();};};});},cola);
 p=await ctx.newPage();p.on('pageerror',x=>errores.push(x.message));await entrarConCodigoViejo(p);
 await publicar('actual');
 await p.reload();await enEspera(p);
 await p.waitForTimeout(1500);assert.equal(await p.getByText('Error generating QR Code').count(),1,'Con la agenda abierta, el panel antiguo espera la confirmación');
 await agenda.locator('#pwa-update').waitFor({state:'visible'});assert.equal(await agenda.evaluate(()=>window.__sinRecargar),true);
 // Salida documentada para el dueño desde el código anterior: recuperación con regreso al panel.
 await p.goto(base+'/recuperar-acceso/?destino=/plataforma/');
 await Promise.all([p.waitForURL(base+'/plataforma/',{timeout:60000}),p.getByRole('button',{name:'Reparar y abrir Agendappx'}).click()]);
 await panelVisible(p);assert.equal(cuenta.pedidos,2);const enrollRecuperado=cuenta.enroll;
 assert.equal(await agenda.evaluate(()=>window.__sinRecargar),true,'La agenda no se recarga por la recuperación del panel');
 await agenda.locator('#pwa-update').waitFor({state:'visible'});
 const guardado=await datos(agenda);assert.deepEqual(guardado,{cola,auth:true,cookie:'prueba_sesion=conservada',foto:[1,2,3]});

 // C) Panel ya corregido y residente: su botón Actualizar instala la siguiente versión.
 const sw=join(sitio,'sw.js');await writeFile(sw,(await readFile(sw,'utf8')).replace(/ritmo-belleza-[0-9a-f]{16}/,'ritmo-belleza-0000000000000002'));
 await p.evaluate(()=>{window.__sinRecargar=true;return navigator.serviceWorker.getRegistration('/').then(r=>r.update());});
 await p.locator('#pwa-update').waitFor({state:'visible'});
 if(motor===chromium)await p.screenshot({path:fileURLToPath(new URL('../../imagenes/acceso-dueno/05-aviso-version-nueva.png',import.meta.url)),animations:'disabled',clip:{x:0,y:690,width:390,height:154}});
 await Promise.all([p.waitForEvent('load',{timeout:30000}),p.locator('#recargar').click()]);
 await panelVisible(p);assert.equal(await p.evaluate(()=>window.__sinRecargar),undefined,'El panel se recargó con el código nuevo');
 assert.deepEqual((await registro(p)).cachés,['ritmo-belleza-0000000000000002']);
 assert.equal(await agenda.evaluate(()=>window.__sinRecargar),true,'Otra pestaña con datos nunca se recarga sola');
 assert.deepEqual(await datos(agenda),guardado);
 for(const tema of ['light','dark']){await p.emulateMedia({colorScheme:tema});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await p.locator('#salir-dueno').click();await p.locator('#auth-destino').waitFor();
 assert.equal(cuenta.enroll,enrollRecuperado,'El panel corregido nunca llama a MFA');assert.equal(cuenta.pedidos,2);assert.deepEqual(errores,[]);
 await ctx.close();
 console.log(nombre()+': con la agenda abierta no hay activación automática; recuperación ?destino=/plataforma/ entra al panel; Actualizar del panel instala la versión siguiente; cola, foto, cookie y sesión intactas; sin recargar la agenda; salir funciona.');
}
// Edge (o BROWSER_CHANNEL) y WebKit en el mismo recorrido; si falta WebKit, la prueba falla.
try{
 for(const m of process.env.SAFARI_PRUEBA==='webkit'?[webkit]:[chromium,webkit]){
  motor=m;
  browser=await m.launch({headless:true,proxy:{server:'http://127.0.0.1:'+proxy.address().port},...(m===chromium?{channel:process.env.BROWSER_CHANNEL||'msedge'}:{})});
  try{externas.length=0;await recorrido();
   // Edge abre por su cuenta servicios propios (Bing, Office); el proxy los rechaza igualmente.
   assert.deepEqual(externas.filter(h=>/supabase/i.test(h)),[],'Ningún intento de conexión a Supabase');
   console.log(nombre()+': cero intentos hacia Supabase; '+externas.length+' conexiones externas del navegador rechazadas por el proxy local.');}catch(x){console.log(nombre()+': conexiones externas rechazadas por el proxy local:',externas);throw x;}finally{await browser.close();}
 }
}finally{
 proxy.closeAllConnections();proxy.close();server.closeAllConnections();server.close();await e.cerrar();
 if(!resolve(temp).startsWith(resolve(tmpdir())+sep))throw new Error('Temporal fuera del directorio permitido');
 await rm(temp,{recursive:true,force:true});
}
