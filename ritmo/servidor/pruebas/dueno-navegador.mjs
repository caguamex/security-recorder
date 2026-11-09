// Dueño sin salón: SDK real, OTP simulado y RLS local; sin QR ni endpoints MFA.
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
for(const m of ['20261030180000_panel_plataforma.sql','20261030190000_codigos_manuales.sql','20261030214547_dueno_solo_whatsapp.sql'])await sql(await readFile(new URL('../../supabase/migrations/'+m,import.meta.url),'utf8'));
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
let pedidos=0,consultasNegocio=0;
const solicitud='aaaaaaaa-1111-4111-8111-111111111111';
const usuario=()=>({id:ids.nueva,phone:'525511111111',phone_confirmed_at:new Date().toISOString(),aud:'authenticated',role:'authenticated',factors:[]});
async function sesion(aal){return {access_token:await new SignJWT({session_id:sesiones.nueva,aal,role:'authenticated'}).setProtectedHeader({alg:'ES256',kid:'local-dueno'}).setSubject(ids.nueva).setIssuer(supabase+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey),refresh_token:'solo-pruebas',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:usuario()};}
await ctx.route(base+'/api/**',async route=>{
 const r=route.request(),path=new URL(r.url()).pathname;
 if(path==='/api/cuentas/contexto'||path.startsWith('/api/registro/')||path.startsWith('/api/negocios/'))consultasNegocio++;
 if(path==='/api/acceso/solicitar'){assert.equal(r.postDataJSON().destino,'+525511111111');pedidos++;return route.fulfill({json:{id:'aaaaaaaa-1111-4111-8111-111111111111',prueba:'a'.repeat(64)}});}
 if(path==='/api/acceso/verificar'){assert.equal(r.postDataJSON().codigo,'482913');await sql("INSERT INTO ritmo.acceso_solicitudes(id,prueba_hash,destino_hash,ip_hash,usuario_id,canal,tipo,estado,codigo_hash,vence_en) VALUES($1,$2,$2,$2,$3,'whatsapp','sms','usado',$2,now()+interval '10 minutes')",[solicitud,'a'.repeat(64),ids.nueva]);await sql('UPDATE ritmo.acceso_sesiones SET solicitud_otp=$1 WHERE sesion_id=$2',[solicitud,sesiones.nueva]);return route.fulfill({json:await sesion('aal1')});}
 await route.continue();
});
await ctx.route(supabase+'/**',async route=>{
 const r=route.request(),path=new URL(r.url()).pathname;
 if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,PUT,GET,DELETE,OPTIONS'}});
 let d;
 if(path==='/auth/v1/user')d=usuario();
 else if(path==='/auth/v1/token')d=await sesion('aal1');
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
 await p.screenshot({path:capturas+'02-codigo-whatsapp.png',animations:'disabled'});
 await p.locator('#auth-otp-valor').fill('482913');await p.locator('#auth-confirmar').click();await p.locator('[data-salon]').first().waitFor();
 assert.equal(await p.locator('[data-salon]').count(),2);assert.equal(await p.locator('#acceso-plataforma').count(),0);
 assert.equal(await p.evaluate(()=>JSON.parse(atob(JSON.parse(localStorage.getItem('agendappx.auth')).access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).aal),'aal1');
 await p.screenshot({path:capturas+'03-panel-sin-negocio.png',animations:'disabled'});await sql('DELETE FROM ritmo.acceso_solicitudes WHERE id=$1',[solicitud]);await p.reload();await p.locator('[data-salon]').first().waitFor();
 for(const w of [320,768,1440]){await p.setViewportSize({width:w,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.equal(consultasNegocio,0,'No consulta un salón ni el ticket viejo para abrir el panel');assert.equal(pedidos,1);
 assert.equal(Number((await sql('SELECT count(*) FROM ritmo.miembros WHERE usuario_id=$1',[ids.nueva])).rows[0].count),0);
 assert.equal(Number((await sql('SELECT count(*) FROM ritmo.social_clientes WHERE usuario_id=$1',[ids.nueva])).rows[0].count),0);
 await p.locator('#salir-dueno').click();await p.locator('#auth-destino').waitFor();assert.equal(await p.locator('[data-salon]').count(),0);assert.deepEqual(errores,[]);
 console.log('Dueño sin negocio: WhatsApp → panel, sin QR ni llamadas MFA; aal1 real. Sesión conservada tras depurar OTP y recargar, sin formularios ni consultas de negocio. Salir limpia el panel. White/Dark 390 y 320/768/1440. Sin envíos reales.');
}finally{await ctx.close();await browser.close();server.close();await e.cerrar();}
