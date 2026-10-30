import { createHash } from 'node:crypto';
import { ErrorAPI, type Cambio, type Registro } from './modelo.js';
export interface ClienteSQL {
  query(sql: string, args?: unknown[]): Promise<{ rows: any[] }>;
  release(): void;
}
export interface ConexionSQL { connect(): Promise<ClienteSQL>; }
export interface Repositorio {
  estado(): Promise<Registro[]>;
  snapshot(since?: number): Promise<{ records: Registro[]; cursor: number; full: boolean }>;
  cambiar(cambio: Cambio): Promise<Registro>;
  salud(): Promise<void>;
}
export const ESQUEMA = `
CREATE TABLE IF NOT EXISTS belleza_estado (id integer PRIMARY KEY CHECK (id = 1), revision integer NOT NULL DEFAULT 0);
ALTER TABLE belleza_estado ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
INSERT INTO belleza_estado (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS belleza_objetos (
  id text PRIMARY KEY, version integer NOT NULL CHECK (version > 0), data jsonb,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE belleza_objetos ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS belleza_objetos_revision ON belleza_objetos (revision);
CREATE TABLE IF NOT EXISTS belleza_mutaciones (
  id text PRIMARY KEY, huella text NOT NULL, resultado jsonb NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS belleza_integraciones (id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS belleza_whatsapp_contactos (telefono text PRIMARY KEY, ultimo_mensaje timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS belleza_whatsapp_entradas (id text PRIMARY KEY, recibido_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS belleza_whatsapp_cola (
  id text PRIMARY KEY, cita_id text NOT NULL, tipo text NOT NULL, telefono text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente', mensaje_id text, creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(), motivo text
);
CREATE INDEX IF NOT EXISTS belleza_whatsapp_mensaje ON belleza_whatsapp_cola (mensaje_id);
`;
export class PostgresRepositorio implements Repositorio {
  constructor(private pool: ConexionSQL) {}
  async iniciar() {
    const c = await this.pool.connect();
    try { await c.query('BEGIN'); await c.query(ESQUEMA); await c.query('COMMIT'); }
    catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async salud() {
    const c = await this.pool.connect();
    try { await c.query('SELECT 1'); } finally { c.release(); }
  }
  async estado(): Promise<Registro[]> {
    const c = await this.pool.connect();
    try { return (await c.query('SELECT id, version, data FROM belleza_objetos ORDER BY id')).rows; }
    finally { c.release(); }
  }
  async snapshot(since?: number) {
    const c = await this.pool.connect();
    try {
      const result = (await c.query(`SELECT e.revision AS cursor,
        ($1::integer IS NULL OR $1 > e.revision) AS full,
        COALESCE(jsonb_agg(jsonb_build_object('id', o.id, 'version', o.version, 'data', o.data, 'revision', o.revision))
          FILTER (WHERE o.id IS NOT NULL), '[]'::jsonb) AS records
        FROM belleza_estado e LEFT JOIN belleza_objetos o ON
          ($1::integer IS NULL OR $1 > e.revision OR o.revision > $1)
        WHERE e.id = 1 GROUP BY e.revision`, [since ?? null])).rows[0];
      return result as { records: Registro[]; cursor: number; full: boolean };
    } finally { c.release(); }
  }
  async cambiar(cambio: Cambio): Promise<Registro> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      // Una agenda de salón: este bloqueo también protege la creación del primer registro.
      await c.query('SELECT id FROM belleza_estado WHERE id = 1 FOR UPDATE');
      const huella = createHash('sha256').update(JSON.stringify(cambio)).digest('hex');
      const previo = (await c.query('SELECT huella, resultado FROM belleza_mutaciones WHERE id = $1', [cambio.mutationId])).rows[0];
      if (previo) {
        if (previo.huella !== huella) throw new ErrorAPI(400, 'Identificador de cambio reutilizado.');
        await c.query('COMMIT'); return previo.resultado;
      }
      const actual = (await c.query('SELECT id, version, data FROM belleza_objetos WHERE id = $1', [cambio.id])).rows[0] || { id: cambio.id, version: 0, data: null };
      if (actual.version !== cambio.baseVersion) throw new ErrorAPI(409, 'Hay cambios de otro dispositivo. Elige qué versión conservar.', actual);
      const revision = (await c.query('UPDATE belleza_estado SET revision = revision + 1 WHERE id = 1 RETURNING revision')).rows[0].revision;
      const resultado = { id: cambio.id, version: actual.version + 1, data: cambio.data, revision };
      await c.query(`INSERT INTO belleza_objetos (id, version, data, revision) VALUES ($1, $2, $3::jsonb, $4)
        ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, data = EXCLUDED.data, revision = EXCLUDED.revision, actualizado_en = now()`,
      [resultado.id, resultado.version, JSON.stringify(resultado.data), revision]);
      await c.query('INSERT INTO belleza_mutaciones (id, huella, resultado) VALUES ($1, $2, $3::jsonb)', [cambio.mutationId, huella, JSON.stringify(resultado)]);
      await c.query('COMMIT'); return resultado;
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
}
