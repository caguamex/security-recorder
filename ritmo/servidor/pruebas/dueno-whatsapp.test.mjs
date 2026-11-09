import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {entornoSocial,ids,sesiones} from './social-entorno.mjs';
import {enTransaccion} from '../build/cuentas/contexto.js';
import {rutasAcceso} from '../build/cuentas/acceso.js';
async function entorno(t){
 const e=await entornoSocial();t.after(()=>e.cerrar());const sql=async(q,a)=>{const c=await e.pool.connect();try{return await c.query(q,a);}finally{c.release();}};
 await sql("SELECT set_config('ritmo.plataforma_admin',$1,false)",[ids.nueva]);
 for(const m of ['20261030180000_panel_plataforma.sql','20261030190000_codigos_manuales.sql','20261030214547_dueno_solo_whatsapp.sql'])await sql(await readFile(new URL('../../supabase/migrations/'+m,import.meta.url),'utf8'));
 await sql('INSERT INTO ritmo.social_moderadores(usuario_id) VALUES($1) ON CONFLICT DO NOTHING',[ids.nueva]);
 const identidad=(u='nueva',aal='aal1')=>({usuarioId:ids[u],sesionId:sesiones[u],aal});
 const f=(q,a=[],i=identidad())=>enTransaccion(e.poolAPI,i,null,async c=>(await c.query(q,a)).rows[0]?.r);
 async function otp(u='nueva'){
  const id=randomUUID();await sql("INSERT INTO ritmo.acceso_solicitudes(id,prueba_hash,destino_hash,ip_hash,canal,tipo,usuario_id,vence_en,estado,codigo_hash) VALUES($1,$2,$2,$2,'whatsapp','sms',$3,now()+interval '10 minutes','usado',$2)",[id,'a'.repeat(64),ids[u]]);
  await sql('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id,solicitud_otp) VALUES($1,$2,$3) ON CONFLICT(sesion_id) DO UPDATE SET solicitud_otp=EXCLUDED.solicitud_otp,plataforma_whatsapp_en=NULL',[sesiones[u],ids[u],id]);return id;
 }
 return {...e,sql,f,otp,identidad};
}
test('dueño WhatsApp: código usado propio permite panel y moderación con aal1, sin salón ni MFA inventado',async t=>{
 const e=await entorno(t);await e.otp();
 assert.equal(await e.f('SELECT ritmo.es_admin_plataforma() AS r'),true);
 assert.equal((await e.f('SELECT ritmo.plataforma_resumen() AS r')).salones,2);
 assert.equal(await e.f('SELECT ritmo.es_moderador_social() AS r'),true);
 assert.equal(await e.f("SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal' AS r"),'aal1');
 assert.equal(Number((await e.sql('SELECT count(*) FROM ritmo.miembros WHERE usuario_id=$1',[ids.nueva])).rows[0].count),0);
});
test('dueño WhatsApp: sesión de contraseña o enlace no accede aunque traiga aal2',async t=>{
 const e=await entorno(t);
 for(const aal of ['aal1','aal2']){assert.equal(await e.f('SELECT ritmo.es_admin_plataforma() AS r',[],e.identidad('nueva',aal)),false);await assert.rejects(()=>e.f('SELECT ritmo.plataforma_resumen() AS r',[],e.identidad('nueva',aal)),x=>x.code==='42501');}
});
test('dueño WhatsApp: correo, phone_change, otro usuario, código pendiente o sin hash no habilitan el panel',async t=>{
 const e=await entorno(t),codigo=await e.otp();
 for(const patch of ["canal='correo',tipo='email'","tipo='phone_change'",`usuario_id='${ids.ajena}'`,"estado='enviado'","codigo_hash=NULL"]){
  await e.sql("UPDATE ritmo.acceso_solicitudes SET canal='whatsapp',tipo='sms',usuario_id=$2,estado='usado',codigo_hash=$3 WHERE id=$1",[codigo,ids.nueva,'a'.repeat(64)]);
  await e.sql('UPDATE ritmo.acceso_solicitudes SET '+patch+' WHERE id=$1',[codigo]);assert.equal(await e.f('SELECT ritmo.es_admin_plataforma() AS r'),false);
 }
});
test('dueño WhatsApp: otra Admin con código y aal2 sigue bloqueada; la API no puede escribir la acreditación',async t=>{
 const e=await entorno(t);await e.otp('ajena');assert.equal(await e.f('SELECT ritmo.es_admin_plataforma() AS r',[],e.identidad('ajena','aal2')),false);
 await assert.rejects(()=>e.f('SELECT ritmo.plataforma_salones() AS r',[],e.identidad('ajena','aal2')),x=>x.code==='42501');
 await assert.rejects(()=>enTransaccion(e.poolAPI,e.identidad(),null,c=>c.query('UPDATE ritmo.acceso_sesiones SET plataforma_whatsapp_en=now() WHERE sesion_id=$1',[sesiones.nueva])),x=>x.code==='42501');
 await assert.rejects(()=>enTransaccion(e.poolAPI,e.identidad(),null,c=>c.query('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id,plataforma_whatsapp_en) VALUES($1,$2,now())',[randomUUID(),ids.nueva])),x=>x.code==='42501');
});
test('dueño WhatsApp: conserva acceso tras depurar el OTP; revocar sesión, propietario o teléfono lo corta',async t=>{
 const e=await entorno(t),codigo=await e.otp();assert.equal(await e.f('SELECT ritmo.es_admin_plataforma() AS r'),true);
 await e.sql('DELETE FROM ritmo.acceso_solicitudes WHERE id=$1',[codigo]);assert.equal(await e.f('SELECT ritmo.es_admin_plataforma() AS r'),true);
 await e.sql('DELETE FROM ritmo.plataforma_admins WHERE usuario_id=$1',[ids.nueva]);assert.equal(await e.f('SELECT ritmo.es_admin_plataforma() AS r'),false);
 await e.sql('INSERT INTO ritmo.plataforma_admins(usuario_id) VALUES($1)',[ids.nueva]);await e.sql('UPDATE auth.users SET phone_confirmed_at=NULL WHERE id=$1',[ids.nueva]);assert.equal(await e.f('SELECT ritmo.es_admin_plataforma() AS r'),false);
 await e.sql('UPDATE auth.users SET phone_confirmed_at=now() WHERE id=$1',[ids.nueva]);await e.sql('UPDATE ritmo.actividad_sesiones SET revocada=true WHERE usuario_id=$1',[ids.nueva]);await assert.rejects(()=>e.f('SELECT ritmo.plataforma_resumen() AS r'),x=>x.status===401);
});
test('dueño WhatsApp: el intermediario admite la sesión con permisos mínimos y la base acredita el código',async t=>{
 const e=await entorno(t),codigo=await e.otp();await e.sql('DELETE FROM ritmo.acceso_sesiones WHERE usuario_id=$1',[ids.nueva]);
 await e.solicitudes.admitir(e.identidad(),codigo);
 assert.equal(await e.f('SELECT ritmo.es_admin_plataforma() AS r'),true);
});
test('dueño WhatsApp: la sesión se liga al OTP aunque el registro de salones esté cerrado',async t=>{
 const e=await entorno(t),sid=randomUUID(),i={usuarioId:ids.nueva,sesionId:sid,aal:'aal1'};
 await e.sql('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[sid,ids.nueva]);
 const solicitud=await e.solicitudes.crear('whatsapp','525511111111','ip-dueno');
 const evento=e.evento('525511111111','482913',{user:{id:ids.nueva,phone:'525511111111'}});await e.codigos.entregar(evento.raw,evento.headers);
 const origen='https://agendappx.test',rutas=rutasAcceso(e.poolAPI,{verificar:async()=>i},{habilitado:true,correo:false,registro:false,sesionesConOtp:true,key:e.key,origen,supabaseURL:'https://zkqwephmuflbuagevvxj.supabase.co',llavePublica:'sb_publishable_prueba_local',salones:new Set(),ip:()=> 'ip-dueno',fetch:async u=>{assert.match(String(u),/auth\/v1\/verify$/);return Response.json({access_token:'solo-prueba',user:{id:ids.nueva}});}});
 const req=Readable.from([Buffer.from(JSON.stringify({...solicitud,destino:'5511111111',codigo:'482913'}))]);req.method='POST';req.headers={origin:origen,'content-type':'application/json'};let estado;
 await rutas(req,{writeHead(s){estado=s;return this;},end(){}},new URL(origen+'/api/acceso/verificar'));assert.equal(estado,200);
 assert.equal((await e.sql('SELECT solicitud_otp FROM ritmo.acceso_sesiones WHERE sesion_id=$1',[sid])).rows[0].solicitud_otp,solicitud.id);
 assert.equal(await e.f('SELECT ritmo.es_admin_plataforma() AS r',[],i),true);
});
