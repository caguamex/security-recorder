import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cuentasEntorno, ids, sesiones } from './cuentas-entorno.mjs';
import { Invitaciones } from '../build/cuentas/invitaciones.js';
let e, invitaciones;
const admin = { usuarioId:ids.admin,sesionId:sesiones.admin,aal:'aal2' };
const nueva = { usuarioId:ids.nueva,sesionId:sesiones.nueva,aal:'aal1' };
const datos = { nombre:'Nueva especialista',rol:'especialista',servicios:['cejas'],horario:{lun:['10:00','19:00']} };
const ip = texto => createHash('sha256').update(texto).digest('hex');
before(async()=>{
  e=await cuentasEntorno(); invitaciones=new Invitaciones(e.poolAPI);
  await e.como('admin',ids.salon,c=>c.query(`INSERT INTO ritmo.belleza_objetos(negocio_id,id,version,data)
    VALUES ($1,'cejas',1,$2::jsonb)`,[ids.salon,JSON.stringify({id:'cejas',kind:'servicio',nombre:'Cejas',precio:500,duracion:60})]));
});
after(async()=>{ await e?.cerrar(); });

test('Invitación: 128 bits, hash en base, 48 horas y listado sin código recuperable',async()=>{
  const i=await invitaciones.crear(admin,ids.salon,datos);
  assert.equal(Buffer.from(i.codigo,'base64url').length,16);
  const fila=(await e.db.query('SELECT * FROM ritmo.invitaciones WHERE id=$1',[i.id])).rows[0];
  assert.equal(fila.codigo_hash,createHash('sha256').update(i.codigo).digest('hex'));
  assert.equal(new Date(fila.vence_en)-new Date(fila.creada_en),48*60*60*1000);
  assert.equal(JSON.stringify(fila).includes(i.codigo),false);
  const lista=await invitaciones.pendientes(admin,ids.salon);
  assert.equal(JSON.stringify(lista).includes(i.codigo),false);
  assert.equal(JSON.stringify(lista).includes(fila.codigo_hash),false);
  const previa=await invitaciones.ver(i.codigo,ip('previa'));
  assert.equal(previa.salon,"AB' Beauty Room");
  assert.equal(previa.rol,'especialista'); assert.equal(previa.codigo_hash,undefined);
});

test('Solo Admin con aal2 invita; servicios de otro salón o horarios inválidos se rechazan',async()=>{
  for(const identidad of [{...admin,aal:'aal1'},{usuarioId:ids.recepcion,sesionId:sesiones.recepcion,aal:'aal1'},{usuarioId:ids.ajena,sesionId:sesiones.ajena,aal:'aal2'}]){
    await assert.rejects(invitaciones.crear(identidad,ids.salon,datos),v=>v.status===403);
  }
  await assert.rejects(invitaciones.crear(admin,ids.salon,{...datos,servicios:['servicio-ajeno']}),v=>v.status===400);
  await assert.rejects(invitaciones.crear(admin,ids.salon,{...datos,horario:{lun:['20:00','10:00']}}),v=>v.status===400);
});

test('Aceptar consume una sola vez y crea únicamente el perfil aprobado por Admin',async()=>{
  const i=await invitaciones.crear(admin,ids.salon,datos);
  const salon=await invitaciones.aceptar(nueva,i.codigo,{nombre:'  Karla  ',resumenCorreo:false,rol:'admin'},ip('aceptacion'));
  assert.equal(salon,ids.salon);
  const m=(await e.db.query('SELECT * FROM ritmo.miembros WHERE negocio_id=$1 AND usuario_id=$2',[ids.salon,ids.nueva])).rows[0];
  assert.equal(m.nombre,'Karla'); assert.equal(m.rol,'especialista'); assert.equal(m.resumen_correo,false);
  assert.deepEqual(m.servicios,['cejas']); assert.equal(m.ver_todas,false);
  await assert.rejects(invitaciones.aceptar({usuarioId:ids.ajena,sesionId:sesiones.ajena,aal:'aal2'},i.codigo,{nombre:'Otra',resumenCorreo:true},ip('repetida')),v=>v.status===400);
  assert.equal((await e.db.query('SELECT usada_por FROM ritmo.invitaciones WHERE id=$1',[i.id])).rows[0].usada_por,ids.nueva);
});

test('Invitación vencida, revocada o incorrecta no se acepta',async()=>{
  for(const estado of ['vencida','revocada']){
    const i=await invitaciones.crear(admin,ids.salon,datos);
    if(estado==='vencida') await e.db.query(`UPDATE ritmo.invitaciones SET creada_en=now()-interval '49 hours',vence_en=now()-interval '1 hour' WHERE id=$1`,[i.id]);
    else await e.db.query('UPDATE ritmo.invitaciones SET revocada_en=now() WHERE id=$1',[i.id]);
    await assert.rejects(invitaciones.ver(i.codigo,ip(estado)),v=>v.status===404);
    await assert.rejects(invitaciones.aceptar(nueva,i.codigo,{nombre:'Karla',resumenCorreo:true},ip(estado)),v=>v.status===400);
  }
  await assert.rejects(invitaciones.aceptar(nueva,'x'.repeat(22),{nombre:'Karla',resumenCorreo:true},ip('inexistente')),v=>v.status===400);
});

test('Diez intentos por IP y hora: los errores no revierten el contador',async()=>{
  for(let n=0;n<10;n++) await assert.rejects(invitaciones.ver('x'.repeat(22),ip('limite')),v=>v.status===404);
  await assert.rejects(invitaciones.ver('x'.repeat(22),ip('limite')),v=>v.status===429);
  const r=(await e.db.query('SELECT intentos FROM ritmo.intentos_invitacion WHERE ip_hash=$1',[ip('limite')])).rows[0];
  assert.equal(r.intentos,10);
});

test('Funciones privilegiadas con búsqueda fija, sin acceso anon/authenticated ni tablas de límites accesibles',async()=>{
  const funciones=(await e.db.query(`SELECT p.proname,p.proconfig,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ritmo' AND p.prosecdef`)).rows;
  assert.ok(funciones.length>=6);
  for(const f of funciones){ assert.equal(f.anon,false);assert.equal(f.authenticated,false);assert.ok(f.proconfig.includes('search_path=""')); }
  const c=await e.poolAPI.connect();
  try { await assert.rejects(c.query('SELECT * FROM ritmo.intentos_invitacion'),v=>v.code==='42501'); }
  finally { c.release(); }
});
