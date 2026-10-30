// PostgreSQL local en WebAssembly: sin cuenta, red ni servicios facturables.
import { PGlite } from '@electric-sql/pglite';
import { PostgresRepositorio } from '../build/repositorio.js';
import { crearServidor } from '../build/http.js';
import { ConfigIntegraciones } from '../build/integraciones.js';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
export async function entorno(options = {}) {
  const db = new PGlite(); let tail = Promise.resolve();
  const pool = { async connect() {
    const before = tail; let release;
    tail = new Promise(resolve => { release = resolve; }); await before;
    return { release, async query(sql, args) {
      if (args) return db.query(sql, args);
      const result = await db.exec(sql); return result.at(-1) || { rows: [] };
    } };
  } };
  const repo = new PostgresRepositorio(pool); await repo.iniciar();
  const token = 'token_local_para_pruebas_0123456789abcdef';
  const integraciones = new ConfigIntegraciones(pool);
  const server = crearServidor(repo, token, fileURLToPath(new URL('../../dist/pwa/', import.meta.url)), { integraciones, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return { repo, pool, integraciones, db, server, base, token, async cerrar() {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); await db.close();
  } };
}
