// Solo PostgreSQL local. Nunca elimina cuentas ni datos de producción.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {entornoSocial,ids} from './social-entorno.mjs';

async function entorno(t){
 const e=await entornoSocial();
 const c=await e.pool.connect();t.after(async()=>{c.release();await e.cerrar();});
 await c.query('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email text');
 for(const m of ['20261030160000_usuarios_contrasena.sql','20261030180000_panel_plataforma.sql','20261030190000_codigos_manuales.sql']){
  await c.query("SELECT set_config('ritmo.plataforma_admin',$1,false)",[ids.admin]);
  await c.query(await readFile(new URL('../../supabase/migrations/'+m,import.meta.url),'utf8'));
 }
 const usuarios=(await c.query('SELECT id FROM auth.users ORDER BY id')).rows.map(x=>x.id);
 await c.query("SELECT set_config('ritmo.reinicio_autorizado','agendappx-20261030',false),set_config('ritmo.reinicio_respaldo',$1,false),set_config('ritmo.reinicio_usuarios',$2,false)",['a'.repeat(64),JSON.stringify(usuarios)]);
 const reinicio=await readFile(new URL('../../herramientas/reinicio-datos.sql',import.meta.url),'utf8');
 return {c,reinicio,usuarios};
}

test('reinicio autorizado: vacía los salones y accesos, conserva WhatsApp de códigos y no toca otros esquemas',async t=>{
 const {c,reinicio,usuarios}=await entorno(t);
 await c.query("INSERT INTO ritmo.plataforma_conexiones(negocio_id,esperado) VALUES('codigos','528661241483') ON CONFLICT DO NOTHING");
 await c.query("INSERT INTO ritmo.plataforma_sesiones(negocio_id,llave,cifrado) VALUES('codigos',repeat('a',64),'{}')");
 await c.query('CREATE SCHEMA ajeno; CREATE TABLE ajeno.registros(id integer); INSERT INTO ajeno.registros VALUES(7)');
 const antes=(await c.query('SELECT to_jsonb(c) AS datos FROM ritmo.plataforma_conexiones c')).rows;
 await c.query(reinicio);
 for(const tabla of ['negocios','miembros','belleza_objetos','usuarios_acceso','registro_solicitudes','social_moderadores','plataforma_admins','codigos_manuales'])assert.equal(Number((await c.query('SELECT count(*) AS n FROM ritmo.'+tabla)).rows[0].n),0,tabla);
 assert.equal((await c.query('SELECT asignados FROM ritmo.fundadoras_control')).rows[0].asignados,0);
 assert.deepEqual((await c.query('SELECT to_jsonb(c) AS datos FROM ritmo.plataforma_conexiones c')).rows,antes);
 assert.equal(Number((await c.query('SELECT count(*) AS n FROM ritmo.plataforma_sesiones')).rows[0].n),1);
 assert.equal((await c.query('SELECT id FROM ajeno.registros')).rows[0].id,7);
 // Auth se elimina después mediante su API Admin; este SQL no borra ni modifica usuarios a escondidas.
 assert.equal(Number((await c.query('SELECT count(*) AS n FROM auth.users')).rows[0].n),usuarios.length);
});

test('reinicio: una cuenta nueva después de la revisión impide todo el borrado',async t=>{
 const {c,reinicio}=await entorno(t);
 const antes=Number((await c.query('SELECT count(*) AS n FROM ritmo.negocios')).rows[0].n);
 await c.query("INSERT INTO auth.users(id) VALUES('12345678-1234-4234-8234-123456789012')");
 await assert.rejects(()=>c.query(reinicio),/Las cuentas cambiaron/);
 await c.query('ROLLBACK');
 assert.equal(Number((await c.query('SELECT count(*) AS n FROM ritmo.negocios')).rows[0].n),antes);
});
