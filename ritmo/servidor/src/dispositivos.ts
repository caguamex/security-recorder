// Activación privada de la agenda heredada. Nunca entrega APP_TOKEN al navegador.
import { createHmac, randomBytes } from 'node:crypto';
import { ErrorAPI } from './modelo.js';
import type { ConexionSQL } from './repositorio.js';
const MINUTO = 60_000, DIA = 24 * 60 * MINUTO;
const valido = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
export class Dispositivos {
  constructor(private pool: ConexionSQL, private secreto: string, private ahora = () => Date.now()) {
    if (secreto.length < 32) throw new Error('La activación requiere la clave privada del servidor.');
  }
  private huella(tipo: string, valor: string) { return createHmac('sha256', this.secreto).update(tipo + ':' + valor).digest('hex'); }
  async emitir() {
    const enlace = randomBytes(32).toString('hex'), vence = this.ahora() + 15 * MINUTO;
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      // Serializa solamente las altas de dispositivos, sin bloquear escrituras de citas.
      await c.query("SELECT pg_advisory_xact_lock(726105)");
      await c.query("DELETE FROM belleza_integraciones WHERE id LIKE 'dispositivo:%' AND (data->>'vence')::bigint <= $1", [this.ahora()]);
      const total = (await c.query("SELECT count(*)::integer AS n FROM belleza_integraciones WHERE id LIKE 'dispositivo:%'")).rows[0].n;
      if (total >= 50) throw new ErrorAPI(429, 'Revoca un dispositivo antes de activar otro.');
      await c.query('INSERT INTO belleza_integraciones(id, data) VALUES ($1, $2::jsonb)',
        ['dispositivo:enlace:' + this.huella('enlace', enlace), JSON.stringify({ vence })]);
      await c.query('COMMIT'); return { enlace, vence };
    } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async activar(enlace: unknown) {
    if (!valido(enlace)) throw new ErrorAPI(400, 'El enlace de activación no es válido.');
    const sesion = randomBytes(32).toString('hex'), vence = this.ahora() + 90 * DIA;
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const row = (await c.query("DELETE FROM belleza_integraciones WHERE id=$1 AND (data->>'vence')::bigint > $2 RETURNING id",
        ['dispositivo:enlace:' + this.huella('enlace', enlace), this.ahora()])).rows[0];
      if (!row) throw new ErrorAPI(410, 'Este enlace venció o ya fue utilizado. Solicita uno nuevo.');
      await c.query('INSERT INTO belleza_integraciones(id, data) VALUES ($1, $2::jsonb)',
        ['dispositivo:sesion:' + this.huella('sesion', sesion), JSON.stringify({ vence })]);
      await c.query('COMMIT'); return { sesion, vence };
    } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async autorizada(sesion: string) {
    if (!valido(sesion)) return false;
    const c = await this.pool.connect();
    try { return !!(await c.query("SELECT id FROM belleza_integraciones WHERE id=$1 AND (data->>'vence')::bigint > $2",
      ['dispositivo:sesion:' + this.huella('sesion', sesion), this.ahora()])).rows[0]; }
    finally { c.release(); }
  }
  async revocar(sesion: string) {
    if (!valido(sesion)) return;
    const c = await this.pool.connect();
    try { await c.query('DELETE FROM belleza_integraciones WHERE id=$1', ['dispositivo:sesion:' + this.huella('sesion', sesion)]); }
    finally { c.release(); }
  }
  async revocarTodas() {
    const c = await this.pool.connect();
    try { await c.query("DELETE FROM belleza_integraciones WHERE id LIKE 'dispositivo:%'"); }
    finally { c.release(); }
  }
}
