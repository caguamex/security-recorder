import {abrirConexiones,abrirServicios,nuevaCita,seccion} from './ayudas-neutro.mjs';
import {elegirModo,elegirTema} from './ayudas-neutro.mjs';
// SDK real → rutas locales → Auth simulado → hook firmado → emisor simulado → RLS.
// Ninguna conexión de prueba llega a Supabase, WhatsApp, Railway o FiNeCi.
import {chromium} from 'playwright';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {entornoLogin,ids} from './login-whatsapp-entorno.mjs';
import {VerificadorJWT} from '../build/cuentas/jwt.js';
import {rutasAcceso} from '../build/cuentas/acceso.js';
import {rutasCuentas} from '../build/cuentas/http.js';
import {crearServidor} from '../build/http.js';
const e=await entornoLogin(),supabase='https://zkqwephmuflbuagevvxj.supabase.co',par=await generateKeyPair('ES256',{extractable:true}),jwk={...await exportJWK(par.publicKey),kid:'local',alg:'ES256'};
const jwt=new VerificadorJWT(supabase,{fetch:async()=>Response.json({keys:[jwk]})});
let quien='admin',sesionCambio=null,refrescos=0;
let base='',sid=randomUUID(),mfa=false,phone='',correoEnviado=false,demora=false,publicoCreado=false,ahora=Date.now();const factor='ffffffff-1111-4111-8111-111111111111';
async function token(aal='aal1'){return new SignJWT({session_id:sid,aal,role:'authenticated',amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)},...(aal==='aal2'?[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]:[])]}).setProtectedHeader({alg:'ES256',kid:'local'}).setSubject(ids[quien]).setIssuer(supabase+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey);}
const usuario=()=>({id:ids[quien],email:'admin@example.test',phone,aud:'authenticated',role:'authenticated',factors:mfa?[{id:factor,factor_type:'totp',status:'verified'}]:[]});
async function sesion(aal='aal1'){return {access_token:await token(aal),refresh_token:'solo-pruebas',token_type:'bearer',expires_in:3600,user:usuario()};}
async function nuevaSesion(){sid=randomUUID();const c=await e.pool.connect();try{await c.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[sid,ids[quien]]);}finally{c.release();}return sesion();}
const proveedor=async(input,init)=>{const u=new URL(input),d=JSON.parse(init.body);let r;
 if(u.pathname==='/auth/v1/otp'){
  assert.equal(d.create_user,false);publicoCreado||=d.create_user!==false;
  if(d.phone){if(demora)return new Promise(()=>{});const v=e.evento(d.phone,'482913',{user:{id:ids[quien],phone:d.phone}});await e.codigos.entregar(v.raw,v.headers);}
  else {assert.equal(d.email,'admin@example.test');correoEnviado=true;}r={};
 }else if(u.pathname==='/auth/v1/user'&&init.method==='PUT'){
  assert.ok(init.headers.Authorization);const v=e.evento('', '482913',{user:{id:ids.admin,phone:'',phone_change:d.phone},sms:{otp:'482913',phone:d.phone}});await e.codigos.entregar(v.raw,v.headers);r=usuario();
 }else if(u.pathname==='/auth/v1/verify'){
  if(d.type==='phone_change'){assert.equal(d.token,'482913');phone=d.phone.replace('+','');const anterior=sid;r=await nuevaSesion();sesionCambio=sid;sid=anterior;}
  else if(d.token_hash==='a'.repeat(64))r=await nuevaSesion();
  else if(d.token==='482913'&&d.type==='sms'){phone=d.phone.replace('+','');r=await nuevaSesion();}
  else if(d.token==='666777'&&d.type==='email'&&correoEnviado)r=await nuevaSesion();
  else return Response.json({msg:'Código incorrecto'},{status:400});
 }else throw new Error('Auth inesperado');return Response.json(r);
};
const acceso={recuperacionHash:createHash('sha256').update('a'.repeat(64)).digest('hex'),recuperacionUsuario:ids.admin,habilitado:true,correo:true,key:e.key,origen:'',supabaseURL:supabase,llavePublica:'sb_publishable_prueba_local',salones:new Set([ids.salon]),ip:()=> 'ip-navegador',fetch:proveedor};Object.defineProperty(acceso,'origen',{get:()=>base});
const cuentas={habilitado:true,supabaseURL:supabase,llavePublica:acceso.llavePublica,salones:acceso.salones,migracionUsuarioId:ids.admin,acceso:{whatsapp:true,correo:true},get origen(){return base;},rutasAcceso:rutasAcceso(e.poolAPI,jwt,acceso)};
const server=crearServidor({salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})},'a'.repeat(40),fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{cuentas:rutasCuentas(e.poolAPI,jwt,cuentas)});
server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),errores=[];const capturas=fileURLToPath(new URL('../../imagenes/login-whatsapp/',import.meta.url));await mkdir(capturas,{recursive:true});
async function contexto(){const c=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX'});await c.route(supabase+'/**',async route=>{const req=route.request(),u=new URL(req.url());let data,status=200;
 if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,PUT,GET,DELETE,OPTIONS'}});return;}
 if(u.pathname==='/auth/v1/token'){assert.equal(req.postDataJSON().refresh_token,'solo-pruebas');refrescos++;data=await sesion(mfa?'aal2':'aal1');}
 else if(u.pathname==='/auth/v1/user')data=usuario();
 else if(u.pathname==='/auth/v1/factors'&&req.method()==='POST')data={id:factor,type:'totp',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>',secret:'SOLOPRUEBA',uri:'otpauth://totp/prueba'}};
 else if(u.pathname.endsWith('/challenge'))data={id:'reto-local',type:'totp',expires_at:Math.floor(Date.now()/1000)+60};
 else if(u.pathname.endsWith('/verify')){assert.equal(req.postDataJSON().code,'123456');mfa=true;data=await sesion('aal2');}
 else if(u.pathname==='/auth/v1/logout')data={};
 else {status=503;data={msg:'Esta ruta debe pasar por el control de Agendappx'};}
 await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});
 });return c;}
async function abrir(p){await p.goto(base);await p.waitForFunction(()=>window.AgendappxCuentas?.listo);await p.getByRole('tab',{name:'Negocio',exact:true}).click();await abrirConexiones(p);await p.getByRole('button',{name:/Sincronización/}).click();await p.locator('#sync-activate').click();await p.locator('#auth-destino').waitFor();}
try{
 const c=await contexto(),p=await c.newPage();p.on('pageerror',x=>errores.push(x.message));await abrir(p);
 for(const width of [390,768,1440]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:capturas+'entrada-'+width+'.png',animations:'disabled'});}
 await p.setViewportSize({width:390,height:844});await p.locator('#auth-destino').fill('5511111111');await p.locator('#auth-pedir').click();await p.locator('#auth-otp-code').waitFor({state:'visible'});assert.equal(e.envios.length,1);
 await p.locator('#auth-otp-valor').fill('482913');await p.locator('#auth-confirmar').click();await p.locator('#auth-code').waitFor({state:'visible'});assert.doesNotMatch(await p.locator('#auth-status').textContent(),/Comprobando/);assert.equal(await p.evaluate(()=>window.AgendappxCuentas.sesion()),null);
 await p.locator('#auth-code').fill('123456');await p.locator('#auth-verificar').click();await p.getByText('Acceso verificado.',{exact:true}).waitFor();assert.equal(await p.evaluate(async()=>(await window.AgendappxCuentas.sesion())?.usuarioId),ids.admin);assert.equal(await p.locator('#auth-secret').textContent(),'');assert.equal(publicoCreado,false);
 assert.equal(await p.evaluate(()=>Object.entries(localStorage).some(([k,v])=>k!=='agendappx.auth'&&(v.includes('482913')||v.includes('solo-pruebas')))),false);
 await p.getByRole('button',{name:'Listo',exact:true}).click();await p.getByRole('tab',{name:'Negocio',exact:true}).click();await elegirModo(p,/Dark/);await p.evaluate(()=>document.dispatchEvent(new Event('agendappx:abrir-acceso')));await p.locator('#auth-salir').waitFor();await p.locator('#auth-salir').click();await p.getByText('Sesión cerrada.',{exact:true}).waitFor();await p.getByRole('button',{name:'Listo',exact:true}).click();await p.getByRole('tab',{name:'Negocio',exact:true}).click();await elegirModo(p,/Dark/);await p.waitForFunction(()=>document.documentElement.dataset.modo==='dark');await p.evaluate(()=>document.dispatchEvent(new Event('agendappx:abrir-acceso')));await p.locator('#auth-destino').waitFor({state:'visible'});assert.equal(await p.evaluate(()=>document.documentElement.dataset.modo),'dark');await p.screenshot({path:capturas+'entrada-dark.png',animations:'disabled'});
 await c.close();
 // Correo usa el mismo UUID y nunca crea una cuenta a partir del número.
 const b=await contexto(),q=await b.newPage();await abrir(q);await q.locator('#auth-correo').click();await q.locator('#auth-destino').fill('admin@example.test');await q.locator('#auth-pedir').click();await q.locator('#auth-otp-code').waitFor({state:'visible'});await q.locator('#auth-otp-valor').fill('666777');await q.locator('#auth-confirmar').click();await q.locator('#auth-code').waitFor({state:'visible'});await q.locator('#auth-code').fill('123456');await q.locator('#auth-verificar').click();await q.getByText('Acceso verificado.',{exact:true}).waitFor();assert.equal(await q.evaluate(async()=>(await window.AgendappxCuentas.sesion()).usuarioId),ids.admin);await b.close();
 // El propietario vincula su teléfono desde su sesión sin reemplazar identidad.
 phone='';const d=await contexto(),r=await d.newPage();await r.goto(base+'/#acceso-admin='+'a'.repeat(64));await r.locator('#auth-entrar').waitFor();await r.locator('#auth-entrar').click();await r.locator('#auth-code').waitFor({state:'visible'});await r.locator('#auth-code').fill('123456');await r.locator('#auth-verificar').click();await r.locator('#auth-vincular-numero').waitFor({state:'visible'});await r.locator('#auth-vincular-numero').click();await r.locator('#auth-destino').fill('5522222222');await r.locator('#auth-pedir').click();await r.locator('#auth-otp-code').waitFor({state:'visible'});await r.locator('#auth-otp-valor').fill('482913');await r.locator('#auth-confirmar').click();await r.getByText('Acceso verificado. Pulsa Listo para abrir tu agenda.',{exact:true}).waitFor();await r.waitForFunction(()=>document.querySelector('#auth-otp').hidden);assert.equal(phone,'525522222222');assert.equal(await r.evaluate(async()=>(await window.AgendappxCuentas.sesion()).usuarioId),ids.admin);assert.equal((await r.evaluate(()=>window.AgendappxCuentas.sesion())).aal,'aal2');assert.equal(refrescos,1);assert.notEqual(sid,sesionCambio);assert.equal(Number((await e.solicitudes.usar(c=>c.query('SELECT count(*) AS n FROM ritmo.acceso_sesiones WHERE sesion_id=$1',[sesionCambio]))).rows[0].n),0);await d.close();
 // Recepción entra sin imponerle el MFA de Admin.
 quien='recepcion';mfa=false;phone='';const staff=await contexto(),ps=await staff.newPage();await abrir(ps);await ps.locator('#auth-destino').fill('5533333333');await ps.locator('#auth-pedir').click();await ps.locator('#auth-otp-code').waitFor({state:'visible'});await ps.locator('#auth-otp-valor').fill('482913');await ps.locator('#auth-confirmar').click();await ps.getByText('Acceso verificado.',{exact:true}).waitFor();assert.equal((await ps.evaluate(()=>window.AgendappxCuentas.sesion())).rol,'recepcion');assert.equal(await ps.locator('#auth-factor').isVisible(),false);await staff.close();
 // A los veinte segundos ofrece correo aunque el envío aún no haya respondido.
 const lento=await contexto(),pl=await lento.newPage();await pl.clock.install();let terminar;const retenido=new Promise(r=>{terminar=r;});await lento.route(base+'/api/acceso/solicitar',async route=>{await retenido;await route.fulfill({status:503,contentType:'application/json',body:'{"error":"Prueba de desconexión"}'});});await abrir(pl);await pl.locator('#auth-destino').fill('5544444444');await pl.locator('#auth-pedir').click();await pl.clock.fastForward(20001);await pl.getByRole('button',{name:'¿No te llegó? Recibirlo por correo',exact:true}).waitFor();terminar();await lento.close();
 assert.deepEqual(errores,[]);console.log('Login: SDK real, WhatsApp, correo, Admin MFA, mismo UUID, vinculación propia y White/Dark 390/768/1440 verificados sin envío real.');
}finally{await browser.close();await new Promise(r=>server.close(r));await e.cerrar();}
