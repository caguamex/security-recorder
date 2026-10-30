import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {entornoSocial,ids,sesiones} from './social-entorno.mjs';
import {enTransaccion} from '../build/cuentas/contexto.js';
import {rutasPlataforma} from '../build/plataforma/http.js';
const identidad=(u='admin',aal='aal2')=>({usuarioId:ids[u],sesionId:sesiones[u],aal});
async function entorno(t){
 const e=await entornoSocial();t.after(()=>e.cerrar());
 const sql=async(q,a)=>{const c=await e.pool.connect();try{return await c.query(q,a);}finally{c.release();}};
 await sql("SELECT set_config('ritmo.plataforma_admin',$1,false)",[ids.admin]);
 await sql(await readFile(new URL('../../supabase/migrations/20261030180000_panel_plataforma.sql',import.meta.url),'utf8'));
 for(const u of ['admin','recepcion','ajena','nueva'])await sql('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[sesiones[u],ids[u]]);
 await sql("INSERT INTO ritmo.negocios_planes(negocio_id,plan,estado,prueba_inicio,prueba_fin) VALUES($1,'salon','prueba',now(),now()+interval '30 days') ON CONFLICT(negocio_id) DO UPDATE SET estado='prueba',plan='salon',prueba_inicio=EXCLUDED.prueba_inicio,prueba_fin=EXCLUDED.prueba_fin",[ids.otro]);
 const f=(i,q,a=[])=>enTransaccion(e.poolAPI,i,null,async c=>(await c.query(q,a)).rows[0]?.r);
 return {...e,sql,f};
}
test('panel: solo el administrador de la plataforma con MFA; nadie más ve los salones',async t=>{
 const e=await entorno(t);
 assert.equal(await e.f(identidad(),'SELECT ritmo.es_admin_plataforma() AS r'),true);
 for(const i of [identidad('admin','aal1'),identidad('recepcion'),identidad('ajena'),identidad('nueva')]){
  assert.equal(await e.f(i,'SELECT ritmo.es_admin_plataforma() AS r'),false);
  await assert.rejects(()=>e.f(i,'SELECT ritmo.plataforma_salones() AS r'),x=>x.code==='42501');
  await assert.rejects(()=>e.f(i,"SELECT ritmo.plataforma_accion($1,'verificar','{\"si\":true}') AS r",[ids.otro]),x=>x.code==='42501');}
 // El rol de la API no lee las tablas del panel directamente.
 await assert.rejects(()=>enTransaccion(e.poolAPI,identidad(),null,c=>c.query('SELECT * FROM ritmo.plataforma_admins')),x=>x.code==='42501');
 await assert.rejects(()=>enTransaccion(e.poolAPI,identidad(),null,c=>c.query('SELECT * FROM ritmo.plataforma_bitacora')),x=>x.code==='42501');
});
test('panel: resumen y lista de salones con plan, dueña, personas y uso',async t=>{
 const e=await entorno(t);await e.sql("UPDATE auth.users SET phone='525522222222' WHERE id=$1",[ids.ajena]);
 const r=await e.f(identidad(),'SELECT ritmo.plataforma_resumen() AS r');assert.equal(r.salones,2);assert.equal(r.enPrueba,1);assert.equal(r.suspendidos,0);assert.ok('whatsappPlataforma' in r);
 const s=await e.f(identidad(),'SELECT ritmo.plataforma_salones() AS r');assert.equal(s.length,2);
 const otro=s.find(x=>x.id===ids.otro);assert.equal(otro.plan,'salon');assert.equal(otro.estado,'prueba');assert.deepEqual(otro.duena,{nombre:'ajena',whatsapp:'525522222222'});assert.equal(otro.personas,1);
 assert.equal(s.find(x=>x.id===ids.salon).personas,4);
});
test('panel: verificar, extender prueba, cambiar plan, pausar y reactivar quedan en la bitácora',async t=>{
 const e=await entorno(t),acc=(a,v)=>e.f(identidad(),'SELECT ritmo.plataforma_accion($1,$2,$3::jsonb) AS r',[ids.otro,a,JSON.stringify(v)]);
 await acc('verificar',{si:true});assert.equal((await e.sql('SELECT verificado FROM ritmo.publico_perfiles WHERE negocio_id=$1',[ids.otro])).rows[0].verificado,true);
 const antes=(await e.sql('SELECT prueba_fin FROM ritmo.negocios_planes WHERE negocio_id=$1',[ids.otro])).rows[0].prueba_fin;
 await acc('extender_prueba',{dias:7});const despues=(await e.sql('SELECT prueba_fin FROM ritmo.negocios_planes WHERE negocio_id=$1',[ids.otro])).rows[0].prueba_fin;
 assert.equal(new Date(despues)-new Date(antes),7*86400000);await assert.rejects(()=>acc('extender_prueba',{dias:90}),x=>x.code==='22023');
 await assert.rejects(()=>e.f(identidad(),'SELECT ritmo.plataforma_accion($1,$2,$3::jsonb) AS r',[ids.salon,'extender_prueba','{"dias":3}']),x=>x.code==='22023');
 await acc('plan',{plan:'pro'});assert.equal((await e.sql('SELECT plan FROM ritmo.negocios_planes WHERE negocio_id=$1',[ids.otro])).rows[0].plan,'pro');
 await assert.rejects(()=>acc('suspender',{motivo:''}),x=>x.code==='22023');
 await e.sql('UPDATE ritmo.publico_perfiles SET visible=true WHERE negocio_id=$1',[ids.otro]);
 await acc('suspender',{motivo:'Pago pendiente'});
 assert.equal((await e.sql('SELECT visible FROM ritmo.publico_perfiles WHERE negocio_id=$1',[ids.otro])).rows[0].visible,false);
 // En pausa: su Admin no puede escribir en la agenda ni volver a mostrarse en Explorar.
 await assert.rejects(()=>e.como('ajena',ids.otro,c=>c.query("INSERT INTO ritmo.belleza_objetos(negocio_id,id,version,data,revision) VALUES($1,'nuevo',1,$2,1)",[ids.otro,{id:'nuevo',kind:'servicio',nombre:'X',precio:1,duracion:30}])),x=>/suspendido/.test(x.message));
 await e.sql('UPDATE ritmo.publico_perfiles SET visible=true WHERE negocio_id=$1',[ids.otro]);assert.equal((await e.sql('SELECT visible FROM ritmo.publico_perfiles WHERE negocio_id=$1',[ids.otro])).rows[0].visible,false);
 assert.equal((await e.f(identidad(),'SELECT ritmo.plataforma_salones() AS r')).find(x=>x.id===ids.otro).motivoSuspension,'Pago pendiente');
 await acc('reactivar',{});await e.como('ajena',ids.otro,c=>c.query("INSERT INTO ritmo.belleza_objetos(negocio_id,id,version,data,revision) VALUES($1,'nuevo',1,$2,1)",[ids.otro,{id:'nuevo',kind:'servicio',nombre:'X',precio:1,duracion:30}]));
 const b=await e.f(identidad(),'SELECT ritmo.plataforma_bitacora_reciente() AS r');assert.deepEqual(b.map(x=>x.accion),['reactivar','suspender','plan','extender_prueba','verificar']);
});
test('rutas del panel: origen, método y acceso',async t=>{
 const e=await entorno(t),origen='https://agendappx.test';let quien=identidad();
 const rutas=rutasPlataforma(e.poolAPI,{verificar:async()=>quien},()=>origen);
 const llamar=async(ruta,{metodo='GET',datos,origin}={})=>{const req=Readable.from(datos?[Buffer.from(JSON.stringify(datos))]:[]);req.method=metodo;req.headers={'content-type':'application/json',authorization:'Bearer x',...(origin?{origin}:{})};let estado=0,cuerpo='';const res={writeHead(s){estado=s;return this;},end(b){cuerpo=b;}};await rutas(req,res,new URL('https://agendappx.test'+ruta));return {estado,d:JSON.parse(cuerpo)};};
 assert.equal((await llamar('/api/plataforma/yo')).d.admin,true);
 assert.equal((await llamar('/api/plataforma/salones')).d.salones.length,2);
 await assert.rejects(()=>llamar('/api/plataforma/salones/'+ids.otro,{metodo:'POST',datos:{accion:'verificar',valor:{si:true}}}),x=>x.status===403);
 assert.equal((await llamar('/api/plataforma/salones/'+ids.otro,{metodo:'POST',datos:{accion:'verificar',valor:{si:true}},origin:origen})).d.hecho,true);
 await assert.rejects(()=>llamar('/api/plataforma/salones/'+ids.otro,{metodo:'POST',datos:{accion:'borrar'},origin:origen}),x=>x.status===400);
 quien=identidad('ajena');assert.equal((await llamar('/api/plataforma/yo')).d.admin,false);await assert.rejects(()=>llamar('/api/plataforma/resumen'),x=>x.status===403);
 assert.equal(await rutas({method:'GET',headers:{}},{},new URL('https://agendappx.test/api/otra')),false);
});
