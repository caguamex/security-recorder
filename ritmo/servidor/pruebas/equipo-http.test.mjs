import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {cuentasEntorno,ids,sesiones} from './cuentas-entorno.mjs';
import {rutasCuentas} from '../build/cuentas/http.js';
import {crearServidor} from '../build/http.js';
import {ErrorAPI} from '../build/modelo.js';

test('Solo una administradora con MFA genera invitacion; una sola persona verificada la acepta',async()=>{
 const e=await cuentasEntorno();let origin='';
 const ident={admin:{usuarioId:ids.admin,sesionId:sesiones.admin,aal:'aal2'},sinFactor:{usuarioId:ids.admin,sesionId:sesiones.admin,aal:'aal1'},recepcion:{usuarioId:ids.recepcion,sesionId:sesiones.recepcion,aal:'aal1'},invitada:{usuarioId:ids.nueva,sesionId:sesiones.nueva,aal:'aal2'}};
 const jwt={async verificar(t){if(!ident[t])throw new ErrorAPI(401,'No autorizado');return ident[t]}};
 const config={habilitado:true,supabaseURL:'https://example.test',llavePublica:'sb_publishable_prueba',salones:new Set([ids.salon]),get origen(){return origin},claveLimite:'a'.repeat(40),turnstileSiteKey:'solo_prueba',temporales:true};
 const repo={salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})};
 const server=crearServidor(repo,'b'.repeat(40),fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{cuentas:rutasCuentas(e.poolAPI,jwt,config)});
 server.listen(0,'127.0.0.1');await once(server,'listening');origin='http://127.0.0.1:'+server.address().port;
 const post=(path,token,body,other={})=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Authorization:'Bearer '+token,...other},body:JSON.stringify(body)});
 try{
  const ruta='/api/negocios/'+ids.salon+'/invitaciones';
  assert.equal((await post(ruta,'sinFactor',{nombre:'Equipo'})).status,403);
  assert.equal((await post(ruta,'recepcion',{nombre:'Equipo'})).status,403);
  assert.equal((await post(ruta,'nadie',{nombre:'Equipo'})).status,401);
  assert.equal((await post(ruta,'admin',{nombre:'Equipo'},{Origin:'https://ajeno.invalid'})).status,403);
  const r=await post(ruta,'admin',{nombre:'Invitada'});assert.equal(r.status,200);const obj=await r.json();const link=new URL(obj.enlace);assert.equal(link.origin,origin);assert.equal(link.search,'');const codigo=link.hash.slice('#invitacion='.length);assert.match(codigo,/^[A-Za-z0-9_-]{22}$/);
  assert.equal((await post('/api/invitaciones/aceptar','sinFactor',{codigo,nombre:'Otra'})).status,403);
  assert.equal((await fetch(origin+'/api/negocios/'+ids.salon+'/datos/estado',{headers:{Authorization:'Bearer invitada'}})).status,403);
  assert.equal((await post('/api/invitaciones/aceptar','invitada',{codigo,nombre:'Otra'})).status,200);
  assert.equal((await post('/api/invitaciones/aceptar','invitada',{codigo,nombre:'Otra'})).status,404);
  const row=(await e.db.query('SELECT rol FROM ritmo.miembros WHERE negocio_id=$1 AND usuario_id=$2',[ids.salon,ids.nueva])).rows[0];assert.equal(row.rol,'admin');
  const listado=await fetch(origin+'/api/negocios/'+ids.salon+'/miembros',{headers:{Authorization:'Bearer admin'}});assert.equal(listado.status,200);assert.ok((await listado.json()).miembros.some(m=>m.id===ids.nueva));
  const rechazo=await fetch(origin+'/api/negocios/'+ids.salon+'/miembros/'+ids.admin,{method:'DELETE',headers:{Origin:origin,Authorization:'Bearer admin'}});assert.equal(rechazo.status,403);
  const borrar=await fetch(origin+'/api/negocios/'+ids.salon+'/miembros/'+ids.nueva,{method:'DELETE',headers:{Origin:origin,Authorization:'Bearer admin'}});assert.equal(borrar.status,200);
  const denegada=await fetch(origin+'/api/negocios/'+ids.salon+'/datos/estado',{headers:{Authorization:'Bearer invitada'}});assert.equal(denegada.status,403);

 }finally{await new Promise(r=>server.close(r));await e.cerrar();}
});
