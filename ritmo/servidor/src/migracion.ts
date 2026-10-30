// Respaldo de traslado: solo tablas de Ritmo, en una instantánea consistente.
import type { ConexionSQL } from './repositorio.js';
export const TABLAS_MIGRACION = ['belleza_estado', 'belleza_objetos', 'belleza_mutaciones', 'belleza_integraciones',
  'belleza_whatsapp_contactos', 'belleza_whatsapp_entradas', 'belleza_whatsapp_cola'] as const;
export async function exportarMigracion(pool: ConexionSQL) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tablas: Record<string, unknown[]> = {};
    for (const tabla of TABLAS_MIGRACION) tablas[tabla] = (await client.query(`SELECT * FROM ${tabla}`)).rows;
    await client.query('COMMIT');
    return { formato: 'ritmo-belleza', version: 1, creadoEn: new Date().toISOString(), tablas };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
