import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { entorno } from './entorno.mjs';
let env;
before(async () => { env = await entorno(); });
after(async () => { await env?.cerrar(); });
async function api(path, body, extra = {}) {
  const response = await fetch(env.base + path, { method: body ? 'PUT' : 'GET',
    headers: { Authorization: 'Bearer ' + env.token, 'Content-Type': 'application/json', ...extra },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
const change = (data, baseVersion = 0) => ({ data, baseVersion, mutationId: randomUUID() });
test('protege la API y rechaza peticiones desde otro origen', async () => {
  assert.equal((await fetch(env.base + '/api/estado')).status, 401);
  assert.equal((await api('/api/estado', null, { Origin: 'https://otro.example' })).status, 403);
  assert.equal((await api('/api/estado')).headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(env.base + '/salud')).status, 200);
});
test('guarda los cinco tipos y los ajustes en PostgreSQL', async () => {
  const objects = [
    { id: 's1', kind: 'servicio', nombre: 'Gelish', precio: 300, duracion: 45 },
    { id: 'k1', kind: 'clienta', nombre: 'Clienta de prueba', telefono: '5500000000' },
    { id: 'c1', kind: 'cita', date: '2026-11-10', start: '10:00', clienta: 'k1', servicio: 's1', estado: 'pendiente' },
    { id: 'p1', kind: 'promo', titulo: 'Combo', texto: 'Promoción de prueba' },
    { id: 'g1', kind: 'grupo', nombre: 'Grupo de prueba', url: 'https://www.facebook.com/groups/prueba/' },
  ];
  for (const obj of objects) assert.equal((await api('/api/objetos/' + obj.id, change(obj))).status, 200);
  assert.equal((await api('/api/objetos/__settings', change({ negocio: 'Salón de prueba', skin: 'rosa' }))).status, 200);
  assert.equal((await api('/api/estado')).body.records.length, 6);
});
test('detecta conflictos, conserva eliminaciones y hace idempotentes los reintentos', async () => {
  const op = change({ id: 'k1', kind: 'clienta', nombre: 'Cambio uno' }, 1);
  const first = await api('/api/objetos/k1', op);
  assert.equal(first.body.version, 2);
  assert.deepEqual((await api('/api/objetos/k1', op)).body, first.body);
  const stale = await api('/api/objetos/k1', change({ id: 'k1', kind: 'clienta', nombre: 'Cambio atrasado' }, 1));
  assert.equal(stale.status, 409); assert.equal(stale.body.current.data.nombre, 'Cambio uno');
  const deleted = await api('/api/objetos/k1', change(null, 2));
  assert.equal(deleted.body.data, null); assert.equal(deleted.body.version, 3);
  assert.equal((await api('/api/objetos/k1', change(op.data, 2))).status, 409);
  assert.equal((await api('/api/objetos/k1', { ...op, data: { ...op.data, nombre: 'Reutilizado' } })).status, 400);
  assert.equal((await api('/api/objetos/k1', change(op.data, 3))).status, 200);
});
test('dos escrituras concurrentes no sobrescriben la misma versión', async () => {
  const results = await Promise.all(['A', 'B'].map(nombre => api('/api/objetos/concurrente', change({ id: 'concurrente', kind: 'clienta', nombre }))));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
});
test('valida fechas, tipos, precios y enlaces antes de escribir', async () => {
  const invalid = [
    { id: 'x', kind: 'desconocido' }, { id: 'otro', kind: 'clienta', nombre: 'Mal ID' },
    { id: 'x', kind: 'servicio', nombre: 'Prueba', precio: -1, duracion: 20 },
    { id: 'x', kind: 'grupo', nombre: 'Prueba', url: 'javascript:alert(1)' },
    { id: 'x', kind: 'cita', date: '2026-02-30', start: '25:00', estado: 'pendiente' },
  ];
  for (const it of invalid) assert.equal((await api('/api/objetos/x', change(it))).status, 400);
  assert.equal((await api('/api/objetos/__settings', change({ APP_TOKEN: 'prohibido' }, 1))).status, 400);
  const large = await api('/api/objetos/x', change({ id: 'x', kind: 'clienta', nombre: 'x'.repeat(70000) }));
  assert.equal(large.status, 413);
  for (const [id, url] of [['grupo-vacio', ''], ['grupo-corto', 'https://fb.com/groups/prueba/']]) {
    assert.equal((await api('/api/objetos/' + id, change({ id, kind: 'grupo', nombre: 'Grupo', url }))).status, 200);
  }
});
test('publica solo los recursos de la PWA y bloquea rutas privadas', async () => {
  for (const path of ['/', '/manifest.webmanifest', '/sw.js', '/fuentes/fuente-0.ttf']) assert.equal((await fetch(env.base + path)).status, 200);
  for (const path of ['/.env', '/package.json', '/servidor/src/index.ts', '/%2e%2e%5cservidor/package.json']) assert.equal((await fetch(env.base + path)).status, 404);
});
