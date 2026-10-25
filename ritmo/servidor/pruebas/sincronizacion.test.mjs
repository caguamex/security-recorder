import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { entorno } from './entorno.mjs';
const { crear } = createRequire(import.meta.url)('../../belleza/sincronizacion.js');
let env;
before(async () => { env = await entorno(); });
after(async () => { await env?.cerrar(); });
function dispositivo() {
  const values = new Map(); const network = { offline: false, perderRespuesta: false };
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const create = () => crear({ storage, uuid: randomUUID, fetcher: async (path, options) => {
    if (network.offline) throw new TypeError('Sin red');
    const response = await fetch(env.base + path, options);
    if (options.method === 'PUT' && network.perderRespuesta) { network.perderRespuesta = false; throw new TypeError('Respuesta perdida'); }
    return response;
  } });
  return { storage, network, create };
}
test('conserva cambios y eliminaciones sin conexión tras reiniciar', async () => {
  const d = dispositivo(); let app = d.create();
  d.network.offline = true;
  app.put({ id: 'offline', kind: 'clienta', nombre: 'Sin red' });
  app = d.create(); assert.equal(app.items.get('offline').nombre, 'Sin red');
  d.network.offline = false; await app.conectar(env.token); assert.equal(app.pending.length, 0);
  d.network.offline = true; app.remove('offline'); await app.sync();
  app = d.create(); assert.equal(app.items.has('offline'), false); assert.equal(app.pending.length, 1);
  d.network.offline = false; await app.sync();
  assert.equal((await env.repo.estado()).find(r => r.id === 'offline').data, null);
});
test('una respuesta perdida se reintenta sin duplicar la escritura', async () => {
  const d = dispositivo(); const app = d.create();
  app.put({ id: 'perdida', kind: 'clienta', nombre: 'Respuesta perdida' });
  d.network.perderRespuesta = true; await app.conectar(env.token);
  assert.equal(app.pending.length, 1); await app.sync();
  assert.equal(app.pending.length, 0); assert.equal((await env.repo.estado()).find(r => r.id === 'perdida').version, 1);
});
test('dos dispositivos resuelven conflictos sin descartar la copia local', async () => {
  const a = dispositivo(), b = dispositivo(); let appA = a.create(), appB = b.create();
  appA.put({ id: 'conflicto', kind: 'clienta', nombre: 'Inicial' }); await appA.conectar(env.token); await appB.conectar(env.token);
  a.network.offline = true; b.network.offline = true;
  appA.put({ id: 'conflicto', kind: 'clienta', nombre: 'Versión A' }); await appA.sync();
  appB.put({ id: 'conflicto', kind: 'clienta', nombre: 'Versión B' }); await appB.sync();
  a.network.offline = false; await appA.sync(); b.network.offline = false; await appB.sync();
  assert.equal(appB.conflicts.length, 1); assert.equal(appB.items.get('conflicto').nombre, 'Versión B');
  appB = b.create(); assert.equal(appB.conflicts.length, 1);
  // Resolver sin red comprueba que la decisión también se conserva al reiniciar.
  b.network.offline = true; appB.resolver('conflicto', true); await appB.sync();
  b.network.offline = false; appB = b.create(); await appB.sync();
  await appA.sync(); assert.equal(appA.items.get('conflicto').nombre, 'Versión B');
});
test('rechaza un token inválido sin guardarlo ni enviar objetos', async () => {
  const d = dispositivo(), app = d.create();
  await assert.rejects(app.conectar('incorrecto'), e => e.status === 401);
  assert.equal(d.storage.getItem('belleza.v1.token'), null); assert.equal(app.connected, false);
});
test('un almacenamiento lleno no modifica la copia en memoria ni la cola', () => {
  const d = dispositivo(), app = d.create();
  d.storage.setItem = () => { throw new Error('Cuota agotada'); };
  assert.throws(() => app.put({ id: 'lleno', kind: 'clienta', nombre: 'No guardada' }));
  assert.equal(app.items.has('lleno'), false); assert.equal(app.pending.length, 0);
});
test('migra los datos locales anteriores sin perder ajustes', async () => {
  const d = dispositivo();
  d.storage.setItem('belleza.v1.items', JSON.stringify([{ id: 'migrada', kind: 'clienta', nombre: 'Anterior' }]));
  d.storage.setItem('belleza.v1.settings', JSON.stringify({ skin: 'dorado' }));
  const app = d.create(); assert.equal(app.settings.skin, 'dorado'); assert.equal(app.items.get('migrada').nombre, 'Anterior');
  await app.conectar(env.token);
  assert.equal(app.pending.length, 0); assert.equal(app.items.get('migrada').nombre, 'Anterior');
});
