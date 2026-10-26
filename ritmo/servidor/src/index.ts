import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { PostgresRepositorio } from './repositorio.js';
import { crearServidor } from './http.js';
import { ConfigIntegraciones } from './integraciones.js';
import { Dispositivos } from './dispositivos.js';
import { WhatsApp } from './whatsapp.js';
import { exportarMigracion } from './migracion.js';
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
if (!process.env.APP_TOKEN || process.env.APP_TOKEN.length < 32) throw new Error('Falta APP_TOKEN con al menos 32 caracteres.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
pool.on('error', () => console.error('Se interrumpió una conexión con PostgreSQL.'));
const repo = new PostgresRepositorio(pool);
await repo.iniciar();
const port = Number(process.env.PORT || 3000);
const tz = process.env.TZ || 'America/Mexico_City';
const whatsapp = new WhatsApp(pool, repo, { token: process.env.WHATSAPP_TOKEN, phoneId: process.env.WHATSAPP_PHONE_ID,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN, appSecret: process.env.WHATSAPP_APP_SECRET, version: process.env.WHATSAPP_API_VERSION, tz });
const integraciones = new ConfigIntegraciones(pool);
const server = crearServidor(repo, process.env.APP_TOKEN, fileURLToPath(new URL('../../dist/pwa/', import.meta.url)),
  { integraciones, whatsapp, dispositivos: process.env.AGENDAPPX_CUENTAS_HABILITADAS === 'true' ? undefined : new Dispositivos(pool, process.env.APP_TOKEN), tz, publicURL: process.env.PUBLIC_URL,
    migracion: { token: process.env.MIGRATION_TOKEN, soloLectura: process.env.MIGRATION_READ_ONLY === 'true', exportar: () => exportarMigracion(pool) } });
const ejecutar = () => process.env.MIGRATION_READ_ONLY === 'true' ? Promise.resolve()
  : whatsapp.procesar().catch(() => console.error('No se pudo revisar la cola de WhatsApp.'));
const timer = setInterval(ejecutar, 5 * 60000); timer.unref();
void ejecutar();
server.listen(port, '0.0.0.0', () => console.log(`Ritmo Belleza disponible en el puerto ${port}.`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  clearInterval(timer);
  server.close(() => { void pool.end().then(() => process.exit(0)); });
  setTimeout(() => process.exit(1), 10000).unref();
});
