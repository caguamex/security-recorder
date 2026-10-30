// SDK real → rutas locales → Auth simulado → hook firmado → emisor simulado → RLS.
// Ninguna conexión de prueba llega a Supabase, WhatsApp, Railway o FiNeCi.
import {chromium} from 'playwright';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile} from 'node:fs/promises';
import {randomUUID,createHash,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {entornoLogin,ids} from './login-whatsapp-entorno.mjs';
import {VerificadorJWT} from '../build/cuentas/jwt.js';
import {rutasRegistro} from '../build/cuentas/registro.js';
import {rutasAcceso} from '../build/cuentas/acceso.js';
import {rutasCuentas} from '../build/cuentas/http.js';
import {crearServidor} from '../build/http.js';
const e=await entornoLogin(),supabase='https://zkqwephmuflbuagevvxj.supabase.co',par=await generateKeyPair('ES256',{extractable:true}),jwk={...await exportJWK(par.publicKey),kid:'local',alg:'ES256'};
const jwt=new VerificadorJWT(supabase,{fetch:async()=>Response.json({keys:[jwk]})});
{const c=await e.pool.connect();try{await c.query(await readFile(new URL('../../supabase/migrations/20261029174619_registro_whatsapp.sql',import.meta.url),'utf8'));}finally{c.release();}}
let quien='admin',sesionCambio=null,refrescos=0;
let base='',sid=randomUUID(),mfa=false,phone='',correoEnviado=false,demora=false,publicoCreado=false,ahora=Date.now();const factor='ffffffff-1111-4111-8111-111111111111';
async function token(aal='aal1'){return new SignJWT({session_id:sid,aal,role:'authenticated',amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)},...(aal==='aal2'?[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]:[])]}).setProtectedHeader({alg:'ES256',kid:'local'}).setSubject(ids[quien]).setIssuer(supabase+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey);}
const usuario=()=>({id:ids[quien],email:'admin@example.test',phone,...(phone?{phone_confirmed_at:new Date().toISOString()}:{}),aud:'authenticated',role:'authenticated',factors:mfa?[{id:factor,factor_type:'totp',status:'verified'}]:[]});
async function sesion(aal='aal1'){return {access_token:await token(aal),refresh_token:'solo-pruebas',token_type:'bearer',expires_in:3600,user:usuario()};}
async function nuevaSesion(){sid=randomUUID();const c=await e.pool.connect();try{await c.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[sid,ids[quien]]);}finally{c.release();}return sesion();}
const proveedor=async(input,init)=>{const u=new URL(input),d=JSON.parse(init.body);let r;
 if(u.pathname==='/auth/v1/otp'){e.avanzar(Math.max(0,Date.now()-e.now()));
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
const acceso={registro:true,recuperacionHash:createHash('sha256').update('a'.repeat(64)).digest('hex'),recuperacionUsuario:ids.admin,habilitado:true,correo:true,key:e.key,origen:'',supabaseURL:supabase,llavePublica:'sb_publishable_prueba_local',salones:new Set([ids.salon]),ip:()=> 'ip-navegador',fetch:proveedor};Object.defineProperty(acceso,'origen',{get:()=>base});
const cuentas={habilitado:true,supabaseURL:supabase,llavePublica:acceso.llavePublica,salones:acceso.salones,migracionUsuarioId:ids.admin,acceso:{whatsapp:true,correo:true},get origen(){return base;},rutasAcceso:rutasAcceso(e.poolAPI,jwt,acceso),registro:{habilitado:true,turnstileSiteKey:'sitio-local'},rutasRegistro:rutasRegistro(e.poolAPI,jwt,{habilitado:true,key:e.key,operacionKey:randomBytes(32).toString('base64'),turnstileKey:'secreto-local',turnstileSiteKey:'sitio-local',get origen(){return base;},supabaseURL:supabase,llavePublica:acceso.llavePublica,ip:()=> 'ip-registro-'+quien,fetch:async(u,init)=>{if(u.endsWith('/siteverify'))return Response.json({success:true,hostname:'127.0.0.1',action:'registro'});if(u.endsWith('/agendappx-registro'))return Response.json({preparada:true});if(u.endsWith('/auth/v1/user'))return Response.json(usuario());throw new Error('Red inesperada en registro');}})};
const server=crearServidor({salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})},'a'.repeat(40),fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{cuentas:rutasCuentas(e.poolAPI,jwt,cuentas)});
server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),errores=[];const capturas=fileURLToPath(new URL('../../imagenes/registro-whatsapp/',import.meta.url));await mkdir(capturas,{recursive:true});
async function contexto(){const c=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX'});await c.route('https://challenges.cloudflare.com/**',route=>route.fulfill({contentType:'application/javascript',body:'window.turnstile={render:function(el,config){el.textContent="Seguridad verificada (prueba local)";config.callback("solo-local");return 1;},reset:function(){}};'}));await c.route(supabase+'/**',async route=>{const req=route.request(),u=new URL(req.url());let data,status=200;
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
async function abrir(p){await p.goto(base);await p.waitForFunction(()=>window.AgendappxCuentas?.listo);await p.getByRole('tab',{name:'Negocio',exact:true}).click();await p.getByRole('button',{name:/Sincronización/}).click();await p.locator('#sync-activate').click();await p.locator('#auth-destino').waitFor();}
try{
 quien='nueva';mfa=false;phone='';const c=await contexto(),p=await c.newPage();p.on('pageerror',x=>errores.push(x.message));await p.goto(base+'/#registro');await p.locator('#registro-formulario').waitFor({state:'visible'});
 for(const width of [390,768,1440]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:capturas+'registro-'+width+'.png',animations:'disabled'});}
 await p.setViewportSize({width:390,height:844});await p.locator('#registro-nombre').fill('Mariana');await p.locator('#registro-telefono').fill('5511111111');await p.locator('#registro-salon').fill('Salón Mariana');await p.locator('#registro-consentimiento').check();await p.locator('#registro-crear').click();await p.locator('#auth-otp-code').waitFor({state:'visible'});
 assert.equal(e.envios.length,1);assert.match(e.envios[0].texto,/Tu código de Agendappx/);await p.locator('#auth-otp-valor').fill('482913');await p.locator('#auth-confirmar').click();await p.locator('#auth-code').waitFor({state:'visible'});assert.equal(await p.evaluate(()=>window.AgendappxCuentas.sesion()),null);
 await p.locator('#auth-code').fill('123456');await p.locator('#auth-verificar').click();await p.getByText('Acceso verificado.',{exact:true}).waitFor();await p.locator('#registro-equipo').waitFor({state:'visible'});const actual=await p.evaluate(()=>window.AgendappxCuentas.sesion());assert.equal(actual.usuarioId,ids.nueva);assert.notEqual(actual.negocioId,ids.salon);assert.equal(actual.rol,'admin');
 assert.equal(await p.evaluate(()=>sessionStorage.getItem('agendappx.registro')),null);const tokenOwner=await p.evaluate(()=>JSON.parse(localStorage.getItem('agendappx.auth')).access_token);
 const snap=await fetch(base+'/api/negocios/'+actual.negocioId+'/datos/estado',{headers:{Authorization:'Bearer '+tokenOwner}});const datos=await snap.json();assert.equal(snap.status,200,JSON.stringify(datos));assert.equal(datos.records.length,1);assert.equal(datos.records[0].data.negocio,'Salón Mariana');
 await p.locator('#registro-invitada').fill('Alejandra');await p.locator('#registro-invitar').click();await p.locator('#registro-enlace-panel').waitFor({state:'visible'});const enlace=await p.locator('#registro-enlace').inputValue();assert.match(enlace,/#invitacion=/);await p.screenshot({path:capturas+'equipo-390.png',animations:'disabled'});
 // Otro dispositivo se registra con su propio número y la invitación al mismo salón.
 quien='otra';mfa=false;phone='';const c2=await contexto(),q=await c2.newPage();q.on('pageerror',x=>errores.push(x.message));await q.goto(enlace);await q.locator('#registro-formulario').waitFor({state:'visible'});assert.match(await q.locator('#registro-explicacion').textContent(),/Salón Mariana/);assert.equal(await q.locator('#registro-salon').isVisible(),false);
 await q.locator('#registro-nombre').fill('Alejandra');await q.locator('#registro-telefono').fill('5522222222');await q.locator('#registro-consentimiento').check();await q.locator('#registro-crear').click();await q.locator('#auth-otp-code').waitFor({state:'visible'});await q.locator('#auth-otp-valor').fill('482913');await q.locator('#auth-confirmar').click();await q.locator('#auth-code').waitFor({state:'visible'});await q.locator('#auth-code').fill('123456');await q.locator('#auth-verificar').click();await q.getByText('Acceso verificado.',{exact:true}).waitFor();const invitada=await q.evaluate(()=>window.AgendappxCuentas.sesion());assert.equal(invitada.negocioId,actual.negocioId);assert.equal(invitada.rol,'admin');assert.notEqual(invitada.usuarioId,actual.usuarioId);
 await q.evaluate(()=>document.documentElement.dataset.modo='dark');await q.screenshot({path:capturas+'equipo-dark-390.png',animations:'disabled'});assert.equal(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errores,[]);assert.equal(publicoCreado,false);await c.close();await c2.close();console.log('Registro real en navegador local: dos números, código automático, CAPTCHA, MFA, salón aislado e invitación de administradora, White/Dark 390/768/1440. Sin mensajes reales.');
}finally{await browser.close();await new Promise(r=>server.close(r));await e.cerrar();}
