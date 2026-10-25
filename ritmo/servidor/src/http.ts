import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ErrorAPI, validarCambio } from './modelo.js';
import type { Repositorio } from './repositorio.js';
// @ts-expect-error El servidor estático es un módulo JavaScript compartido con la vista previa.
import { estatico } from '../../herramientas/estatico.mjs';
function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  res.end(JSON.stringify(body));
}
async function leerJSON(req: IncomingMessage) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new ErrorAPI(415, 'Usa application/json.');
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 65536) throw new ErrorAPI(413, 'El objeto excede 64 KB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ErrorAPI(400, 'JSON inválido.'); }
}
export function crearServidor(repo: Repositorio, token: string, publicRoot: string) {
  if (token.length < 32) throw new Error('APP_TOKEN debe tener al menos 32 caracteres aleatorios.');
  const digest = (s: string) => createHash('sha256').update(s).digest();
  const esperado = digest(token);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/salud' && req.method === 'GET') {
        await repo.salud(); json(res, 200, { estado: 'listo' }); return;
      }
      if (!url.pathname.startsWith('/api/')) { await estatico(req, res, publicRoot); return; }
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new ErrorAPI(403, 'Origen no permitido.');
      const recibido = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
      if (!recibido || !timingSafeEqual(digest(recibido), esperado)) {
        res.setHeader('WWW-Authenticate', 'Bearer'); throw new ErrorAPI(401, 'Token de acceso inválido.');
      }
      if (url.pathname === '/api/estado' && req.method === 'GET') { json(res, 200, { records: await repo.estado() }); return; }
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
