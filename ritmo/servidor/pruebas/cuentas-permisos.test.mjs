import test from 'node:test';
import assert from 'node:assert/strict';
import { autorizar } from '../build/cuentas/permisos.js';

const identidad = { usuarioId: 'persona-a', aal: 'aal1' };
const base = { negocioId: 'salon-a', usuarioId: 'persona-a', rol: 'especialista',
  activo: true, verTodas: false, servicios: ['cejas'] };
const propio = { negocioId: 'salon-a', especialistaId: 'persona-a', servicioId: 'cejas' };
const ajeno = { ...propio, especialistaId: 'persona-b' };
const proveedor = miembro => ({ buscar: async (negocio, usuario) =>
  miembro?.negocioId === negocio && miembro?.usuarioId === usuario ? miembro : null });
const denegado = promesa => assert.rejects(promesa, e => e.status === 403);

test('Especialista: leer todas las agendas no permite editar citas ajenas ni consultar sus ingresos o clientas', async () => {
  const todas = proveedor({ ...base, verTodas: true });
  await autorizar(identidad, todas, 'agenda:leer', ajeno);
  for (const accion of ['cita:editar', 'ingresos:leer', 'clientas:leer', 'historial:leer', 'cita:historial']) {
    await denegado(autorizar(identidad, todas, accion, ajeno));
  }
  await autorizar(identidad, todas, 'cita:editar', propio);
  await autorizar(identidad, todas, 'cita:historial', propio);
  await denegado(autorizar(identidad, todas, 'historial:leer', propio));
  await denegado(autorizar(identidad, todas, 'cita:editar', { ...propio, servicioId: 'cabello' }));
  await denegado(autorizar(identidad, todas, 'cita:editar', { ...propio, servicioId: undefined }));
  await denegado(autorizar(identidad, proveedor(base), 'agenda:leer', ajeno));
});

test('Recepción: agenda y clientas disponibles; precios, equipo, historial e ingresos bloqueados', async () => {
  const recepcion = proveedor({ ...base, rol: 'recepcion' });
  for (const accion of ['agenda:leer', 'cita:editar', 'clientas:leer', 'catalogo:leer', 'cita:historial']) {
    await autorizar(identidad, recepcion, accion, ajeno);
  }
  for (const accion of ['catalogo:editar', 'equipo:editar', 'negocio:editar', 'conexiones:editar', 'historial:leer', 'ingresos:leer']) {
    await denegado(autorizar(identidad, recepcion, accion, propio));
  }
});

test('Admin: una sesión sin segundo factor no accede ni siquiera a lecturas del salón', async () => {
  const admin = proveedor({ ...base, rol: 'admin' });
  for (const accion of ['agenda:leer', 'catalogo:leer', 'equipo:editar']) {
    await denegado(autorizar(identidad, admin, accion, propio));
    await autorizar({ ...identidad, aal: 'aal2' }, admin, accion, propio);
  }
});

test('La membresía se vuelve a consultar: revocar acceso bloquea la siguiente operación', async () => {
  let actual = { ...base };
  let consultas = 0;
  const miembros = { buscar: async () => { consultas++; return actual; } };
  await autorizar(identidad, miembros, 'agenda:leer', propio);
  actual = { ...actual, activo: false };
  await denegado(autorizar(identidad, miembros, 'agenda:leer', propio));
  assert.equal(consultas, 2);
});

test('Se rechazan otro salón, identidad distinta, roles desconocidos y acciones desconocidas', async () => {
  await denegado(autorizar(identidad, proveedor(base), 'agenda:leer', { ...propio, negocioId: 'salon-b' }));
  // Defensa adicional incluso si un adaptador devuelve una fila equivocada.
  for (const cambio of [{ negocioId: 'salon-b' }, { usuarioId: 'persona-b' }, { rol: 'superadmin' }]) {
    await denegado(autorizar(identidad, { buscar: async () => ({ ...base, ...cambio }) }, 'agenda:leer', propio));
  }
  await denegado(autorizar(identidad, proveedor(base), 'ignorar-permisos', propio));
});
