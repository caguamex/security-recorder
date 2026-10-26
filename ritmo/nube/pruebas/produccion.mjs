// Verificación del destino con registros aislados que se retiran al terminar.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../../servidor/package.json', import.meta.url));
const { chromium } = require('playwright');
const access = JSON.parse(readFileSync(process.env.RITMO_ACCESS_FILE || 'C:/Users/dellv/.config/ritmo-belleza/acceso.json', 'utf8'));
const base = process.env.RITMO_REMOTE_URL || 'https://ritmo-belleza.antonio-t-22.workers.dev';
const prefix = 'verificacion_nube_' + randomUUID().replaceAll('-', '');
const ids = [], errors = [];
async function api(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: {
    Authorization: 'Bearer ' + access.APP_TOKEN, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  return { response, data: await response.json() };
}
async function put(id, data, version = 0) {
  const result = await api('/api/objetos/' + id, 'PUT', { data, baseVersion: version, mutationId: randomUUID() });
  assert.equal(result.response.status, 200); return result.data;
}
let browser;
try {
  assert.equal((await fetch(base + '/salud')).status, 200);
  assert.equal((await fetch(base + '/api/estado')).status, 401);
  assert.equal((await fetch(base + '/api/estado', { headers: { Authorization: 'Bearer ' + access.APP_TOKEN, Origin: 'https://otro.example' } })).status, 403);
  const serviceId = prefix + '_servicio', clientId = prefix + '_clienta', appointmentId = prefix + '_cita';
  ids.push(serviceId, clientId, appointmentId);
  await put(serviceId, { id: serviceId, kind: 'servicio', nombre: 'Servicio de verificación', categoria: 'Pestañas', duracion: 30, precio: 100 });
  await put(clientId, { id: clientId, kind: 'clienta', nombre: 'Clienta de verificación', telefono: '5500000000', whatsappOptIn: false });
  await put(appointmentId, { id: appointmentId, kind: 'cita', servicio: serviceId, clienta: clientId, date: '2026-11-10', start: '11:00', estado: 'confirmada' });
  const connections = await api('/api/conexiones'); assert.equal(connections.response.status, 200);
  assert.equal(connections.data.whatsapp.configurado, false);
  assert.equal(new URL(connections.data.calendarioUrl).origin, new URL(base).origin);
  const calendar = await fetch(connections.data.calendarioUrl);
  assert.equal(calendar.status, 200); assert.match(calendar.headers.get('cache-control'), /no-store/);
  const ics = await calendar.text(); assert.match(ics, /Servicio de verificación/); assert.doesNotMatch(ics, /5500000000/);
  assert.equal((await fetch(base + '/webhooks/whatsapp')).status, 503);
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  async function device(name = 'Clienta de verificación') {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
    await context.addInitScript(token => localStorage.setItem('belleza.v1.token', token), access.APP_TOKEN);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(base); await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.getByRole('tab', { name: 'Clientas', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(name) }).waitFor();
    return { context, page };
  }
  const a = await device();
  await a.context.setOffline(true);
  await a.page.getByRole('button', { name: /Clienta de verificación/ }).click();
  await a.page.locator('#k-nombre').fill('Verificación sin conexión');
  await a.page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await a.page.reload(); await a.page.getByRole('tab', { name: 'Clientas', exact: true }).click();
  await a.page.getByRole('button', { name: /Verificación sin conexión/ }).waitFor();
  await a.context.setOffline(false);
  await a.page.getByRole('tab', { name: 'Ajustes', exact: true }).click();
  await a.page.getByRole('button', { name: /Sincronización/ }).click();
  await a.page.getByRole('button', { name: 'Sincronizar ahora', exact: true }).click();
  await a.page.waitForFunction(() => document.querySelector('#sync-status')?.textContent.includes('Sincronizado'));
  const b = await device('Verificación sin conexión');
  await b.page.getByRole('button', { name: /Verificación sin conexión/ }).waitFor();
  for (const width of [390, 768, 1440]) {
    await b.page.setViewportSize({ width, height: 900 });
    assert.equal(await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  const cached = await a.page.evaluate(async () => {
    const keys = []; for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) keys.push(request.url);
    return keys;
  });
  assert.equal(cached.some(url => /\/api\/|\/calendario\//.test(url)), false);
  assert.deepEqual(errors, []);
  console.log('Destino verificado: salud, autenticación, origen, PostgreSQL, calendario privado, dos dispositivos y cola sin conexión.');
} finally {
  await browser?.close();
  const current = await api('/api/estado');
  for (const id of ids) {
    const record = current.data.records?.find(row => row.id === id);
    if (record?.data) await put(id, null, record.version);
  }
  console.log('Registros de verificación retirados de la agenda. Prefijo:', prefix);
}
