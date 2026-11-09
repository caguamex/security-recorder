import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entorno } from './entorno.mjs';
import { Dispositivos } from '../build/dispositivos.js';
const maestro = env => ({ Authorization: 'Bearer ' + env.token, 'Content-Type': 'application/json' });
async function emitir(env) {
  const r = await fetch(env.base + '/api/dispositivos/enlaces', { method: 'POST', headers: maestro(env), body: '{}' });
  assert.equal(r.status, 201); const data = await r.json();
  return { ...data, enlace: new URL(data.activacionUrl).hash.split('=')[1] };
}
const activar = (env, enlace, extra = {}) => fetch(env.base + '/api/dispositivos/activar', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: env.base, ...extra }, body: JSON.stringify({ enlace }) });

test('sin autorización no revela agenda ni permite emitir enlaces; la sesión pública no devuelve datos', async t => {
  const env = await entorno(); t.after(() => env.cerrar());
  for (const path of ['/api/estado','/api/conexiones','/api/dispositivos/enlaces']) {
    const r = await fetch(env.base + path); assert.equal(r.status, 401); assert.match(r.headers.get('cache-control'), /no-store/);
  }
  const r = await fetch(env.base + '/api/dispositivos/sesion'); assert.deepEqual(await r.json(), { conectado: false });
});
test('activación de un solo uso con sesión HttpOnly; sincroniza y obtiene feed sin exponer APP_TOKEN', async t => {
  const env = await entorno(); t.after(() => env.cerrar());
  const data = await emitir(env); assert.equal(new URL(data.activacionUrl).search, '');
  assert.ok(data.vence > Date.now());
  const response = await activar(env, data.enlace); assert.equal(response.status, 200);
  const body = await response.text(); assert.equal(body.includes(env.token), false); assert.equal(body.includes(data.enlace), false);
  const cookie = response.headers.get('set-cookie'); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Path=\//);
  const headers = { Cookie: cookie.split(';')[0] };
  assert.equal((await fetch(env.base + '/api/estado', { headers })).status, 200);
  assert.equal((await fetch(env.base + '/api/conexiones', { headers })).status, 200);
  assert.equal((await activar(env, data.enlace)).status, 410);
  const minted = await fetch(env.base + '/api/dispositivos/enlaces', { method: 'POST', headers: { ...headers, Origin: env.base, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(minted.status, 401);
  const raw = JSON.stringify((await env.db.query("SELECT * FROM belleza_integraciones WHERE id LIKE 'dispositivo:%'")).rows);
  assert.equal(raw.includes(data.enlace), false); assert.equal(raw.includes(headers.Cookie.split('=')[1]), false);
});
test('rechaza CSRF, cookies inventadas y enlaces ajenos; permite revocar sin borrar citas', async t => {
  const env = await entorno(); t.after(() => env.cerrar());
  const data = await emitir(env);
  assert.equal((await activar(env, data.enlace, { Origin: 'https://otro.example' })).status, 403);
  const response = await activar(env, data.enlace); const Cookie = response.headers.get('set-cookie').split(';')[0];
  const write = origin => fetch(env.base + '/api/objetos/cita_privada', { method: 'PUT', headers: { Cookie, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify({ id: 'cita_privada', baseVersion: 0, mutationId: 'cambio_cookie_valido_123456', data: { id:'cita_privada', kind:'clienta', nombre:'Privada' } }) });
  assert.equal((await write()).status, 403); assert.equal((await write('https://otro.example')).status, 403);
  assert.equal((await write(env.base)).status, 200);
  assert.equal((await fetch(env.base + '/api/estado', { headers: { Cookie: 'agendappx_sesion_local=' + 'a'.repeat(64) } })).status, 401);
  assert.equal((await fetch(env.base + '/api/dispositivos/sesion', { method:'DELETE', headers:{ Cookie, Origin:env.base, 'Content-Type':'application/json' }, body:'{}' })).status, 200);
  assert.equal((await fetch(env.base + '/api/estado', { headers: { Cookie } })).status, 401);
  assert.ok((await env.repo.estado()).some(r => r.id === 'cita_privada'));
});
test('caducidad, rotación de clave y concurrencia: una sola activación válida', async t => {
  const env = await entorno(); t.after(() => env.cerrar()); let now = Date.now();
  const service = new Dispositivos(env.pool, env.token, () => now);
  const expired = await service.emitir(); now += 16 * 60_000;
  await assert.rejects(() => service.activar(expired.enlace), e => e.status === 410);
  const ticket = await service.emitir();
  const results = await Promise.allSettled([service.activar(ticket.enlace), service.activar(ticket.enlace)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const result = results.find(r => r.status === 'fulfilled').value;
  assert.equal(await service.autorizada(result.sesion), true);
  assert.equal(await new Dispositivos(env.pool, 'otra_clave_privada_completamente_distinta_1234').autorizada(result.sesion), false);
  now += 91 * 86400_000; assert.equal(await service.autorizada(result.sesion), false);
});
test('HTTPS fija cookie Secure y no publica el secreto de sesión en JSON', async t => {
  const env = await entorno({ publicURL: 'https://agenda.example' }); t.after(() => env.cerrar());
  const data = await emitir(env);
  // La prueba usa transporte local pero conserva el Host y Origin de la publicación HTTPS.
  const r = await activar(env, data.enlace, { Host:'agenda.example', Origin:'https://agenda.example' });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /^__Host-agendappx_sesion=[a-f0-9]{64};/);
  assert.match(r.headers.get('set-cookie'), /; Secure$/);
  assert.deepEqual(await r.json(), { conectado:true });
});

test('la revocación del operador corta todas las sesiones y los enlaces pendientes', async t => {
  const env = await entorno(); t.after(() => env.cerrar());
  const a = await emitir(env), b = await emitir(env);
  const res = await activar(env, a.enlace), Cookie = res.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(env.base + '/api/dispositivos/enlaces', { method:'DELETE', headers:maestro(env), body:'{}' })).status,200);
  assert.equal((await fetch(env.base + '/api/estado',{headers:{Cookie}})).status,401);
  assert.equal((await activar(env, b.enlace)).status,410);
});
