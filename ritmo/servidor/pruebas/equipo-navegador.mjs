import {chromium} from 'playwright';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {preparar,ids,sesiones} from './whatsapp-solo-envios-entorno.mjs';
import {VerificadorJWT} from '../build/cuentas/jwt.js';
import {rutasCuentas} from '../build/cuentas/http.js';
import {crearServidor} from '../build/http.js';
const e=await preparar();const par=await generateKeyPair('ES256',{extractable:true});const key={...await exportJWK(par.publicKey),kid:'local',alg:'ES256'};
const supabase='https://zkqwephmuflbuagevvxj.supabase.co';
async function token(u,aal){return new SignJWT({session_id:sesiones[u],aal,role:'authenticated',is_anonymous:u==='nueva',amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)}]}).setProtectedHeader({alg:'ES256',kid:'local'}).setSubject(ids[u]).setIssuer(supabase+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey);}
const jwt=new VerificadorJWT(supabase,{permitirAnonimos:true,fetch:async()=>Response.json({keys:[key]})});let base='';
const config={habilitado:true,supabaseURL:supabase,llavePublica:'sb_publishable_prueba_local',salones:new Set([ids.salon]),get origen(){return base},claveLimite:'c'.repeat(40),turnstileSiteKey:'solo_prueba',temporales:true};
const server=crearServidor({salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})},'a'.repeat(40),fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{cuentas:rutasCuentas(e.poolAPI,jwt,config)});server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),errors=[];
try{
 const owner=await browser.newContext({viewport:{width:390,height:844}});const adminToken=await token('admin','aal2');
 await owner.addInitScript(({access,id})=>localStorage.setItem('agendappx.auth',JSON.stringify({access_token:access,refresh_token:'test',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id,aud:'authenticated',role:'authenticated',email:'admin@example.test',factors:[]}})),{access:adminToken,id:ids.admin});
 await owner.route(supabase+'/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Local"}'}));
 const p=await owner.newPage();p.on('pageerror',x=>errors.push(x.message));await p.goto(base);await p.waitForFunction(async()=>!!(await window.AgendappxCuentas?.sesion()));
 await p.getByRole('tab',{name:'Ajustes',exact:true}).click();await p.getByRole('button',{name:/Sincronización/}).click();await p.locator('#sync-account').click();await p.locator('#auth-invitar').waitFor({state:'visible'});await p.locator('#auth-invitar').click();await p.locator('#auth-enlace').waitFor({state:'visible'});const enlace=await p.locator('#auth-enlace').inputValue();assert.match(enlace,/#invitacion=/);if(process.env.EQUIPO_SCREENSHOT_DIR){await p.locator('#auth-enlace').evaluate(el=>el.value='Enlace privado de un solo uso');await p.screenshot({path:process.env.EQUIPO_SCREENSHOT_DIR+'/invitacion.png',animations:'disabled'});}
 const invitada=await browser.newContext({viewport:{width:390,height:844}});await invitada.addInitScript(()=>{window.turnstile={render(_el,opts){opts.callback('captcha-local');return 'widget';},reset(){}};});let verificado=false;
 const factor='ffffffff-1111-4111-8111-111111111111';const user=()=>({id:ids.nueva,aud:'authenticated',role:'authenticated',is_anonymous:true,factors:verificado?[{id:factor,factor_type:'totp',status:'verified'}]:[]});
 const sesion=async aal=>({access_token:await token('nueva',aal),refresh_token:'test',token_type:'bearer',expires_in:3600,user:user()});
 await invitada.route(supabase+'/**',async r=>{const req=r.request(),u=new URL(req.url());let data,status=200;
  if(req.method()==='OPTIONS'){await r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,GET,DELETE,OPTIONS'}});return;}
  if(u.pathname==='/auth/v1/signup'){assert.equal(req.postDataJSON().gotrue_meta_security.captcha_token,'captcha-local');data=await sesion('aal1');}
  else if(u.pathname==='/auth/v1/user')data=user();
  else if(u.pathname==='/auth/v1/factors'&&req.method()==='POST')data={id:factor,type:'totp',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg"></svg>',secret:'SOLOPRUEBA',uri:'otpauth://totp/prueba'}};
  else if(u.pathname.endsWith('/challenge'))data={id:'reto-local',type:'totp',expires_at:Math.floor(Date.now()/1000)+60};
  else if(u.pathname.endsWith('/verify')){verificado=true;data=await sesion('aal2');}
  else {status=503;data={error:'Ruta de prueba inesperada: '+u.pathname};}
  await r.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});
 });
 const q=await invitada.newPage();q.on('pageerror',x=>errors.push(x.message));await q.goto(enlace);await q.locator('#auth-unirse').waitFor({state:'visible'});assert.equal(new URL(q.url()).hash,'');if(process.env.EQUIPO_SCREENSHOT_DIR)await q.screenshot({path:process.env.EQUIPO_SCREENSHOT_DIR+'/unirse.png',animations:'disabled'});await q.locator('#auth-nombre').fill('Administradora');await q.locator('#auth-unirse').click();await q.locator('#auth-code').waitFor({state:'visible'});await q.locator('#auth-code').fill('123456');await q.locator('#auth-verificar').click();await q.waitForFunction(async()=>((await window.AgendappxCuentas.sesion())?.rol)==='admin',{timeout:15000});
 for(const width of [390,768,1440]){await q.setViewportSize({width,height:900});assert.equal(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await p.getByRole('button',{name:'Listo',exact:true}).click();await p.getByRole('button',{name:/Sincronización/}).click();await p.locator('#sync-account').click();await p.locator('#auth-equipo').waitFor({state:'visible'});assert.match(await p.locator('#auth-equipo').innerText(),/Administradora/);p.once('dialog',d=>d.accept());await p.locator('[data-quitar-miembro="'+ids.nueva+'"]').click();await p.getByText('Acceso retirado.',{exact:true}).waitFor();
 const r=await q.evaluate(async(id)=>{const t=JSON.parse(localStorage.getItem('agendappx.auth')).access_token;return (await fetch('/api/negocios/'+id+'/datos/estado',{headers:{Authorization:'Bearer '+t}})).status;},ids.salon);assert.equal(r,403);

 assert.deepEqual(errors,[]);console.log('Navegador: enlace creado, CAPTCHA simulado, acceso propio, MFA, invitacion de un uso y pantalla movil verificados con base local.');
 await owner.close();await invitada.close();
}finally{await browser.close();await new Promise(r=>server.close(r));await e.cerrar();}
