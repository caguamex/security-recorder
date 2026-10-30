// Panel de Agendappx en navegador: SDK real con sesión firmada (MFA), rutas locales y PostgreSQL con RLS.
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
import {randomBytes,randomUUID} from 'node:crypto';
import {cifrarCodigo} from '../build/plataforma/cifrado.js';
const e=await entornoSocial(),supabase='https://zkqwephmuflbuagevvxj.supabase.co',par=await generateKeyPair('ES256',{extractable:true}),jwk={...await exportJWK(par.publicKey),kid:'local',alg:'ES256'};
const jwt=new VerificadorJWT(supabase,{fetch:async()=>Response.json({keys:[jwk]})});
const sql=async(q,a)=>{const c=await e.pool.connect();try{return await c.query(q,a);}finally{c.release();}};
await sql("SELECT set_config('ritmo.plataforma_admin',$1,false)",[ids.admin]);
for(const m of ['20261030180000_panel_plataforma.sql','20261030190000_codigos_manuales.sql'])await sql(await readFile(new URL('../../supabase/migrations/'+m,import.meta.url),'utf8'));
// Un código que WhatsApp no pudo entregar, guardado cifrado para envío manual.
const llave=randomBytes(32).toString('base64'),solicitud=randomUUID();
await sql("INSERT INTO ritmo.acceso_solicitudes(id,prueba_hash,destino_hash,ip_hash,canal,tipo,creado_en,vence_en,estado) VALUES($1,$2,$2,$2,'whatsapp','sms',now()-interval '2 minutes',now()+interval '8 minutes','manual')",[solicitud,'a'.repeat(64)]);
await sql("INSERT INTO ritmo.codigos_manuales(solicitud_id,cifrado,motivo,vence_en) VALUES($1,$2,'desconectado',now()+interval '8 minutes')",[solicitud,cifrarCodigo(llave,{telefono:'528441234545',codigo:'482913'})]);
await sql('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[sesiones.admin,ids.admin]);
await sql("UPDATE auth.users SET phone='525522222222' WHERE id=$1",[ids.ajena]);
await sql("INSERT INTO ritmo.negocios_planes(negocio_id,plan,estado,prueba_inicio,prueba_fin) VALUES($1,'salon','prueba',now()-interval '27 days',now()+interval '3 days') ON CONFLICT(negocio_id) DO UPDATE SET estado='prueba',plan='salon',prueba_inicio=EXCLUDED.prueba_inicio,prueba_fin=EXCLUDED.prueba_fin",[ids.otro]);
await e.fuente({id:'__settings',negocio:'AB Beauty Room',abre:'10:00',cierra:'20:00',examplesOff:true});
let base='';
const cuentas={habilitado:true,supabaseURL:supabase,llavePublica:'sb_publishable_prueba_local',salones:new Set([ids.salon]),migracionUsuarioId:ids.admin,acceso:{whatsapp:true,correo:false},plataforma:{key:llave},get origen(){return base;}};
const server=crearServidor({salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})},'a'.repeat(40),fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{cuentas:rutasCuentas(e.poolAPI,jwt,cuentas)});
server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
const token=async(u,s)=>new SignJWT({session_id:s,aal:'aal2',role:'authenticated'}).setProtectedHeader({alg:'ES256',kid:'local'}).setSubject(u).setIssuer(supabase+'/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey);
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),errores=[];const capturas=fileURLToPath(new URL('../../imagenes/panel-plataforma/',import.meta.url));await mkdir(capturas,{recursive:true});
async function abrir(u,modo='light'){const c=await browser.newContext({viewport:{width:390,height:844},locale:'es-MX',colorScheme:modo});
 const usuario={id:ids[u],phone:'525511111111',aud:'authenticated',role:'authenticated',factors:[{id:'ffffffff-1111-4111-8111-111111111111',factor_type:'totp',status:'verified'}]};
 await c.route(supabase+'/**',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':base,'Access-Control-Allow-Headers':'*'},body:JSON.stringify(usuario)}));
 const p=await c.newPage();p.on('pageerror',x=>errores.push(x.message));p.on('dialog',d=>d.accept('Prueba de pausa'));
 const sesion={access_token:await token(ids[u],sesiones[u]),refresh_token:'solo-pruebas',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:usuario};
 await p.goto(base+'/plataforma/');await p.evaluate(s=>localStorage.setItem('agendappx.auth',JSON.stringify(s)),sesion);await p.reload();return {c,p};}
try{
 {const {c,p}=await abrir('admin');await p.locator('[data-salon]').first().waitFor();
  assert.equal(await p.locator('[data-salon]').count(),2);assert.match(await p.locator('#contenido').innerText(),/En prueba gratis/);
  await p.screenshot({path:capturas+'01-panel.png',fullPage:true,animations:'disabled'});
  // Código sin entregar: ver y enviar desde el WhatsApp del administrador.
  assert.match(await p.locator('.alerta').innerText(),/\+52 844 ••• 45/);await p.locator(`[data-codigo="${solicitud}"]`).click();await p.locator('.codigo-grande').waitFor();
  assert.equal((await p.locator('.codigo-grande').innerText()).replace(/\s/g,''),'482913');assert.match(await p.locator('#codigo-whatsapp').getAttribute('href'),/^https:\/\/wa\.me\/528441234545\?text=/);
  await p.screenshot({path:capturas+'04-codigo.png',animations:'disabled'});await p.locator(`[data-entregado="${solicitud}"]`).click();await p.locator('.alerta').waitFor({state:'detached'});
  await p.locator('[data-filtro=vencer]').click();assert.equal(await p.locator('[data-salon]').count(),1);
  await p.locator('#buscar').fill('ab beauty');await p.locator('[data-filtro=todos]').click();
  await p.locator(`[data-salon="${ids.otro}"]`).click({trial:false}).catch(async()=>{await p.locator('#buscar').fill('');await p.locator(`[data-salon="${ids.otro}"]`).click();});
  await p.locator('#hoja[open]').waitFor();await p.screenshot({path:capturas+'02-salon.png',animations:'disabled'});
  await p.locator('[data-accion=extender_prueba][data-dias="7"]').click();await p.locator('#aviso:not([hidden])').waitFor();
  await p.locator('[data-accion=verificar]').click();await p.locator('[data-accion=suspender]').click();await p.getByText('Reactivar salón').waitFor();
  const fila=(await sql('SELECT motivo FROM ritmo.negocios_suspendidos WHERE negocio_id=$1',[ids.otro])).rows[0];assert.equal(fila.motivo,'Prueba de pausa');
  assert.equal((await sql('SELECT verificado FROM ritmo.publico_perfiles WHERE negocio_id=$1',[ids.otro])).rows[0].verificado,true);
  await p.locator('#hoja-cerrar').click();await p.locator('#bitacora .celda').first().waitFor();assert.match(await p.locator('#bitacora').innerText(),/Salón en pausa/);
  for(const w of [768,1440]){await p.setViewportSize({width:w,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}await c.close();}
 {const {c,p}=await abrir('admin','dark');await p.locator('[data-salon]').first().waitFor();await p.screenshot({path:capturas+'03-panel-dark.png',animations:'disabled'});await c.close();}
 // Otra Admin de salón con MFA no ve el panel.
 {await sql('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[sesiones.ajena,ids.ajena]);const {c,p}=await abrir('ajena');await p.getByText(/solo para el administrador de Agendappx|exclusivo del dueño/).waitFor();assert.equal(await p.locator('[data-salon]').count(),0);await c.close();}
 assert.deepEqual(errores,[]);
 console.log('Panel: resumen, salones, filtros, búsqueda, extender prueba, verificar, pausa y bitácora; otra Admin no lo ve. White/Dark 390/768/1440.');
}finally{await browser.close();server.close();await e.cerrar();}
