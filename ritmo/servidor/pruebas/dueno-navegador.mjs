// Dueño sin salón: SDK real, OTP y MFA simulados; API del panel y RLS en PostgreSQL local.
import {chromium} from 'playwright';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {entornoSocial,ids,sesiones} from './social-entorno.mjs';
import {VerificadorJWT} from '../build/cuentas/jwt.js';
import {rutasCuentas} from '../build/cuentas/http.js';
import {crearServidor} from '../build/http.js';
const e=await entornoSocial(),supabase='https://zkqwephmuflbuagevvxj.supabase.co';
const sql=async(q,a)=>{const c=await e.pool.connect();try{return await c.query(q,a);}finally{c.release();}};
await sql("SELECT set_config('ritmo.plataforma_admin',$1,false)",[ids.nueva]);
for(const m of ['20261030180000_panel_plataforma.sql','20261030190000_codigos_manuales.sql'])await sql(await readFile(new URL('../../supabase/migrations/'+m,import.meta.url),'utf8'));
assert.equal(Number((await sql('SELECT count(*) FROM ritmo.miembros WHERE usuario_id=$1',[ids.nueva])).rows[0].count),0);
await sql('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[sesiones.nueva,ids.nueva]);
const par=await generateKeyPair('ES256',{extractable:true}),jwk={...await exportJWK(par.publicKey),kid:'local-dueno',alg:'ES256'};
const jwt=new VerificadorJWT(supabase,{fetch:async()=>Response.json({keys:[jwk]})});let base='';
const cuentas={habilitado:true,supabaseURL:supabase,llavePublica:'sb_publishable_prueba_local',salones:new Set([ids.salon]),acceso:{whatsapp:true,correo:false},get origen(){return base;}};
const server=crearServidor({salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})},'a'.repeat(40),fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{cuentas:rutasCuentas(e.poolAPI,jwt,cuentas)});
server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),errores=[];
const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX',colorScheme:'light'});
const capturas=fileURLToPath(new URL('../../imagenes/acceso-dueno/',import.meta.url));await mkdir(capturas,{recursive:true});
let mfa=false,pedidos=0,consultasNegocio=0;
const factor='ffffffff-1111-4111-8111-111111111111';
const usuario=()=>({id:ids.nueva,phone:'525511111111',phone_confirmed_at:new Date().toISOString(),aud:'authenticated',role:'authenticated',factors:mfa?[{id:factor,factor_type:'totp',status:'verified'}]:[]});
async function sesion(aal){return {access_token:await new SignJWT({session_id:sesiones.nueva,aal,role:'authenticated'}).setProtectedHeader({alg:'ES256',kid:'local-dueno'}).setSubject(ids.nueva).setIssuer(supabase+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey),refresh_token:'solo-pruebas',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:usuario()};}
await ctx.route(base+'/api/**',async route=>{
 const r=route.request(),path=new URL(r.url()).pathname;
 if(path==='/api/cuentas/contexto'||path.startsWith('/api/registro/')||path.startsWith('/api/negocios/'))consultasNegocio++;
 if(path==='/api/acceso/solicitar'){assert.equal(r.postDataJSON().destino,'+525511111111');pedidos++;return route.fulfill({json:{id:'aaaaaaaa-1111-4111-8111-111111111111',prueba:'a'.repeat(64)}});}
 if(path==='/api/acceso/verificar'){assert.equal(r.postDataJSON().codigo,'482913');return route.fulfill({json:await sesion('aal1')});}
 await route.continue();
});
await ctx.route(supabase+'/**',async route=>{
 const r=route.request(),path=new URL(r.url()).pathname;
 if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,PUT,GET,DELETE,OPTIONS'}});
 let d;
 if(path==='/auth/v1/user')d=usuario();
 else if(path==='/auth/v1/factors'&&r.method()==='POST')d={id:factor,type:'totp',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="white"/><text x="8" y="60" fill="black">PRUEBA LOCAL</text></svg>',secret:'SOLOPRUEBA',uri:'otpauth://totp/prueba'}};
 else if(path.endsWith('/challenge'))d={id:'reto-dueno',type:'totp',expires_at:Math.floor(Date.now()/1000)+60};
 else if(path.endsWith('/verify')){assert.equal(r.postDataJSON().code,'123456');mfa=true;d=await sesion('aal2');}
 else if(path==='/auth/v1/token')d=await sesion(mfa?'aal2':'aal1');
 else if(path==='/auth/v1/logout')d={};
 else throw new Error('Ruta Auth inesperada: '+path);
 await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*'},body:JSON.stringify(d)});
});
try{
 const p=await ctx.newPage();p.on('pageerror',x=>errores.push(x.message));await p.goto(base+'/plataforma/');await p.locator('#auth-destino').waitFor();
 assert.equal(await p.locator('#registro-formulario').count(),0);assert.equal(await p.locator('#auth-clave').count(),0);
 for(const tema of ['light','dark']){await p.emulateMedia({colorScheme:tema});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:capturas+'01-entrada-'+tema+'.png',animations:'disabled'});}
 await p.emulateMedia({colorScheme:'light'});await p.locator('#auth-destino').fill('5511111111');await p.locator('#auth-pedir').click();await p.locator('#auth-otp-code').waitFor({state:'visible'});
 assert.equal(await p.locator('#auth-form').isVisible(),false);assert.equal(await p.locator('[data-salon]').count(),0);
 await p.locator('#auth-otp-valor').fill('482913');await p.locator('#auth-confirmar').click();await p.locator('#auth-code').waitFor({state:'visible'});
 assert.equal(await p.locator('[data-salon]').count(),0,'El código de WhatsApp no salta los dos pasos');await p.screenshot({path:capturas+'02-dos-pasos.png',animations:'disabled'});
 await p.locator('#auth-code').fill('123456');await p.locator('#auth-verificar').click();await p.locator('[data-salon]').first().waitFor();
 assert.equal(await p.locator('[data-salon]').count(),2);assert.equal(await p.locator('#acceso-plataforma').count(),0);
 await p.screenshot({path:capturas+'03-panel-sin-negocio.png',animations:'disabled'});await p.reload();await p.locator('[data-salon]').first().waitFor();
 for(const w of [320,768,1440]){await p.setViewportSize({width:w,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.equal(consultasNegocio,0,'No consulta un salón ni el ticket viejo para abrir el panel');assert.equal(pedidos,1);
 assert.equal(Number((await sql('SELECT count(*) FROM ritmo.miembros WHERE usuario_id=$1',[ids.nueva])).rows[0].count),0);
 assert.equal(Number((await sql('SELECT count(*) FROM ritmo.social_clientes WHERE usuario_id=$1',[ids.nueva])).rows[0].count),0);
 await p.locator('#salir-dueno').click();await p.locator('#auth-destino').waitFor();assert.equal(await p.locator('[data-salon]').count(),0);assert.deepEqual(errores,[]);
 console.log('Dueño sin negocio: WhatsApp → MFA → panel, sesión conservada al recargar, sin formularios de salón ni consultas de negocio. Salir limpia el panel. White/Dark 390 y 320/768/1440. Sin envíos reales.');
}finally{await ctx.close();await browser.close();server.close();await e.cerrar();}
