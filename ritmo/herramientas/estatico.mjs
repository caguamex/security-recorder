// Servidor compartido por la vista previa y el backend; solo publica dist/pwa.
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8' };
export async function estatico(req, res, root) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.includes('\\') || path.split('/').some(p => p.startsWith('.'))) throw new Error();
    const base = await realpath(root);
    const file = await realpath(resolve(base, '.' + (path === '/' ? '/index.html' : path)));
    if (!file.startsWith(base + sep) || !MIME[extname(file)]) throw new Error();
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)], 'Content-Length': data.length,
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://zkqwephmuflbuagevvxj.supabase.co https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado'); }
}
