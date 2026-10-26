import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { ESQUEMA } from '../build/repositorio.js';
import { enTransaccion } from '../build/cuentas/contexto.js';
export const ids = {
  salon: '11111111-1111-4111-8111-111111111111', otro: '22222222-2222-4222-8222-222222222222',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', recepcion: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  especialista: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', otra: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  ajena: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', nueva: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
};
export const sesiones = Object.fromEntries(['admin','recepcion','especialista','otra','ajena','nueva'].map(k=>[k, ids[k].slice(0,-1)+'0']));
export async function cuentasEntorno() {
  const db = new PGlite(); let tail = Promise.resolve();
  const pool = { async connect() {
    const anterior = tail; let liberar;
    tail = new Promise(r => { liberar = r; }); await anterior;
    return { release: liberar, async query(sql, args) {
      if (args) return db.query(sql, args);
      return (await db.exec(sql)).at(-1) || { rows: [] };
    } };
  } };
  await db.exec(`CREATE ROLE ritmo_api NOLOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),not_after timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth TO ritmo_api;
    CREATE SCHEMA ritmo; SET search_path = ritmo, pg_catalog;`);
  for (const u of ['admin','recepcion','especialista','otra','ajena','nueva']) {
    await db.query('INSERT INTO auth.users(id) VALUES ($1)', [ids[u]]);
    await db.query('INSERT INTO auth.sessions(id,user_id) VALUES ($1,$2)', [sesiones[u],ids[u]]);
  }
  await db.exec(ESQUEMA);
  // Un registro heredado demuestra que el script conserva datos y versiones.
  await db.query(`INSERT INTO ritmo.belleza_objetos(id,version,data,revision)
    VALUES ('heredado',7,$1,12)`, [JSON.stringify({ id:'heredado', kind:'servicio', nombre:'Heredado', precio:500, duracion:60 })]);
  await db.query(`SELECT set_config('ritmo.migracion_autorizada','si',false),
    set_config('ritmo.migracion_negocio',$1,false), set_config('ritmo.migracion_admin',$2,false)`,[ids.salon,ids.admin]);
  const ruta = new URL('../../supabase/migrations/', import.meta.url);
  const nombre = (await readdir(ruta)).find(n => n.endsWith('_cuentas_equipo.sql'));
  await db.exec(await readFile(new URL(nombre, ruta), 'utf8'));
  await db.query('INSERT INTO ritmo.negocios(id,nombre) VALUES ($1,$2)', [ids.otro, 'Otro salón']);
  await db.query('INSERT INTO ritmo.belleza_estado(negocio_id,revision) VALUES ($1,0)',[ids.otro]);
  for (const [u, negocio, rol] of [['recepcion',ids.salon,'recepcion'],['especialista',ids.salon,'especialista'],['otra',ids.salon,'especialista'],['ajena',ids.otro,'admin']]) {
    await db.query(`INSERT INTO ritmo.miembros(negocio_id,usuario_id,rol,nombre,servicios)
      VALUES ($1,$2,$3,$4,ARRAY['cejas'])`, [negocio, ids[u], rol, u]);
  }
  // Todos los accesos de prueba pasan realmente por un rol no propietario y sin BYPASSRLS.
  const como = (u, negocio, ejecutar, aal = u === 'admin' || u === 'ajena' ? 'aal2' : 'aal1') =>
    enTransaccion(pool, { usuarioId: ids[u], aal, sesionId: sesiones[u] }, negocio, async c => {
      await c.query('SET LOCAL ROLE ritmo_api');
      return ejecutar(c);
    });
  const poolAPI = { async connect() {
    const c = await pool.connect();
    await c.query('SET ROLE ritmo_api');
    return { query: c.query, release() {
      // El siguiente prestatario espera a que se restaure el rol.
      void c.query('RESET ROLE').finally(() => c.release());
    } };
  } };
  return { db, pool, poolAPI, como, async cerrar() { await tail; await db.close(); } };
}
