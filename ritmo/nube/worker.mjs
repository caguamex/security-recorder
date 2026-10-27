// La página se sirve como archivos estáticos. Solo la API y el calendario ejecutan este Worker.
import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import pg from 'pg';
import { crearServidor } from '../servidor/src/http.ts';
import { PostgresRepositorio } from '../servidor/src/repositorio.ts';
import { ConfigIntegraciones } from '../servidor/src/integraciones.ts';
import { Dispositivos } from '../servidor/src/dispositivos.ts';
import { WhatsApp } from '../servidor/src/whatsapp.ts';
import { ProveedorEvolution } from '../servidor/src/whatsapp-evolution/proveedor.ts';
import { VinculacionWhatsApp } from '../servidor/src/whatsapp-evolution/vinculacion.ts';
import { rutasVinculacion } from '../servidor/src/whatsapp-evolution/http.ts';
import { VerificadorJWT } from '../servidor/src/cuentas/jwt.ts';

// Cada operación abre su cliente; no se comparten sockets entre solicitudes de Workers.
// Hyperdrive mantiene el pool remoto cuando está configurado, sin caché de consultas privadas.
const pool = {
  async connect() {
    const hyperdrive = env.HYPERDRIVE;
    const client = new pg.Client({
      connectionString: hyperdrive?.connectionString || env.DATABASE_URL,
      connectionTimeoutMillis: 8000,
      query_timeout: 12000,
      application_name: 'ritmo_cloudflare',
      ...(!hyperdrive ? { ssl: { rejectUnauthorized: true, ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT.replace(/\\n/g, '\n') } : {}) } } : {}),
    });
    await client.connect();
    return { query: (sql, args) => client.query(sql, args), release: () => { void client.end(); } };
  },
};
const repo = new PostgresRepositorio(pool);
const integraciones = new ConfigIntegraciones(pool);
const whatsapp = new WhatsApp(pool, repo, {
  token: env.WHATSAPP_TOKEN, phoneId: env.WHATSAPP_PHONE_ID, verifyToken: env.WHATSAPP_VERIFY_TOKEN,
  appSecret: env.WHATSAPP_APP_SECRET, version: env.WHATSAPP_API_VERSION, tz: env.TZ,
});
// La nueva integración exige cuentas terminadas y configuración expresa. Nunca usa APP_TOKEN.
const vinculacion = env.AGENDAPPX_CUENTAS_HABILITADAS === 'true' && env.WHATSAPP_PROVEEDOR === 'evolution'
  ? rutasVinculacion(new VinculacionWhatsApp(pool,new ProveedorEvolution({
      url: env.EVOLUTION_API_URL, apiKey: env.EVOLUTION_API_KEY,
      webhookKey: env.EVOLUTION_WEBHOOK_KEY, publicURL: env.PUBLIC_URL,
    }), new Set(String(env.WHATSAPP_SALONES_HABILITADOS || '').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean))),new VerificadorJWT(env.SUPABASE_URL)) : undefined;
// El esquema se instala antes de publicar; el Worker no crea tablas al atender visitas.
const servidor = crearServidor(repo, env.APP_TOKEN || '', '/no-publicar', {
  integraciones, whatsapp, vinculacion, dispositivos: env.AGENDAPPX_CUENTAS_HABILITADAS === 'true' ? undefined : new Dispositivos(pool, env.APP_TOKEN || ''), tz: env.TZ, publicURL: env.PUBLIC_URL,
});
const api = httpServerHandler(servidor);
export default {
  async fetch(request, bindings, context) {
    const path = new URL(request.url).pathname;
    if (path === '/salud' || path.startsWith('/api/') || path.startsWith('/calendario/') || path.startsWith('/webhooks/')) {
      return api.fetch(request, bindings, context);
    }
    return bindings.ASSETS.fetch(request);
  },
  async scheduled(_controller, _bindings, context) {
    // La misma cola oficial y gratuita; no hay proceso permanente ni mensajes sin Meta configurado.
    if (env.WHATSAPP_REMITENTE !== 'railway' && env.WHATSAPP_PROVEEDOR !== 'evolution' && whatsapp.configurado) {
      context.waitUntil(whatsapp.procesar());
    }
  },
};
