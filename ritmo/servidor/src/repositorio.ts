import { createHash } from 'node:crypto';
import { ErrorAPI, type Cambio, type Registro } from './modelo.js';
export interface ClienteSQL {
  query(sql: string, args?: unknown[]): Promise<{ rows: any[] }>;
  release(): void;
}
export interface ConexionSQL { connect(): Promise<ClienteSQL>; }
export interface Repositorio {
  estado(): Promise<Registro[]>;
  cambiar(cambio: Cambio): Promise<Registro>;
  salud(): Promise<void>;
}
export const ESQUEMA = `
CREATE TABLE IF NOT EXISTS belleza_estado (id integer PRIMARY KEY CHECK (id = 1));
INSERT INTO belleza_estado (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS belleza_objetos (
  id text PRIMARY KEY, version integer NOT NULL CHECK (version > 0), data jsonb,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS belleza_mutaciones (
  id text PRIMARY KEY, huella text NOT NULL, resultado jsonb NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);`;
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
      const resultado = { id: cambio.id, version: actual.version + 1, data: cambio.data };
      await c.query(`INSERT INTO belleza_objetos (id, version, data) VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, data = EXCLUDED.data, actualizado_en = now()`,
      [resultado.id, resultado.version, JSON.stringify(resultado.data)]);
      await c.query('INSERT INTO belleza_mutaciones (id, huella, resultado) VALUES ($1, $2, $3::jsonb)', [cambio.mutationId, huella, JSON.stringify(resultado)]);
      await c.query('COMMIT'); return resultado;
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
}
