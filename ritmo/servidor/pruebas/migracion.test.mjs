import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entorno } from './entorno.mjs';
import { exportarMigracion, TABLAS_MIGRACION } from '../build/migracion.js';
test('el respaldo de traslado conserva versiones, recibos y enlace privado sin aceptar el token de la app', async () => {
  const token = 'clave_independiente_de_migracion_0123456789abcdef';
  let env;
  env = await entorno({ migracion: { token, soloLectura: true, exportar: () => exportarMigracion(env.pool) } });
  try {
    await env.repo.cambiar({ id: 'clienta_respaldo', baseVersion: 0, mutationId: 'op_respaldo', data: { id: 'clienta_respaldo', kind: 'clienta', nombre: 'Prueba aislada' } });
    const secret = await env.integraciones.tokenCalendario();
    const request = (key, path = '/operaciones/exportar') => fetch(env.base + path, { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal((await request(env.token)).status, 404);
    const response = await request(token); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json();
    assert.deepEqual(Object.keys(data.tablas), [...TABLAS_MIGRACION]);
    assert.equal(data.tablas.belleza_objetos[0].version, 1);
    assert.equal(data.tablas.belleza_mutaciones[0].id, 'op_respaldo');
    assert.equal(data.tablas.belleza_integraciones[0].data.token, secret);
    assert.equal(data.tablas.belleza_estado[0].revision, 1);
    assert.equal((await request(env.token, '/api/calendario/renovar')).status, 503);
    assert.equal((await fetch(env.base + '/api/estado', { headers: { Authorization: 'Bearer ' + env.token } })).status, 200);
  } finally { await env.cerrar(); }
});
