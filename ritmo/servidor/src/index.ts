import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { PostgresRepositorio } from './repositorio.js';
import { crearServidor } from './http.js';
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
if (!process.env.APP_TOKEN || process.env.APP_TOKEN.length < 32) throw new Error('Falta APP_TOKEN con al menos 32 caracteres.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
pool.on('error', () => console.error('Se interrumpió una conexión con PostgreSQL.'));
const repo = new PostgresRepositorio(pool);
await repo.iniciar();
const port = Number(process.env.PORT || 3000);
const server = crearServidor(repo, process.env.APP_TOKEN, fileURLToPath(new URL('../../dist/pwa/', import.meta.url)));
server.listen(port, '0.0.0.0', () => console.log(`Ritmo Belleza disponible en el puerto ${port}.`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  server.close(() => { void pool.end().then(() => process.exit(0)); });
  setTimeout(() => process.exit(1), 10000).unref();
});
