import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {CustodioSesion} from '../../railway/evolution/guard/sesion.mjs';
let db,a,b,c;
before(async()=>{
 db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE ritmo_api;
  CREATE SCHEMA ritmo;CREATE TABLE ritmo.datos_privados(id integer);SET ritmo.migracion_autorizada='si';`);
 const dir=new URL('../../supabase/migrations/',import.meta.url);
 const archivo=(await readdir(dir)).find(v=>v.endsWith('_evolution_privado.sql'));
 await db.exec(await readFile(new URL(archivo,dir),'utf8'));
 await db.exec(`SET ROLE agendappx_evolution;
  CREATE TABLE agendappx_evolution.credenciales_prueba(id integer,valor text);
  INSERT INTO agendappx_evolution.credenciales_prueba VALUES(1,'sesion-local-conservada');`);
 a=new CustodioSesion(db,{propietario:randomUUID(),despliegue:'version-1'});
 b=new CustodioSesion(db,{propietario:randomUUID(),despliegue:'version-1'});
 c=new CustodioSesion(db,{propietario:randomUUID(),despliegue:'version-2'});
 await a.preparar();
});
after(async()=>{await db?.close();});
test('Solo un motor obtiene la sesión y una réplica de la misma versión no expulsa al activo',async()=>{
 assert.equal(await a.adquirir(),true);assert.equal(await b.adquirir(),false);assert.equal(await a.renovar(),true);
});
test('Publicación nueva pide salida ordenada y espera la liberación antes de abrir la misma sesión',async()=>{
 assert.equal(await c.adquirir(),false);assert.equal(await a.renovar(),false);
 await a.liberar();assert.equal(await c.adquirir(),true);assert.equal(await c.renovar(),true);
 await a.liberar();assert.equal(await c.renovar(),true);
 assert.equal((await db.query('SELECT valor FROM agendappx_evolution.credenciales_prueba')).rows[0].valor,'sesion-local-conservada');
});
test('Una concesión vencida pierde autoridad sin borrar credenciales; un proceso nuevo puede tomarla',async()=>{
 await db.query("UPDATE agendappx_evolution.agendappx_runtime SET vence_en=now()-interval '1 second'");
 assert.equal(await c.renovar(),false);assert.equal(await b.adquirir(),true);
 await c.liberar();assert.equal(await b.renovar(),true);
});

test('El rol del proveedor no accede a la app y los roles públicos no leen sus credenciales',async()=>{
 await assert.rejects(db.query('SELECT * FROM ritmo.datos_privados'),e=>e.code==='42501');
 await db.exec('RESET ROLE');
 for(const rol of ['anon','authenticated','ritmo_api']){
  await db.exec('SET ROLE '+rol);
  await assert.rejects(db.query('SELECT * FROM agendappx_evolution.credenciales_prueba'),e=>e.code==='42501');
  await db.exec('RESET ROLE');
 }
});
