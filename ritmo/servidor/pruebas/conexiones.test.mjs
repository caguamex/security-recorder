import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { entorno } from './entorno.mjs';
import { WhatsApp } from '../build/whatsapp.js';
import { crearServidor } from '../build/http.js';
import { fechaUTC } from '../build/integraciones.js';
let env, wa, server, base, calls = [], fail = false;
const now = Date.parse('2026-11-10T18:00:00Z');
const secret = 'secreto_solo_para_pruebas_locales';
const put = async (data, version = 0) => env.repo.cambiar({ id: data.id, data, baseVersion: version, mutationId: randomUUID() });
before(async () => {
  env = await entorno();
  wa = new WhatsApp(env.pool, env.repo, { token: 'token_ficticio', phoneId: '1001', verifyToken: 'verificar_prueba', appSecret: secret }, async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (fail) throw new Error('Respuesta incierta');
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.prueba' + calls.length }] }), { status: 200 });
  }, () => now);
  server = crearServidor(env.repo, env.token, fileURLToPath(new URL('../../dist/pwa/', import.meta.url)), { integraciones: env.integraciones, whatsapp: wa });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { if (server) await new Promise(r => { server.close(r); server.closeAllConnections(); }); await env?.cerrar(); });
const request = (path, options = {}) => fetch(base + path, { ...options, headers: { Authorization: 'Bearer ' + env.token, 'Content-Type': 'application/json', ...options.headers } });
async function webhook(messages = [], statuses = [], valid = true, phoneId = '1001') {
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneId }, messages, statuses } }] }] });
  const signature = 'sha256=' + createHmac('sha256', valid ? secret : 'incorrecto').update(body).digest('hex');
  return request('/webhooks/whatsapp', { method: 'POST', body, headers: { 'X-Hub-Signature-256': signature } });
}
test('entrega cambios incrementales y conserva eliminaciones en el cursor', async () => {
  await put({ id: 'delta', kind: 'clienta', nombre: 'Inicial' });
  const first = await (await request('/api/estado')).json();
  assert.equal(first.full, true);
  await put({ id: 'delta', kind: 'clienta', nombre: 'Modificada' }, 1);
  const next = await (await request('/api/estado?since=' + first.cursor)).json();
  assert.equal(next.full, false); assert.equal(next.records.length, 1); assert.equal(next.records[0].data.nombre, 'Modificada');
  assert.deepEqual((await (await request('/api/estado?since=' + next.cursor)).json()).records, []);
  await env.repo.cambiar({ id: 'delta', data: null, baseVersion: 2, mutationId: randomUUID() });
  assert.equal((await (await request('/api/estado?since=' + next.cursor)).json()).records[0].data, null);
  assert.equal((await request('/api/estado?since=-1')).status, 400);
});
test('la suscripción usa secreto independiente y se puede revocar', async () => {
  await put({ id: 'servicio', kind: 'servicio', nombre: 'Servicio, prueba', duracion: 90, precio: 300 });
  await put({ id: 'clienta', kind: 'clienta', nombre: 'Clienta de prueba', telefono: '5500000000', whatsappOptIn: true });
  await put({ id: 'cita', kind: 'cita', date: '2026-11-10', start: '14:00', clienta: 'clienta', servicio: 'servicio', estado: 'pendiente', updatedAt: new Date(now).toISOString() });
  await put({ id: '__settings', negocio: 'Salón\nPrueba', waRecordar: true, waConfirm: true });
  const info = await (await request('/api/conexiones')).json();
  const response = await fetch(info.calendarioUrl); const ics = await response.text();
  assert.equal(response.status, 200); assert.match(ics, /DTSTART:20261110T200000Z/); assert.match(ics, /DTEND:20261110T213000Z/);
  assert.match(ics, /CLASS:PRIVATE/); assert.match(ics, /Servicio\\, prueba/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await fetch(base + '/calendario/' + '0'.repeat(64) + '.ics')).status, 404);
  const renewed = await (await request('/api/calendario/renovar', { method: 'POST', body: '{}' })).json();
  assert.notEqual(renewed.calendarioUrl, info.calendarioUrl); assert.equal((await fetch(info.calendarioUrl)).status, 404);
  assert.equal((await fetch(renewed.calendarioUrl)).status, 200);
});
test('convierte correctamente zona horaria y citas que terminan otro día', () => {
  assert.equal(new Date(fechaUTC('2026-11-10', '23:30')).toISOString(), '2026-11-11T05:30:00.000Z');
});
test('sin mensaje previo de la clienta no llama a Meta ni envía plantillas', async () => {
  await wa.procesar(); assert.equal(calls.length, 0);
  assert.equal((await wa.resumen()).conteos.requiere_ventana, 1);
});
test('verifica el webhook oficial y rechaza firmas inválidas', async () => {
  const check = await fetch(base + '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verificar_prueba&hub.challenge=123');
  assert.equal(check.status, 200); assert.equal(await check.text(), '123');
  assert.equal((await webhook([], [], false)).status, 403);
  assert.equal((await fetch(base + '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=mal')).status, 403);
});
test('envía una sola vez en ventana gratuita y distingue aceptación de entrega', async () => {
  const message = { id: 'entrada-1', from: '525500000000', timestamp: String(now / 1000 - 60), text: { body: 'Hola' } };
  assert.equal((await webhook([message])).status, 200);
  await wa.procesar(); await wa.procesar();
  assert.equal(calls.length, 1); assert.equal(calls[0].body.type, 'text');
  assert.equal((await wa.resumen()).conteos.aceptado, 1);
  await webhook([], [{ id: 'wamid.prueba1', status: 'delivered' }]);
  await webhook([], [{ id: 'wamid.prueba1', status: 'sent' }]);
  assert.equal((await wa.resumen()).conteos.entregado, 1);
});
test('las respuestas 1 y 2 modifican solo la cita asociada y son idempotentes', async () => {
  const message = { id: 'entrada-2', from: '525500000000', timestamp: String(now / 1000), context: { id: 'wamid.prueba1' }, text: { body: '1' } };
  await webhook([message]); await webhook([message]);
  let c = (await env.repo.estado()).find(r => r.id === 'cita');
  assert.equal(c.data.estado, 'confirmada'); assert.equal(c.version, 2);
  await webhook([{ ...message, id: 'entrada-3', text: { body: '2' } }]);
  c = (await env.repo.estado()).find(r => r.id === 'cita'); assert.equal(c.data.solicitaCambio, true); assert.equal(c.data.estado, 'pendiente');
});
test('no usa mensajes de otro número ni fechas futuras para abrir ventanas', async () => {
  await put({ id: 'sinventana', kind: 'clienta', nombre: 'Otra clienta', telefono: '5500000001', whatsappOptIn: true });
  await put({ id: 'otra-cita', kind: 'cita', date: '2026-11-10', start: '16:00', clienta: 'sinventana', servicio: 'servicio', estado: 'pendiente' });
  await webhook([{ id: 'numero-ajeno', from: '525500000001', timestamp: String(now / 1000), text: { body: 'Hola' } }], [], true, 'otro');
  await webhook([{ id: 'fecha-futura', from: '525500000001', timestamp: String(now / 1000 + 3600), text: { body: 'Hola' } }]);
  await wa.procesar(); assert.equal(calls.length, 1);
});
test('sin consentimiento no envía aunque exista una ventana abierta', async () => {
  await put({ id: 'sinventana', kind: 'clienta', nombre: 'Otra clienta', telefono: '5500000001', whatsappOptIn: false }, 1);
  await webhook([{ id: 'sin-consentimiento', from: '525500000001', timestamp: String(now / 1000), text: { body: 'Hola' } }]);
  await wa.procesar(); assert.equal(calls.length, 1);
});
test('una respuesta incierta de Meta no se reintenta y evita duplicados', async () => {
  await put({ id: 'incierta', kind: 'cita', date: '2026-11-10', start: '18:00', clienta: 'clienta', servicio: 'servicio', estado: 'pendiente' });
  fail = true; await wa.procesar(); await wa.procesar();
  assert.equal(calls.length, 2); assert.equal((await wa.resumen()).conteos.incierto, 1);
});
