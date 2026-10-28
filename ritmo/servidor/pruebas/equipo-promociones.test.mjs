import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cuentasEntorno, ids, sesiones } from './cuentas-entorno.mjs';
import { Invitaciones } from '../build/cuentas/invitaciones.js';
import { RepositorioConCuentas } from '../build/cuentas/repositorio.js';

test('Invitada ve las promociones del salon y pierde acceso al revocarse', async () => {
  const e = await cuentasEntorno();
  try {
    const ident = u => ({usuarioId: ids[u], sesionId: sesiones[u], aal: ['admin','ajena'].includes(u) ? 'aal2' : 'aal1'});
    const inv = new Invitaciones(e.poolAPI);
    const creada = await inv.crear(ident('admin'), ids.salon, {nombre:'Recepcion', rol:'recepcion', servicios:[], horario:{}});
    const ip = createHash('sha256').update('prueba-local').digest('hex');
    await inv.aceptar(ident('nueva'), creada.codigo, {nombre:'Recepcion', resumenCorreo:false}, ip);
    const admin = new RepositorioConCuentas(e.poolAPI, ident('admin'), ids.salon);
    const invitada = new RepositorioConCuentas(e.poolAPI, ident('nueva'), ids.salon);
    const otroSalon = new RepositorioConCuentas(e.poolAPI, ident('ajena'), ids.otro);
    const id='promo-compartida', data={id,kind:'promo',titulo:'Oferta inicial',texto:'Texto de prueba'};
    await admin.cambiar({id,data,baseVersion:0,mutationId:'crear_promo_prueba_1234'});
    assert.equal((await invitada.snapshot()).records.find(r=>r.id===id).data.titulo,'Oferta inicial');
    assert.equal((await otroSalon.snapshot()).records.some(r=>r.id===id),false);
    await admin.cambiar({id,data:{...data,titulo:'Oferta actualizada'},baseVersion:1,mutationId:'editar_promo_prueba_123'});
    assert.equal((await invitada.snapshot()).records.find(r=>r.id===id).data.titulo,'Oferta actualizada');
    await assert.rejects(invitada.cambiar({id,data,baseVersion:2,mutationId:'edicion_recepcion_12345'}));
    await e.como('admin', ids.salon, c=>c.query('UPDATE ritmo.miembros SET activo=false WHERE negocio_id=$1 AND usuario_id=$2',[ids.salon,ids.nueva]));
    await assert.rejects(invitada.snapshot(), err=>err.status===403);
  } finally { await e.cerrar(); }
});

test('Dos administradoras comparten y editan promociones con segundo factor', async () => {
  const e = await cuentasEntorno();
  try {
    const identity = (u,aal) => ({usuarioId:ids[u],sesionId:sesiones[u],aal});
    const admin=identity('admin','aal2'), nueva=identity('nueva','aal1');
    const inv=new Invitaciones(e.poolAPI);
    const creada=await inv.crear(admin,ids.salon,{nombre:'Otra administradora',rol:'admin',servicios:[],horario:{}});
    await inv.aceptar(nueva,creada.codigo,{nombre:'Otra administradora',resumenCorreo:false},createHash('sha256').update('prueba').digest('hex'));
    const primera=new RepositorioConCuentas(e.poolAPI,admin,ids.salon);
    const sinFactor=new RepositorioConCuentas(e.poolAPI,nueva,ids.salon);
    const segunda=new RepositorioConCuentas(e.poolAPI,identity('nueva','aal2'),ids.salon);
    const id='promo-admins',data={id,kind:'promo',titulo:'Oferta',texto:'Prueba'};
    await primera.cambiar({id,data,baseVersion:0,mutationId:'crear_promocion_123456'});
    await assert.rejects(sinFactor.snapshot(),err=>err.status===403);
    assert.equal((await segunda.snapshot()).records.find(r=>r.id===id).data.titulo,'Oferta');
    await segunda.cambiar({id,data:{...data,titulo:'Oferta nueva'},baseVersion:1,mutationId:'editar_promocion_12345'});
    assert.equal((await primera.snapshot()).records.find(r=>r.id===id).data.titulo,'Oferta nueva');
    await assert.rejects(inv.aceptar(identity('ajena','aal2'),creada.codigo,{nombre:'Otra',resumenCorreo:false},createHash('sha256').update('segunda').digest('hex')));
  } finally { await e.cerrar(); }
});
