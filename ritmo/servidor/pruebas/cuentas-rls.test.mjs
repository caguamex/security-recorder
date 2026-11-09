import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cuentasEntorno, ids, sesiones } from './cuentas-entorno.mjs';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import { VerificadorJWT } from '../build/cuentas/jwt.js';
import { RepositorioConCuentas } from '../build/cuentas/repositorio.js';
let e;
before(async () => { e = await cuentasEntorno(); });
after(async () => { await e?.cerrar(); });
const rlsError = p => assert.rejects(p, v => v.code === '42501');
async function alta(usuario, negocio, data) {
  return e.como(usuario, negocio, c => c.query(`INSERT INTO ritmo.belleza_objetos
    (negocio_id,id,version,data) VALUES ($1,$2,1,$3::jsonb)`, [negocio,data.id,JSON.stringify(data)]));
}
const servicio = { id:'cejas',kind:'servicio',nombre:'Cejas',precio:500,duracion:60,foto:null };
const clienta = { id:'cli-a',kind:'clienta',nombre:'Clienta A',telefono:'5512345678',notas:'Celular 55 1234 5678' };
const cita = { id:'cita-a',kind:'cita',clienta:'cli-a',servicio:'cejas',especialista:ids.especialista,
  date:'2026-11-01',start:'10:00',duracion:60,estado:'pendiente',notas:'Sin perfume',ingresos:999 };

test('RLS real: rol sin superusuario, propietario ni BYPASSRLS; conserva registro heredado', async () => {
  const r = await e.como('admin',ids.salon,async c => {
    const rol = (await c.query(`SELECT current_user AS usuario, rolsuper, rolbypassrls
      FROM pg_roles WHERE rolname = current_user`)).rows[0];
    assert.equal(rol.usuario,'ritmo_api'); assert.equal(rol.rolsuper,false); assert.equal(rol.rolbypassrls,false);
    assert.notEqual((await c.query(`SELECT tableowner FROM pg_tables WHERE schemaname='ritmo' AND tablename='belleza_objetos'`)).rows[0].tableowner,'ritmo_api');
    return (await c.query(`SELECT version FROM ritmo.belleza_objetos WHERE id='heredado'`)).rows;
  });
  assert.equal(r[0].version,7);
  await alta('admin',ids.salon,servicio); await alta('admin',ids.salon,clienta); await alta('admin',ids.salon,cita);
  await alta('admin',ids.salon,{ ...clienta,id:'cli-b',nombre:'Clienta B',telefono:'5598765432' });
  await alta('admin',ids.salon,{ ...cita,id:'cita-b',clienta:'cli-b',especialista:ids.otra });
  await alta('ajena',ids.otro,{ ...servicio,id:'cejas' });
});

test('Otro salón no lee ni modifica objetos aunque conozca sus ids', async () => {
  const filas = await e.como('ajena',ids.otro,c => c.query(`SELECT id FROM ritmo.belleza_objetos WHERE negocio_id=$1`,[ids.salon]));
  assert.equal(filas.rows.length,0);
  await rlsError(alta('ajena',ids.otro,{ ...cita,id:'intrusa',especialista:ids.ajena }).then(() =>
    e.como('ajena',ids.otro,c => c.query(`INSERT INTO ritmo.belleza_objetos(negocio_id,id,version,data)
      VALUES ($1,'otro-intento',1,$2::jsonb)`,[ids.salon,JSON.stringify(servicio)]))));
  const cambio = await e.como('ajena',ids.otro,c => c.query(`UPDATE ritmo.belleza_objetos SET version=99 WHERE negocio_id=$1`,[ids.salon]));
  assert.equal(cambio.rows.length,0);
});

test('Especialista: RLS limita citas y clientas; ver todas no permite escribir ni adueñarse de una clienta', async () => {
  const listar = () => e.como('especialista',ids.salon,c => c.query(`SELECT id FROM ritmo.belleza_objetos ORDER BY id`));
  assert.ok((await listar()).rows.some(v=>v.id==='cita-a'));
  assert.ok(!(await listar()).rows.some(v=>v.id==='cita-b'||v.id==='cli-b'));
  await e.como('admin',ids.salon,c=>c.query('UPDATE ritmo.miembros SET ver_todas=true WHERE usuario_id=$1',[ids.especialista]));
  assert.ok((await listar()).rows.some(v=>v.id==='cita-b'));
  const intento = await e.como('especialista',ids.salon,c=>c.query(`UPDATE ritmo.belleza_objetos SET data=jsonb_set(data,'{start}','"12:00"') WHERE id='cita-b'`));
  assert.equal(intento.rows.length,0);
  await rlsError(alta('especialista',ids.salon,{ ...cita,id:'robar-clienta',clienta:'cli-b' }));
  await rlsError(alta('especialista',ids.salon,{ ...cita,id:'servicio-no-asignado',servicio:'cabello' }));
  await alta('especialista',ids.salon,{ ...clienta,id:'cli-nueva' });
  await alta('especialista',ids.salon,{ ...cita,id:'cita-nueva',clienta:'cli-nueva' });
});

test('Recepción: RLS bloquea precios, equipo, invitaciones y conexiones', async () => {
  const precios = await e.como('recepcion',ids.salon,c => c.query(`UPDATE ritmo.belleza_objetos SET data=jsonb_set(data,'{precio}','1') WHERE id='cejas'`));
  assert.equal(precios.rows.length,0);
  const equipo = await e.como('recepcion',ids.salon,c => c.query(`UPDATE ritmo.miembros SET rol='admin' WHERE usuario_id=$1`,[ids.recepcion]));
  assert.equal(equipo.rows.length,0);
  await rlsError(e.como('recepcion',ids.salon,c=>c.query(`INSERT INTO ritmo.invitaciones(negocio_id,codigo_hash,nombre,rol,creada_por)
    VALUES ($1,$2,'Invitada','especialista',$3)`,[ids.salon,'a'.repeat(64),ids.recepcion])));
  assert.equal((await e.como('recepcion',ids.salon,c=>c.query('SELECT * FROM ritmo.belleza_integraciones'))).rows.length,0);
});

test('Admin sin aal2 y cuenta revocada: siguiente lectura y escritura sin acceso', async () => {
  assert.equal((await e.como('admin',ids.salon,c=>c.query('SELECT * FROM ritmo.belleza_objetos'),'aal1')).rows.length,0);
  await rlsError(e.como('admin',ids.salon,c=>c.query(`INSERT INTO ritmo.belleza_objetos(negocio_id,id,version,data) VALUES ($1,'sin-mfa',1,$2)`,[ids.salon,JSON.stringify(servicio)]),'aal1'));
  await e.como('admin',ids.salon,c=>c.query('UPDATE ritmo.miembros SET activo=false WHERE usuario_id=$1',[ids.otra]));
  assert.equal((await e.como('otra',ids.salon,c=>c.query('SELECT * FROM ritmo.belleza_objetos'))).rows.length,0);
  const repo = new RepositorioConCuentas(e.poolAPI,{usuarioId:ids.otra,sesionId:sesiones.otra,aal:'aal1'},ids.salon);
  await assert.rejects(repo.snapshot(),v=>v.status===403);
});

test('Último Admin no se puede eliminar, desactivar ni cambiar de rol', async () => {
  for (const sql of ["DELETE FROM ritmo.miembros WHERE usuario_id=$1", "UPDATE ritmo.miembros SET activo=false WHERE usuario_id=$1", "UPDATE ritmo.miembros SET rol='recepcion' WHERE usuario_id=$1"]) {
    await assert.rejects(e.como('admin',ids.salon,c=>c.query(sql,[ids.admin])), /al menos un Admin/);
  }
});

test('Historial inalterable: crear, mover y cancelar conserva actor, fecha y estado previo', async () => {
  await e.como('admin',ids.salon,c=>c.query(`UPDATE ritmo.belleza_objetos SET data=jsonb_set(data,'{start}','"11:00"') WHERE id='cita-a'`));
  await e.como('recepcion',ids.salon,c=>c.query(`UPDATE ritmo.belleza_objetos SET data=jsonb_set(data,'{estado}','"cancelada"') WHERE id='cita-a'`));
  const r = await e.como('admin',ids.salon,c=>c.query(`SELECT * FROM ritmo.bitacora WHERE objeto_id='cita-a' ORDER BY id`));
  assert.deepEqual(r.rows.map(v=>v.accion),['crear','mover','cancelar']);
  assert.deepEqual(r.rows.map(v=>v.usuario_id),[ids.admin,ids.admin,ids.recepcion]);
  for (const fila of r.rows) assert.ok(new Date(fila.en).getTime()>0);
  assert.equal(r.rows[1].antes.start,'10:00'); assert.equal(r.rows[1].despues.start,'11:00');
  await rlsError(e.como('admin',ids.salon,c=>c.query('DELETE FROM ritmo.bitacora')));
});

test('Snapshot del servidor oculta teléfonos a Especialista, ingresos a Recepción y campos desconocidos', async () => {
  const repo = new RepositorioConCuentas(e.poolAPI,{usuarioId:ids.especialista,sesionId:sesiones.especialista,aal:'aal1'},ids.salon);
  const s = await repo.snapshot();
  assert.equal(s.full,true);
  assert.equal(s.records.find(v=>v.id==='cli-a').data.telefono,'55 •••• 5678');
  assert.equal(JSON.stringify(s).includes('5512345678'),false);
  assert.equal(JSON.stringify(s).includes('55 1234 5678'),false);
  assert.equal(s.records.find(v=>v.id==='cita-b').data.clienta,undefined);
  assert.equal(s.records.find(v=>v.id==='cita-a').data.ingresos,undefined);
  const rec = new RepositorioConCuentas(e.poolAPI,{usuarioId:ids.recepcion,sesionId:sesiones.recepcion,aal:'aal1'},ids.salon);
  assert.equal((await rec.snapshot()).records.find(v=>v.id==='cli-a').data.telefono,'5512345678');
  assert.equal((await rec.snapshot()).records.find(v=>v.id==='cita-a').data.ingresos,undefined);
});

test('Contexto transaccional no conserva una identidad al prestar la conexión de nuevo', async () => {
  await e.como('admin',ids.salon,c=>c.query('SELECT * FROM ritmo.negocios'));
  const c=await e.poolAPI.connect();
  try { assert.equal((await c.query('SELECT * FROM ritmo.belleza_objetos')).rows.length,0); }
  finally { c.release(); }
});


test('Edición, respuesta idempotente y conflicto conservan el teléfono oculto sin alterar el original', async () => {
  const repo=new RepositorioConCuentas(e.poolAPI,{usuarioId:ids.especialista,sesionId:sesiones.especialista,aal:'aal1'},ids.salon);
  const inicial=(await repo.snapshot()).records.find(v=>v.id==='cli-a');
  const cambio={id:'cli-a',baseVersion:inicial.version,mutationId:'mutacion_cliente_123456',data:{...inicial.data,nombre:'Nombre corregido'}};
  const ack=await repo.cambiar(cambio);
  assert.equal(ack.data.telefono,'55 •••• 5678');
  assert.equal((await repo.cambiar(cambio)).version,ack.version);
  assert.equal((await e.db.query("SELECT data->>'telefono' AS telefono FROM ritmo.belleza_objetos WHERE negocio_id=$1 AND id='cli-a'",[ids.salon])).rows[0].telefono,'5512345678');
  await assert.rejects(repo.cambiar({...cambio,mutationId:'otra_mutacion_12345678'}),v=>v.status===409 && v.current.data.telefono==='55 •••• 5678');
  const nota=await repo.historial('cita-a');
  assert.ok(nota.length>0); assert.equal(JSON.stringify(nota).includes('5512345678'),false);
  await assert.rejects(repo.historial(),v=>v.status===403);
});


test('Una reasignación retira el registro y bloquea el reenvío de una mutación antigua', async () => {
  const repo=new RepositorioConCuentas(e.poolAPI,{usuarioId:ids.especialista,sesionId:sesiones.especialista,aal:'aal1'},ids.salon);
  const original=(await repo.snapshot()).records.find(v=>v.id==='cita-nueva');
  const cambio={id:original.id,baseVersion:original.version,mutationId:'mutacion_cita_reasignada_123',data:{...original.data,start:'12:00'}};
  await repo.cambiar(cambio);
  await e.como('admin',ids.salon,c=>c.query(`UPDATE ritmo.belleza_objetos SET data=jsonb_set(data,'{especialista}',to_jsonb($1::text)) WHERE id='cita-nueva'`,[ids.recepcion]));
  await assert.rejects(repo.cambiar(cambio),v=>v.status===403);
  await e.como('admin',ids.salon,c=>c.query('UPDATE ritmo.miembros SET ver_todas=false WHERE usuario_id=$1',[ids.especialista]));
  assert.equal((await repo.snapshot()).records.some(r=>r.id==='cita-nueva'),false);
});


test('Una sesión revocada en Supabase se rechaza aunque conserve un JWT con firma válida', async () => {
  const par=await generateKeyPair('ES256',{extractable:true});
  const key={...await exportJWK(par.publicKey),kid:'prueba',alg:'ES256'};
  const origen='https://proyecto-local.supabase.co';
  const verificador=new VerificadorJWT(origen,{fetch:async()=>new Response(JSON.stringify({keys:[key]}))});
  const ahora=Math.floor(Date.now()/1000);
  const token=await new SignJWT({session_id:sesiones.especialista,aal:'aal1',role:'authenticated'})
    .setProtectedHeader({alg:'ES256',kid:'prueba'}).setSubject(ids.especialista).setIssuer(origen+'/auth/v1')
    .setAudience('authenticated').setIssuedAt(ahora).setExpirationTime(ahora+3600).sign(par.privateKey);
  const ident=await verificador.verificar(token);
  const repo=new RepositorioConCuentas(e.poolAPI,ident,ids.salon);
  await repo.snapshot();
  await e.db.query('DELETE FROM auth.sessions WHERE id=$1',[sesiones.especialista]);
  assert.deepEqual(await verificador.verificar(token),ident);
  await assert.rejects(repo.snapshot(),v=>v.status===401);
  // La comprobación de sesión también está en RLS, aunque se omita el repositorio.
  const c=await e.poolAPI.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('ritmo.usuario',$1,true),set_config('ritmo.negocio',$2,true),
      set_config('request.jwt.claims',$3,true)`,[ident.usuarioId,ids.salon,JSON.stringify({sub:ident.usuarioId,aal:ident.aal,session_id:ident.sesionId})]);
    assert.equal((await c.query('SELECT * FROM ritmo.belleza_objetos')).rows.length,0);
    await c.query('COMMIT');
  } finally { c.release(); }
  await e.db.query('INSERT INTO auth.sessions(id,user_id) VALUES ($1,$2)',[sesiones.especialista,ids.especialista]);
});

test('Treinta días de inactividad cierran Recepción, sin reactivarse al refrescar el token', async () => {
  const repo=new RepositorioConCuentas(e.poolAPI,{usuarioId:ids.recepcion,sesionId:sesiones.recepcion,aal:'aal1'},ids.salon);
  await repo.snapshot();
  await e.db.query("UPDATE ritmo.actividad_sesiones SET ultima_actividad=now()-interval '31 days' WHERE sesion_id=$1",[sesiones.recepcion]);
  await assert.rejects(repo.snapshot(),v=>v.status===401);
  await e.db.query('UPDATE ritmo.actividad_sesiones SET ultima_actividad=now() WHERE sesion_id=$1',[sesiones.recepcion]);
  await e.db.query("UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id=$1",[sesiones.recepcion]);
  await assert.rejects(repo.snapshot(),v=>v.status===401);
});
