// Cobro por transferencia en navegador: el salón pide pagar y avisa; el dueño confirma en el panel; el salón queda pagado.
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
import {randomUUID} from 'node:crypto';
const e=await entornoSocial(),supabase='https://zkqwephmuflbuagevvxj.supabase.co',par=await generateKeyPair('ES256',{extractable:true}),jwk={...await exportJWK(par.publicKey),kid:'local',alg:'ES256'};
const jwt=new VerificadorJWT(supabase,{fetch:async()=>Response.json({keys:[jwk]})});
const sql=async(q,a)=>{const c=await e.pool.connect();try{return await c.query(q,a);}finally{c.release();}};
await sql("SELECT set_config('ritmo.plataforma_admin',$1,false)",[ids.admin]);
for(const m of ['20261030180000_panel_plataforma.sql','20261030190000_codigos_manuales.sql','20261030214547_dueno_solo_whatsapp.sql','20261109120000_cobros_transferencia.sql'])await sql(await readFile(new URL('../../supabase/migrations/'+m,import.meta.url),'utf8'));
const otpDueno=randomUUID();await sql('UPDATE auth.users SET phone=$2,phone_confirmed_at=now() WHERE id=$1',[ids.admin,'525511111111']);
await sql("INSERT INTO ritmo.acceso_solicitudes(id,prueba_hash,destino_hash,ip_hash,usuario_id,canal,tipo,estado,codigo_hash,vence_en) VALUES($1,$2,$2,$2,$3,'whatsapp','sms','usado',$2,now()+interval '10 minutes')",[otpDueno,'f'.repeat(64),ids.admin]);
for(const u of ['admin','ajena'])await sql('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[sesiones[u],ids[u]]);
await sql('UPDATE ritmo.acceso_sesiones SET solicitud_otp=$1 WHERE sesion_id=$2',[otpDueno,sesiones.admin]);
await sql("INSERT INTO ritmo.negocios_planes(negocio_id,plan,estado,prueba_inicio,prueba_fin) VALUES($1,'salon','prueba',now()-interval '27 days',now()+interval '3 days') ON CONFLICT(negocio_id) DO UPDATE SET estado='prueba',plan='salon',prueba_inicio=EXCLUDED.prueba_inicio,prueba_fin=EXCLUDED.prueba_fin",[ids.otro]);
let base='';
const cuentas={habilitado:true,supabaseURL:supabase,llavePublica:'sb_publishable_prueba_local',salones:new Set([ids.salon,ids.otro]),migracionUsuarioId:ids.admin,acceso:{whatsapp:true,correo:false},cobro:{clabe:'012180001234567899',banco:'BBVA',titular:'Persona de Prueba'},plataforma:{},get origen(){return base;}};
const server=crearServidor({salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})},'a'.repeat(40),fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{cuentas:(...x)=>(rutas??=rutasCuentas(e.poolAPI,jwt,cuentas))(...x)});let rutas;
server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
const token=async(u,s)=>new SignJWT({session_id:s,aal:'aal2',role:'authenticated'}).setProtectedHeader({alg:'ES256',kid:'local'}).setSubject(u).setIssuer(supabase+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey);
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),errores=[];const capturas=fileURLToPath(new URL('../../imagenes/pagos-transferencia/',import.meta.url));await mkdir(capturas,{recursive:true});
async function abrir(u,ruta,modo='light'){const c=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX',colorScheme:modo});
 const usuario={id:ids[u],phone:'525511111111',aud:'authenticated',role:'authenticated',factors:[{id:'ffffffff-1111-4111-8111-111111111111',factor_type:'totp',status:'verified'}]};
 await c.route(supabase+'/**',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*'},body:JSON.stringify(usuario)}));
 const p=await c.newPage();p.on('pageerror',x=>errores.push(x.message));p.on('dialog',d=>d.accept());
 const sesion={access_token:await token(ids[u],sesiones[u]),refresh_token:'solo-pruebas',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:usuario};
 await p.goto(base+ruta);await p.evaluate(({s,n,id})=>{localStorage.setItem('agendappx.auth',JSON.stringify(s));localStorage.setItem('agendappx.negocio.'+id,n);},{s:sesion,n:ids.otro,id:ids[u]});await p.reload();return {c,p};}
const miPlan=async p=>{await p.waitForFunction(async()=>!!await window.AgendappxCuentas?.sesion());await p.locator('#tabbar').getByRole('tab',{name:'Negocio',exact:true}).click();await p.getByRole('button',{name:'Mi plan',exact:true}).click();await p.getByText('Pagar mi plan').waitFor();};
try{
 {const {c,p}=await abrir('ajena','/');await miPlan(p);
  await p.locator('#pago-plan').selectOption('salon');await p.getByRole('button',{name:'Pagar por transferencia'}).click();
  await p.getByText('012 180 00123456789 9').waitFor();const t=await p.locator('#sheetCard').innerText();assert.match(t,/Total a transferir\n?\s*Plan Salón mensual\s*\$(449|199)/);assert.match(t,/AGX-[0-9A-F]{6}/);assert.match(t,/Persona de Prueba/);
  await p.screenshot({path:capturas+'01-salon-transferir.png',animations:'disabled'});
  await p.locator('#pago-nota').fill('BBVA, 3:15 pm');await p.getByRole('button',{name:'Ya transferí'}).click();await p.getByText('Recibimos tu aviso').waitFor();await p.waitForTimeout(400);assert.doesNotMatch(await p.locator('body').innerText(),/ya no está pendiente/);
  await p.screenshot({path:capturas+'02-salon-avisado.png',animations:'disabled'});await c.close();}
 {const {c,p}=await abrir('admin','/plataforma/');await p.getByText('Pagos por confirmar · 1').waitFor();assert.match(await p.locator('#contenido').innerText(),/BBVA, 3:15 pm/);
  await p.screenshot({path:capturas+'03-panel-por-confirmar.png',animations:'disabled'});
  await p.locator('[data-pago-confirmar]').click();await p.locator('[data-pago-confirmar]').waitFor({state:'detached'});assert.match(await p.locator('#aviso').innerText(),/Pago confirmado/);await c.close();}
 {const {c,p}=await abrir('ajena','/');await miPlan(p);const t=await p.locator('#sheetCard').innerText();assert.match(t,/Pagado/);assert.match(t,/Confirmado/);
  await p.screenshot({path:capturas+'04-salon-pagado.png',animations:'disabled'});await c.close();}
 assert.deepEqual(errores,[]);
 console.log('Pagos por transferencia: pedir, CLABE y referencia, «Ya transferí», confirmar en el panel y plan pagado. 390 px.');
}finally{await browser.close();server.close();await e.cerrar?.();}
