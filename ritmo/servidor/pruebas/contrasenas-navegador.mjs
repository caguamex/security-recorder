import {abrirConexiones} from './ayudas-neutro.mjs';
// SDK real → rutas locales → Auth simulado (contraseñas en memoria) → RLS.
// Recorre: registro en 4 pasos, entrar con usuario o WhatsApp, CAPTCHA, restablecer y accesos del equipo.
// Ninguna conexión de prueba llega a Supabase, WhatsApp, Railway o FiNeCi.
import {chromium} from 'playwright';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {entornoLogin,ids} from './login-whatsapp-entorno.mjs';
import {VerificadorJWT} from '../build/cuentas/jwt.js';
import {rutasRegistro} from '../build/cuentas/registro.js';
import {rutasAcceso} from '../build/cuentas/acceso.js';
import {rutasContrasenas} from '../build/cuentas/contrasenas.js';
import {rutasCuentas} from '../build/cuentas/http.js';
import {crearServidor} from '../build/http.js';
import {intermediario} from '../../supabase/functions/agendappx-registro/intermediario.mjs';
const e=await entornoLogin(),supabase='https://zkqwephmuflbuagevvxj.supabase.co',par=await generateKeyPair('ES256',{extractable:true}),jwk={...await exportJWK(par.publicKey),kid:'local',alg:'ES256'};
const jwt=new VerificadorJWT(supabase,{fetch:async()=>Response.json({keys:[jwk]})});
const sql=async(q,a)=>{const c=await e.pool.connect();try{return await c.query(q,a);}finally{c.release();}};
await sql(await readFile(new URL('../../supabase/migrations/20261029174619_registro_whatsapp.sql',import.meta.url),'utf8'));
await sql('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS email text');
await sql(await readFile(new URL('../../supabase/migrations/20261030160000_usuarios_contrasena.sql',import.meta.url),'utf8'));
// Estado del Auth simulado: quién tiene la sesión del navegador y sus contraseñas.
let base='',actual={id:ids.nueva,phone:'',email:''},sid=randomUUID(),mfa=new Set(),aalActual='aal1';const claves=new Map(),factor='ffffffff-1111-4111-8111-111111111111';
async function token(aal=aalActual){return new SignJWT({session_id:sid,aal,role:'authenticated'}).setProtectedHeader({alg:'ES256',kid:'local'}).setSubject(actual.id).setIssuer(supabase+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey);}
const usuario=()=>({id:actual.id,phone:actual.phone,email:actual.email,...(actual.phone?{phone_confirmed_at:new Date().toISOString()}:{}),aud:'authenticated',role:'authenticated',factors:mfa.has(actual.id)?[{id:factor,factor_type:'totp',status:'verified'}]:[]});
async function sesion(aal='aal1'){aalActual=aal;return {access_token:await token(aal),refresh_token:'solo-pruebas',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:usuario()};}
async function nuevaSesion(u){actual=u;sid=randomUUID();await sql('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[sid,u.id]);return sesion();}
const porTelefono=async t=>(await sql('SELECT id,phone,email FROM auth.users WHERE phone=$1',[t])).rows[0];
// Auth del lado del servidor (Worker → Supabase).
const auth=async(input,init={})=>{const u=new URL(input),d=init.body?JSON.parse(init.body):{};
 if(u.pathname==='/auth/v1/otp'){e.avanzar(Math.max(0,Date.now()-e.now()));assert.equal(d.create_user,false);const f=await porTelefono(d.phone.replace('+',''))||{id:ids.nueva};const v=e.evento(d.phone,'482913',{user:{id:f.id,phone:d.phone}});await e.codigos.entregar(v.raw,v.headers);return Response.json({});}
 if(u.pathname==='/auth/v1/verify'){if(d.token!=='482913')return Response.json({msg:'Código incorrecto'},{status:400});const tel=d.phone.replace('+','');let f=await porTelefono(tel);if(!f){await sql('UPDATE auth.users SET phone=$1 WHERE id=$2',[tel,ids.nueva]);f={id:ids.nueva,phone:tel,email:null};}return Response.json(await nuevaSesion({id:f.id,phone:f.phone,email:f.email||''}));}
 if(u.pathname==='/auth/v1/token'&&u.search==='?grant_type=password'){const f=(await sql(d.phone?'SELECT id,phone,email FROM auth.users WHERE phone=$1':'SELECT id,phone,email FROM auth.users WHERE email=$1',[d.phone?d.phone.replace('+',''):d.email])).rows[0];
  if(!f||claves.get(f.id)!==d.password)return Response.json({error_code:'invalid_credentials'},{status:400});return Response.json(await nuevaSesion({id:f.id,phone:f.phone||'',email:f.email||''}));}
 const yo=await jwt.verificar((init.headers?.Authorization||'').slice(7));
 if(u.pathname==='/auth/v1/user'&&init.method==='PUT'){
  // Supabase Auth exige AAL2 cuando la cuenta ya tiene un factor MFA verificado.
  if(mfa.has(yo.usuarioId)&&yo.aal!=='aal2')return Response.json({error_code:'insufficient_aal'},{status:401});
  if(claves.get(yo.usuarioId)===d.password)return Response.json({error_code:'same_password'},{status:422});claves.set(yo.usuarioId,d.password);return Response.json(usuario());}
 if(u.pathname==='/auth/v1/user')return Response.json({...usuario(),id:yo.usuarioId});
 if(u.pathname==='/auth/v1/logout'){if(u.search==='?scope=others')await sql('DELETE FROM auth.sessions WHERE user_id=$1 AND id<>$2',[yo.usuarioId,yo.sesionId]);return new Response(null,{status:204});}
 throw new Error('Auth inesperado '+input);};
const operacionKey=randomBytes(32).toString('base64');
const edge=intermediario({key:operacionKey,url:supabase,adminKey:'admin-solo-prueba',fetch:async(u,init)=>{const p=new URL(u).pathname.replace('/auth/v1/admin/',''),d=init.body?JSON.parse(init.body):{};
 if(p==='users'&&init.method==='POST'){if(d.phone)return Response.json({id:ids.nueva});const id=randomUUID();await sql('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,d.email]);claves.set(id,d.password);return Response.json({id});}
 const id=p.split('/')[1],f=(await sql('SELECT id,phone,email FROM auth.users WHERE id=$1',[id])).rows[0];if(init.method==='GET')return Response.json(f);claves.set(id,d.password);return Response.json(f);}});
const servidorFetch=async(u,init)=>{if(u.endsWith('/siteverify'))return Response.json({success:true,hostname:'127.0.0.1',action:JSON.parse(init.body).response==='captcha-acceso'?'acceso':'registro'});if(u.endsWith('/agendappx-registro'))return edge(new Request(u,init));return auth(u,init);};
const comun={key:e.key,operacionKey,turnstileKey:'secreto-local',turnstileSiteKey:'sitio-local',get origen(){return base;},supabaseURL:supabase,llavePublica:'sb_publishable_prueba_local',fetch:servidorFetch};
const acceso={registro:true,habilitado:true,correo:false,key:e.key,get origen(){return base;},supabaseURL:supabase,llavePublica:comun.llavePublica,salones:new Set([ids.salon]),ip:()=> 'ip-navegador',fetch:auth};
const cuentas={habilitado:true,supabaseURL:supabase,llavePublica:comun.llavePublica,salones:acceso.salones,migracionUsuarioId:ids.admin,acceso:{whatsapp:true,correo:false},get origen(){return base;},
 rutasAcceso:rutasAcceso(e.poolAPI,jwt,acceso),registro:{habilitado:true,turnstileSiteKey:'sitio-local'},
 rutasRegistro:rutasRegistro(e.poolAPI,jwt,{...comun,habilitado:true,get origen(){return base;},ip:()=> 'ip-registro'}),
 rutasContrasenas:rutasContrasenas(e.poolAPI,jwt,{...comun,habilitado:true,get origen(){return base;},ip:()=> 'ip-contrasena'})};
const server=crearServidor({salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})},'a'.repeat(40),fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{cuentas:rutasCuentas(e.poolAPI,jwt,cuentas)});
server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),errores=[];const capturas=fileURLToPath(new URL('../../imagenes/contrasena-equipo/',import.meta.url));await mkdir(capturas,{recursive:true});
let captchaVisto=0;
async function contexto(modo='light'){const c=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX',colorScheme:modo});
 await c.route('https://challenges.cloudflare.com/**',route=>route.fulfill({contentType:'application/javascript',body:'window.turnstile={render:function(el,config){el.textContent="Seguridad verificada (prueba local)";config.callback(config.action==="acceso"?"captcha-acceso":"registro");return 1;},reset:function(){}};'}));
 await c.route(supabase+'/**',async route=>{const req=route.request(),u=new URL(req.url());let data,status=200;
  if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,PUT,GET,DELETE,OPTIONS'}});return;}
  if(u.pathname==='/auth/v1/token'){data=await sesion(mfa.has(actual.id)&&aalActual==='aal2'?'aal2':'aal1');}
  else if(u.pathname==='/auth/v1/user')data=usuario();
  else if(u.pathname==='/auth/v1/factors'&&req.method()==='POST')data={id:factor,type:'totp',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>',secret:'SOLOPRUEBA',uri:'otpauth://totp/prueba'}};
  else if(u.pathname.endsWith('/challenge'))data={id:'reto-local',type:'totp',expires_at:Math.floor(Date.now()/1000)+60};
  else if(u.pathname.endsWith('/verify')){assert.equal(req.postDataJSON().code,'123456');mfa.add(actual.id);data=await sesion('aal2');}
  else if(u.pathname==='/auth/v1/logout')data={};
  else {status=503;data={msg:'Esta ruta debe pasar por el control de Agendappx'};}
  await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});});
 const p=await c.newPage();p.on('pageerror',x=>errores.push(x.message));return {c,p};}
async function abrir(p){await p.goto(base);await p.waitForFunction(()=>window.AgendappxCuentas?.listo);await p.getByRole('tab',{name:'Negocio',exact:true}).click();await abrirConexiones(p);await p.getByRole('button',{name:/Sincronización/}).click();await p.locator('#sync-activate').click();await p.locator('#auth-clave, #auth-otp').first().waitFor();}
const foto=(p,n)=>p.screenshot({path:capturas+n+'.png',animations:'disabled'});
const texto=p=>p.locator('#auth-status').innerText();
try{
 // 1) Registro en 4 pasos: usuario y contraseña → WhatsApp → código → datos del salón (+ MFA de Admin).
 {const {c,p}=await contexto();await p.goto(base+'/#registro');await p.locator('#registro-paso-cuenta').waitFor({state:'visible'});
  await p.locator('#registro-usuario').fill('Mariana.Salon');await p.locator('#registro-pass').fill('Mariana-2026');await p.locator('#registro-pass2').fill('Mariana-2026');
  await p.waitForFunction(()=>document.querySelector('#auth-status')?.textContent==='Usuario disponible.');await foto(p,'01-registro-cuenta');
  await p.locator('#registro-continuar').click();await p.locator('#registro-paso-whatsapp').waitFor({state:'visible'});
  assert.equal(await p.evaluate(()=>JSON.stringify(sessionStorage)+JSON.stringify(localStorage)).then(s=>s.includes('Mariana-2026')),false);
  await p.locator('#registro-telefono').fill('5511111111');await p.locator('#registro-consentimiento').check();await foto(p,'02-registro-whatsapp');
  await p.locator('#registro-crear').click();await p.locator('#auth-otp-code').waitFor({state:'visible'});await foto(p,'03-registro-codigo');
  await p.locator('#auth-otp-valor').fill('482913');await p.locator('#auth-confirmar').click();await p.locator('#registro-salon-form').waitFor({state:'visible'});
  assert.equal(claves.get(ids.nueva),'Mariana-2026');assert.equal((await sql("SELECT usuario FROM ritmo.usuarios_acceso WHERE usuario_id=$1",[ids.nueva])).rows[0].usuario,'mariana.salon');
  await p.locator('#registro-s-nombre').fill('Mariana');await p.locator('#registro-s-salon').fill('Salón Mariana');await foto(p,'04-registro-salon');
  await p.locator('#registro-s-crear').click();await p.locator('#auth-code').waitFor({state:'visible'});await p.locator('#auth-code').fill('123456');await p.locator('#auth-verificar').click();
  await p.waitForFunction(()=>/Acceso verificado/.test(document.querySelector('#auth-status')?.textContent||''));
  const n=(await sql("SELECT n.nombre,l.slug FROM ritmo.miembros m JOIN ritmo.negocios n ON n.id=m.negocio_id JOIN ritmo.negocios_enlaces l ON l.negocio_id=n.id WHERE m.usuario_id=$1",[ids.nueva])).rows[0];
  assert.deepEqual(n,{nombre:'Salón Mariana',slug:'salon-mariana'});await c.close();}
 // 2) Entrar con usuario y contraseña; CAPTCHA desde el 3.er fallo.
 {const {c,p}=await contexto();await abrir(p);await foto(p,'05-entrar');
  for(let i=0;i<3;i++){await p.locator('#auth-cuenta').fill('mariana.salon');await p.locator('#auth-pass').fill('Equivocada-1');await p.locator('#auth-clave-entrar').click();await p.waitForFunction(()=>/incorrectos|verificación/.test(document.querySelector('#auth-status')?.textContent||''));await p.locator('#auth-clave-entrar:not([disabled])').waitFor();await p.evaluate(()=>{document.querySelector('#auth-status').textContent='';});}
  // Tras el 3.er error la verificación aparece sola, antes del siguiente intento.
  await p.locator('#auth-clave-captcha').waitFor({state:'visible'});assert.match(await texto(p).catch(()=>''),/^$/);await foto(p,'06-entrar-captcha');
  await p.locator('#auth-pass').fill('Mariana-2026');await p.locator('#auth-clave-entrar').click();await p.locator('#auth-code').waitFor({state:'visible'});await p.locator('#auth-code').fill('123456');await p.locator('#auth-verificar').click();
  await p.waitForFunction(()=>/Acceso verificado/.test(document.querySelector('#auth-status')?.textContent||''));assert.equal(await p.locator('#auth-nueva').isVisible(),false);
  // 3) Dar acceso con usuario: contraseña temporal para Sofía.
  await p.locator('#registro-u-nombre').fill('Sofía');await p.locator('#registro-u-usuario').fill('sofia.salon');await p.locator('#registro-u-crear').click();await p.locator('#registro-credencial').waitFor({state:'visible'});
  const temporal=await p.locator('#registro-c-clave').innerText();assert.match(temporal,/^[A-Z][a-z]+-[A-Z][a-z]+-\d{3}-[A-Z][a-z]+$/);await p.locator('#registro-credencial').scrollIntoViewIfNeeded();await foto(p,'07-equipo-acceso');
  await c.close();
  // 4) Sofía entra con la temporal y crea la suya; después ve solo su rol.
  const s=await contexto('dark');await abrir(s.p);await s.p.locator('#auth-cuenta').fill('sofia.salon');await s.p.locator('#auth-pass').fill(temporal);await s.p.locator('#auth-clave-entrar').click();
  await s.p.locator('#auth-nueva').waitFor({state:'visible'});assert.equal(await s.p.locator('#auth-nueva-despues').isVisible(),false);await foto(s.p,'08-temporal-nueva-dark');
  await s.p.locator('#auth-nueva-pass').fill('Sofia-Propia-7');await s.p.locator('#auth-nueva-pass2').fill('Sofia-Propia-7');await s.p.locator('#auth-nueva-guardar').click();
  await s.p.waitForFunction(()=>/Acceso verificado/.test(document.querySelector('#auth-status')?.textContent||''));await s.c.close();}
 // 5) Restablecer con el usuario: código al WhatsApp de la cuenta y contraseña nueva.
 {const {c,p}=await contexto();await abrir(p);await p.locator('#auth-cuenta').fill('mariana.salon');await p.locator('#auth-olvide').click();
  await p.locator('#auth-otp').waitFor({state:'visible'});assert.equal(await p.locator('#auth-destino').inputValue(),'mariana.salon');await foto(p,'09-restablecer');
  await p.locator('#auth-pedir').click();await p.locator('#auth-otp-code').waitFor({state:'visible'});assert.match(e.envios.at(-1).tel,/5511111111/);
  await p.locator('#auth-otp-valor').fill('482913');await p.locator('#auth-confirmar').click();
  // La dueña ya tiene MFA: debe completar AAL2 antes de enviar la contraseña a Auth.
  await p.locator('#auth-code').waitFor({state:'visible'});assert.equal(await p.locator('#auth-nueva').isVisible(),false);
  assert.equal(claves.get(ids.nueva),'Mariana-2026');
  await foto(p,'11-restablecer-dos-pasos');
  await p.locator('#auth-code').fill('123456');await p.locator('#auth-verificar').click();
  await p.locator('#auth-nueva').waitFor({state:'visible'});await foto(p,'10-contrasena-nueva');
  await p.locator('#auth-nueva-pass').fill('Mariana-Nueva-8');await p.locator('#auth-nueva-pass2').fill('Mariana-Nueva-8');await p.locator('#auth-nueva-guardar').click();
  await p.waitForFunction(()=>/Acceso verificado/.test(document.querySelector('#auth-status')?.textContent||''));assert.equal(claves.get(ids.nueva),'Mariana-Nueva-8');await c.close();}
 // 6) Entrar con WhatsApp y la contraseña nueva.
 {const {c,p}=await contexto();await abrir(p);await p.locator('#auth-cuenta').fill('55 1111 1111');await p.locator('#auth-pass').fill('Mariana-Nueva-8');await p.locator('#auth-clave-entrar').click();await p.locator('#auth-code').waitFor({state:'visible'});
  for(const w of [768,1440]){await p.setViewportSize({width:w,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}await c.close();}
 assert.deepEqual(errores,[]);
 console.log('Contraseñas: registro en 4 pasos, entrar con usuario o WhatsApp, CAPTCHA al 3.er fallo, restablecer por usuario y acceso del equipo con temporal verificados. Sin envíos reales.');
}catch(x){for(const pg of browser.contexts().flatMap(c=>c.pages())){console.log('ESTADO:',await pg.locator('#auth-status').innerText().catch(()=>'?'));await pg.screenshot({path:capturas+'fallo.png'}).catch(()=>{});}throw x;}finally{await browser.close();server.close();await e.cerrar();}
