import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {cuentasEntorno,ids,sesiones} from './cuentas-entorno.mjs';
import {rutasCuentas} from '../build/cuentas/http.js';
import {crearServidor} from '../build/http.js';
import {ErrorAPI} from '../build/modelo.js';

test('Asignaciones: solo miembros del salon ven nombres y servicios de personas activas',async()=>{
 const e=await cuentasEntorno();let base='';
 const identity={admin:{usuarioId:ids.admin,sesionId:sesiones.admin,aal:'aal2'},recepcion:{usuarioId:ids.recepcion,sesionId:sesiones.recepcion,aal:'aal1'},ajena:{usuarioId:ids.ajena,sesionId:sesiones.ajena,aal:'aal2'}};
 const jwt={async verificar(t){if(!identity[t])throw new ErrorAPI(401,'Inicia sesion');return identity[t]}};
 const config={habilitado:true,supabaseURL:'https://example.test',llavePublica:'sb_publishable_prueba',salones:new Set([ids.salon,ids.otro]),get origen(){return base}};
 const server=crearServidor({salud:async()=>{},estado:async()=>[],snapshot:async()=>({records:[],cursor:0,full:true})},'a'.repeat(40),fileURLToPath(new URL('../../dist/pwa/',import.meta.url)),{cuentas:rutasCuentas(e.poolAPI,jwt,config)});
 server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
 const get=(salon,t)=>fetch(base+'/api/negocios/'+salon+'/datos/prestadores',{headers:t?{Authorization:'Bearer '+t}:{}});
 try{
  await e.como('admin',ids.salon,c=>c.query("UPDATE ritmo.miembros SET nombre='Karina', servicios=ARRAY['cejas'] WHERE usuario_id=$1",[ids.especialista]));
  const r=await get(ids.salon,'recepcion');assert.equal(r.status,200);const equipo=(await r.json()).equipo;assert.ok(equipo.some(m=>m.nombre==='Karina'&&m.servicios.includes('cejas')));assert.ok(equipo.every(m=>Object.keys(m).sort().join(',')==='nombre,servicios'));
  assert.equal((await get(ids.salon)).status,401);assert.equal((await get(ids.otro,'recepcion')).status,403);assert.equal((await get(ids.salon,'ajena')).status,403);
  await e.como('admin',ids.salon,c=>c.query('UPDATE ritmo.miembros SET activo=false WHERE usuario_id=$1',[ids.especialista]));
  assert.equal((await (await get(ids.salon,'recepcion')).json()).equipo.some(m=>m.nombre==='Karina'),false);
 }finally{await new Promise(r=>server.close(r));await e.cerrar();}
});
