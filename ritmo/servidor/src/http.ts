import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ErrorAPI, validarCambio } from './modelo.js';
import type { Repositorio } from './repositorio.js';
import { calendario, igualSecreto, type ConfigIntegraciones } from './integraciones.js';
import type { WhatsApp } from './whatsapp.js';
// @ts-expect-error El servidor estático es un módulo JavaScript compartido con la vista previa.
import { estatico } from '../../herramientas/estatico.mjs';
function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.end(JSON.stringify(body));
}
async function leerRaw(req: IncomingMessage) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new ErrorAPI(415, 'Usa application/json.');
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) throw new ErrorAPI(413, 'El objeto excede 64 KB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function leerJSON(req: IncomingMessage) {
  const raw = await leerRaw(req);
  try { return JSON.parse(raw.toString('utf8')); } catch { throw new ErrorAPI(400, 'JSON inválido.'); }
}
type Opciones = { integraciones?: ConfigIntegraciones; whatsapp?: WhatsApp; tz?: string; publicURL?: string };
export function crearServidor(repo: Repositorio, token: string, publicRoot: string, options: Opciones = {}) {
  if (token.length < 32) throw new Error('APP_TOKEN debe tener al menos 32 caracteres aleatorios.');
  const digest = (s: string) => createHash('sha256').update(s).digest();
  const esperado = digest(token);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/salud' && req.method === 'GET') {
        await repo.salud(); json(res, 200, { estado: 'listo' }); return;
      }
      if (url.pathname === '/webhooks/whatsapp') {
        const wa = options.whatsapp;
        if (!wa?.configurado) throw new ErrorAPI(503, 'WhatsApp oficial aún no está conectado.');
        if (req.method === 'GET' && url.searchParams.get('hub.mode') === 'subscribe' && igualSecreto(url.searchParams.get('hub.verify_token') || '', wa.verificacion)) {
          res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end((url.searchParams.get('hub.challenge') || '').slice(0, 1000)); return;
        }
        if (req.method !== 'POST') throw new ErrorAPI(403, 'Verificación inválida.');
        const raw = await leerRaw(req);
        if (!wa.firmaValida(raw, String(req.headers['x-hub-signature-256'] || ''))) throw new ErrorAPI(403, 'Firma inválida.');
        let body;
        try { body = JSON.parse(raw.toString('utf8')); } catch { throw new ErrorAPI(400, 'JSON inválido.'); }
        await wa.webhook(body); json(res, 200, { recibido: true }); return;
      }
      const feed = /^\/calendario\/([a-f0-9]{64})\.ics$/.exec(url.pathname);
      if (feed && req.method === 'GET') {
        if (!options.integraciones || !igualSecreto(feed[1], await options.integraciones.tokenCalendario())) throw new ErrorAPI(404, 'Calendario no encontrado.');
        res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
        res.end(await calendario(repo, options.tz || 'America/Mexico_City')); return;
      }
      if (!url.pathname.startsWith('/api/')) { await estatico(req, res, publicRoot); return; }
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new ErrorAPI(403, 'Origen no permitido.');
      const recibido = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
      if (!recibido || !timingSafeEqual(digest(recibido), esperado)) {
        res.setHeader('WWW-Authenticate', 'Bearer'); throw new ErrorAPI(401, 'Token de acceso inválido.');
      }
      if (url.pathname === '/api/estado' && req.method === 'GET') {
        const since = url.searchParams.has('since') ? Number(url.searchParams.get('since')) : undefined;
        if (since !== undefined && (!Number.isSafeInteger(since) || since < 0 || since > 2147483647)) throw new ErrorAPI(400, 'Cursor inválido.');
        json(res, 200, await repo.snapshot(since)); return;
      }
      if (['/api/conexiones', '/api/calendario/renovar'].includes(url.pathname)) {
        if (!options.integraciones) throw new ErrorAPI(503, 'Conexiones no disponibles.');
        const renovar = url.pathname.endsWith('/renovar');
        if (req.method !== (renovar ? 'POST' : 'GET')) throw new ErrorAPI(405, 'Método no permitido.');
        if (renovar) await leerJSON(req);
        const access = await options.integraciones.tokenCalendario(renovar);
        const base = options.publicURL || `http://${req.headers.host}`;
        json(res, 200, { calendarioUrl: new URL(`/calendario/${access}.ics`, base).href,
          whatsapp: options.whatsapp ? await options.whatsapp.resumen() : { configurado: false, explicacion: 'WhatsApp oficial aún no está conectado.' } }); return;
      }
      const match = /^\/api\/objetos\/([\w-]+)$/.exec(url.pathname);
      if (match && req.method === 'PUT') {
        const cambio = validarCambio(await leerJSON(req), match[1]);
        json(res, 200, await repo.cambiar(cambio)); return;
      }
      throw new ErrorAPI(404, 'Ruta no encontrada.');
    } catch (e) {
      if (e instanceof ErrorAPI) json(res, e.status, { error: e.message, ...(e.current ? { current: e.current } : {}) });
      else { console.error('La solicitud no pudo completarse.'); json(res, 503, { error: 'Servicio temporalmente no disponible. Tus cambios siguen en este dispositivo.' }); }
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  return server;
}
