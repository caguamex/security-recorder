import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cuentasEntorno,ids,sesiones} from './cuentas-entorno.mjs';
import {validarHorario,tramosDia,disponible} from '../build/negocio/horarios.js';
import {rutasNegocio} from '../build/negocio/http.js';
const archivo=new URL('../../supabase/migrations/20261029204424_negocio_horarios_etapa2.sql',import.meta.url);
const migracion=await readFile(archivo,'utf8');
async function entorno(t){const e=await cuentasEntorno();t.after(()=>e.cerrar());return e;}
const semana={lun:['09:00','18:00'],mar:['10:00','20:00'],comida:['14:00','15:00'],dom:null};
test('Horario 24 h: descanso, comida, excepción y citas ocupadas',()=>{
 assert.deepEqual(validarHorario(semana),semana);assert.throws(()=>validarHorario({lun:['18:00','09:00']}));assert.throws(()=>validarHorario({lunes:['10:00','20:00']}));assert.throws(()=>validarHorario({lun:[null,null]}));
 const tramos=tramosDia('2026-11-02',semana,'10:00','20:00');assert.deepEqual(tramos,[[600,840],[900,1080]]);assert.equal(disponible('13:30',60,tramos,[]),false);assert.equal(disponible('15:00',60,tramos,[{start:'15:30',duracion:30}]),false);assert.equal(disponible('16:00',60,tramos,[]),true);assert.deepEqual(tramosDia('2026-11-01',semana),[]);assert.deepEqual(tramosDia('2026-11-02',semana,'10:00','20:00',{tipo:'libre'}),[]);assert.deepEqual(tramosDia('2026-11-02',semana,'10:00','20:00',{tipo:'horario',desde:'11:00',hasta:'13:00'}),[[660,780]]);
});
test('Migración aditiva: conserva agenda y versiones, sin permisos de Data API',async t=>{
 const e=await entorno(t);assert.equal((await e.db.query("SELECT version FROM ritmo.belleza_objetos WHERE id='heredado'")).rows[0].version,7);
 for(const rol of ['anon','authenticated','agendappx_whatsapp']){const r=await e.db.query("SELECT has_table_privilege($1,'ritmo.horario_especial','SELECT') AS permitido,has_function_privilege($1,'ritmo.guardar_horario(uuid,uuid,jsonb,jsonb)','EXECUTE') AS ejecutar",[rol]);assert.equal(r.rows[0].permitido,false);assert.equal(r.rows[0].ejecutar,false);}
 const r=await e.db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='ritmo.horario_especial'::regclass");assert.equal(r.rows[0].relrowsecurity,true);assert.equal(r.rows[0].relforcerowsecurity,true);
});
test('RLS: especialista cambia solo su horario, Admin cualquiera, revocación al momento',async t=>{
 const e=await entorno(t);const guardar=(quien,n,u,h=semana,ex=[])=>e.como(quien,n,c=>c.query('SELECT ritmo.guardar_horario($1,$2,$3::jsonb,$4::jsonb)',[n,u,JSON.stringify(h),JSON.stringify(ex)]));
 await guardar('especialista',ids.salon,ids.especialista,semana,[{fecha:'2026-12-01',tipo:'libre'}]);
 assert.deepEqual((await e.db.query('SELECT horario FROM ritmo.miembros WHERE usuario_id=$1',[ids.especialista])).rows[0].horario,semana);
 await assert.rejects(()=>guardar('especialista',ids.salon,ids.otra),x=>x.code==='42501');await assert.rejects(()=>guardar('ajena',ids.salon,ids.especialista));
 await guardar('admin',ids.salon,ids.otra,{lun:['11:00','18:00']});
 const otros=await e.como('ajena',ids.otro,c=>c.query('SELECT * FROM ritmo.horario_especial WHERE negocio_id=$1',[ids.salon]));assert.deepEqual(otros.rows,[]);
 await e.db.query('UPDATE ritmo.miembros SET activo=false WHERE usuario_id=$1',[ids.especialista]);await assert.rejects(()=>guardar('especialista',ids.salon,ids.especialista));
});
test('Horario: valores inválidos y fechas repetidas revierten íntegro el cambio',async t=>{
 const e=await entorno(t);const guardar=(h,ex=[])=>e.como('admin',ids.salon,c=>c.query('SELECT ritmo.guardar_horario($1,$2,$3::jsonb,$4::jsonb)',[ids.salon,ids.especialista,JSON.stringify(h),JSON.stringify(ex)]));
 await guardar(semana);await assert.rejects(()=>guardar({lun:[null,null]}));await assert.rejects(()=>guardar({rol:'admin'}));await assert.rejects(()=>guardar({lun:['08:00','18:00']},[{fecha:'2026-12-01',tipo:'libre'},{fecha:'2026-12-01',tipo:'libre'}]));assert.deepEqual((await e.db.query('SELECT horario FROM ritmo.miembros WHERE usuario_id=$1',[ids.especialista])).rows[0].horario,semana);
});
test('API de negocio: estadísticas solo Admin/MFA, origen y membresía del salón',async t=>{
 const e=await entorno(t),origen='https://prueba.agendappx.local';let ident={usuarioId:ids.admin,sesionId:sesiones.admin,aal:'aal2'};
 const rutas=rutasNegocio(e.poolAPI,{verificar:async()=>ident},origen);
 async function pedir(ruta,extra={}){let texto,status;const res={writeHead(n){status=n;return this;},end(t){texto=t;}};await rutas({method:'GET',headers:{authorization:'Bearer prueba',...extra}},res,new URL('/api/negocios/'+ids.salon+'/gestion/'+ruta,origen));return {status,data:JSON.parse(texto)};}
 assert.equal((await pedir('estadisticas')).status,200);ident={usuarioId:ids.recepcion,sesionId:sesiones.recepcion,aal:'aal1'};await assert.rejects(()=>pedir('estadisticas'),x=>x.status===403);assert.equal((await pedir('horarios')).data.propia,ids.recepcion);
 ident={usuarioId:ids.ajena,sesionId:sesiones.ajena,aal:'aal2'};await assert.rejects(()=>pedir('horarios'),x=>x.status===403);ident={usuarioId:ids.admin,sesionId:sesiones.admin,aal:'aal1'};await assert.rejects(()=>pedir('estadisticas'),x=>x.status===403);await assert.rejects(()=>pedir('resumen',{origin:'https://ajeno.example'}),x=>x.status===403);
});


test('Reservas: comida, día libre, turno, cruces y excepción solo Admin se validan en servidor',async t=>{
 const e=await entorno(t);const {RepositorioConCuentas}=await import('../build/cuentas/repositorio.js');
 const identidad=u=>({usuarioId:ids[u],sesionId:sesiones[u],aal:u==='admin'?'aal2':'aal1'}),repo=u=>new RepositorioConCuentas(e.poolAPI,identidad(u),ids.salon);
 const alta=(u,d)=>repo(u).cambiar({id:d.id,data:d,baseVersion:0,mutationId:crypto.randomUUID()});
 await alta('admin',{id:'cejas',kind:'servicio',nombre:'Cejas',precio:300,duracion:60});await alta('admin',{id:'cli',kind:'clienta',nombre:'Mariana',telefono:'5511111111'});
 await e.como('admin',ids.salon,c=>c.query('SELECT ritmo.guardar_horario($1,$2,$3::jsonb,$4::jsonb)',[ids.salon,ids.especialista,JSON.stringify(semana),'[]']));
 const base={kind:'cita',clienta:'cli',servicio:'cejas',especialista:ids.especialista,date:'2026-11-02',start:'13:30',estado:'pendiente'};
 await assert.rejects(()=>alta('recepcion',{...base,id:'comida'}),x=>x.status===400);
 await assert.rejects(()=>alta('admin',{...base,id:'fuera'}),x=>x.status===400);
 await alta('admin',{...base,id:'excepcion',fueraHorario:true});
 await assert.rejects(()=>alta('recepcion',{...base,id:'trampa',start:'09:00',fueraHorario:true}),x=>[400,403].includes(x.status));
 await alta('recepcion',{...base,id:'libre',start:'16:00'});
 await assert.rejects(()=>alta('admin',{...base,id:'empalme',start:'16:30',fueraHorario:true}),x=>x.status===409);
 await assert.rejects(()=>alta('recepcion',{...base,id:'domingo',date:'2026-11-01',start:'12:00'}),x=>x.status===400);
});
