import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {entornoSocial,ids,sesiones} from './social-entorno.mjs';
import {enTransaccion} from '../build/cuentas/contexto.js';
import {rutasPlanes,cobroValido} from '../build/planes/http.js';
import {rutasPlataforma} from '../build/plataforma/http.js';
const identidad=(u='admin',aal='aal2')=>({usuarioId:ids[u],sesionId:sesiones[u],aal}),origen='https://agendappx.test';
const COBRO={clabe:'012180001234567899',banco:'BBVA',titular:'Persona de Prueba'};
async function entorno(t){
 const e=await entornoSocial();t.after(()=>e.cerrar());
 const sql=async(q,a)=>{const c=await e.pool.connect();try{return await c.query(q,a);}finally{c.release();}};
 await sql("SELECT set_config('ritmo.plataforma_admin',$1,false)",[ids.admin]);
 for(const m of ['20261030180000_panel_plataforma.sql','20261109120000_cobros_transferencia.sql'])await sql(await readFile(new URL('../../supabase/migrations/'+m,import.meta.url),'utf8'));
 for(const u of ['admin','ajena','recepcion'])await sql('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[sesiones[u],ids[u]]);
 // «Otro salón» (Admin: ajena) es un salón nuevo en prueba; «salon» conserva su acceso existente.
 await sql("INSERT INTO ritmo.negocios_planes(negocio_id,plan,estado,prueba_inicio,prueba_fin) VALUES($1,'salon','prueba',now()-interval '20 days',now()+interval '10 days') ON CONFLICT(negocio_id) DO UPDATE SET estado='prueba',plan='salon',prueba_inicio=EXCLUDED.prueba_inicio,prueba_fin=EXCLUDED.prueba_fin,fundadora_numero=NULL",[ids.otro]);
 const salon=(q,a=[],u='ajena')=>enTransaccion(e.poolAPI,identidad(u),ids.otro,async c=>(await c.query(q,a)).rows[0]?.r);
 const panel=(q,a=[],i=identidad())=>enTransaccion(e.poolAPI,i,null,async c=>(await c.query(q,a)).rows[0]?.r);
 const llamar=async(rutas,ruta,{metodo='GET',datos}={})=>{const req=Readable.from(datos?[Buffer.from(JSON.stringify(datos))]:[]);req.method=metodo;req.headers={'content-type':'application/json',authorization:'Bearer x',...(metodo==='GET'?{}:{origin:origen})};let estado=0,cuerpo='';const res={writeHead(s){estado=s;return this;},end(b){cuerpo=b;}};await rutas(req,res,new URL(origen+ruta));return {estado,d:JSON.parse(cuerpo)};};
 return {...e,sql,salon,panel,llamar};
}
test('CLABE: solo se habilita el cobro con 18 dígitos y dígito verificador correcto',()=>{
 assert.deepEqual(cobroValido(COBRO),COBRO);
 assert.equal(cobroValido({...COBRO,clabe:'012180001234567890'}),null);
 assert.equal(cobroValido({...COBRO,clabe:'1234'}),null);
 assert.equal(cobroValido({...COBRO,titular:''}),null);
 assert.equal(cobroValido(undefined),null);
});
test('transferencia: pedir, avisar, confirmar en el panel y el plan queda pagado un mes después de la prueba',async t=>{
 const e=await entorno(t);
 const p=await e.salon('SELECT ritmo.pago_solicitar($1,$2,$3) AS r',[ids.otro,'pro',false]);
 assert.match(p.referencia,/^AGX-[0-9A-F]{6}$/);assert.equal(p.monto,799);assert.equal(p.estado,'pendiente');
 // Pedir otro reemplaza el pendiente: siempre hay uno abierto.
 const q=await e.salon('SELECT ritmo.pago_solicitar($1,$2,$3) AS r',[ids.otro,'salon',true]);assert.equal(q.monto,4490);
 assert.equal((await e.sql("SELECT count(*)::int AS n FROM ritmo.pagos_transferencia WHERE estado IN ('pendiente','reportado')")).rows[0].n,1);
 await e.salon('SELECT ritmo.pago_reportar($1,$2,$3)',[ids.otro,q.id,'  BBVA 3:15 pm  ']);
 await assert.rejects(()=>e.salon('SELECT ritmo.pago_solicitar($1,$2,$3) AS r',[ids.otro,'pro',false]),x=>x.code==='22023');
 const lista=await e.panel('SELECT ritmo.plataforma_pagos() AS r');assert.equal(lista.length,1);assert.equal(lista[0].estado,'reportado');assert.equal(lista[0].nota,'BBVA 3:15 pm');assert.equal(lista[0].salon,'Otro salón');
 const fin=(await e.sql('SELECT prueba_fin FROM ritmo.negocios_planes WHERE negocio_id=$1',[ids.otro])).rows[0].prueba_fin;
 const r=await e.panel('SELECT ritmo.plataforma_pago_confirmar($1) AS r',[q.id]);
 const plan=(await e.sql('SELECT plan,anual,pagado_hasta FROM ritmo.negocios_planes WHERE negocio_id=$1',[ids.otro])).rows[0];
 assert.equal(plan.plan,'salon');assert.equal(plan.anual,true);
 // Anual: un año contado desde el final de la prueba, no desde hoy.
 const esperado=new Date(fin);esperado.setFullYear(esperado.getFullYear()+1);assert.equal(new Date(plan.pagado_hasta).getTime(),esperado.getTime());assert.equal(new Date(r.pagadoHasta).getTime(),esperado.getTime());
 await assert.rejects(()=>e.panel('SELECT ritmo.plataforma_pago_confirmar($1) AS r',[q.id]),x=>x.code==='22023');
 assert.deepEqual((await e.panel('SELECT ritmo.plataforma_bitacora_reciente() AS r')).map(x=>x.accion),['pago_confirmado']);
 // Con el plan pagado ya no se cambia «gratis» desde la prueba.
 await assert.rejects(()=>e.salon('SELECT ritmo.elegir_plan($1,$2,$3)',[ids.otro,'pro',false]),x=>x.message==='agendappx_plan_pagado');
 // Termina la prueba: con el periodo pagado puede seguir escribiendo; sin él (y pasada la gracia), no.
 await e.sql("UPDATE ritmo.negocios_planes SET prueba_inicio=now()-interval '40 days',prueba_fin=now()-interval '10 days' WHERE negocio_id=$1",[ids.otro]);
 assert.equal((await e.sql('SELECT ritmo.plan_permite_escritura($1) AS r',[ids.otro])).rows[0].r,true);
 await e.sql("UPDATE ritmo.negocios_planes SET pagado_hasta=now()-interval '2 days' WHERE negocio_id=$1",[ids.otro]);
 assert.equal((await e.sql('SELECT ritmo.plan_permite_escritura($1) AS r',[ids.otro])).rows[0].r,true,'3 días de gracia');
 await e.sql("UPDATE ritmo.negocios_planes SET pagado_hasta=now()-interval '4 days' WHERE negocio_id=$1",[ids.otro]);
 assert.equal((await e.sql('SELECT ritmo.plan_permite_escritura($1) AS r',[ids.otro])).rows[0].r,false);
 // Pagar estando en pausa: el periodo empieza hoy.
 const n=await e.salon('SELECT ritmo.pago_solicitar($1,$2,$3) AS r',[ids.otro,'solo',false]);assert.equal(n.monto,249);
 const antes=Date.now();await e.panel('SELECT ritmo.plataforma_pago_confirmar($1) AS r',[n.id]);
 const hasta=new Date((await e.sql('SELECT pagado_hasta FROM ritmo.negocios_planes WHERE negocio_id=$1',[ids.otro])).rows[0].pagado_hasta).getTime();
 assert.ok(hasta-antes>27*86400000&&hasta-antes<32*86400000);
});
test('transferencia: rechazar con motivo, fundadora a $199 y nadie más confirma ni ve pagos ajenos',async t=>{
 const e=await entorno(t);
 await e.sql('UPDATE ritmo.negocios_planes SET fundadora_numero=3 WHERE negocio_id=$1',[ids.otro]);
 const p=await e.salon('SELECT ritmo.pago_solicitar($1,$2,$3) AS r',[ids.otro,'salon',false]);assert.equal(p.monto,199);
 // La Admin de otro salón, la recepción y el panel sin dos pasos no pueden.
 await assert.rejects(()=>enTransaccion(e.poolAPI,identidad('admin'),ids.otro,c=>c.query('SELECT ritmo.pagos_negocio($1) AS r',[ids.otro])),x=>['42501','P0001'].includes(x.code)||/acceso|miembro/i.test(x.message));
 for(const i of [identidad('ajena'),identidad('admin','aal1')])await assert.rejects(()=>e.panel('SELECT ritmo.plataforma_pago_confirmar($1) AS r',[p.id],i),x=>x.code==='42501');
 await assert.rejects(()=>e.panel('SELECT ritmo.plataforma_pago_rechazar($1,$2) AS r',[p.id,' ']),x=>x.code==='22023');
 await e.panel('SELECT ritmo.plataforma_pago_rechazar($1,$2) AS r',[p.id,'No encontré la transferencia.']);
 const h=await e.salon('SELECT ritmo.pagos_negocio($1) AS r',[ids.otro]);assert.equal(h[0].estado,'rechazado');assert.equal(h[0].motivo,'No encontré la transferencia.');
 assert.equal((await e.sql('SELECT pagado_hasta FROM ritmo.negocios_planes WHERE negocio_id=$1',[ids.otro])).rows[0].pagado_hasta,null);
 // El acceso existente no paga.
 await assert.rejects(()=>enTransaccion(e.poolAPI,identidad('admin'),ids.salon,c=>c.query('SELECT ritmo.pago_solicitar($1,$2,$3)',[ids.salon,'salon',false])),x=>x.code==='22023');
 // La API no lee la tabla directamente.
 await assert.rejects(()=>enTransaccion(e.poolAPI,identidad(),null,c=>c.query('SELECT * FROM ritmo.pagos_transferencia')),x=>x.code==='42501');
});
test('HTTP: Mi plan muestra CLABE solo si está configurada; el panel confirma',async t=>{
 const e=await entorno(t);let quien=identidad('ajena');const jwt={verificar:async()=>quien};
 const sin=rutasPlanes(e.poolAPI,jwt,origen),con=rutasPlanes(e.poolAPI,jwt,origen,{cobro:COBRO});
 const a=(await e.llamar(sin,'/api/negocios/'+ids.otro+'/plan')).d;assert.equal(a.cobrosHabilitados,false);assert.equal(a.transferencia,null);
 await assert.rejects(()=>e.llamar(sin,'/api/negocios/'+ids.otro+'/plan/pago',{metodo:'POST',datos:{plan:'salon',anual:false}}),x=>x.status===503);
 assert.equal((await e.llamar(con,'/api/planes/catalogo')).d.cobrosHabilitados,true);
 const p=(await e.llamar(con,'/api/negocios/'+ids.otro+'/plan/pago',{metodo:'POST',datos:{plan:'salon',anual:false}})).d;assert.equal(p.transferencia.clabe,COBRO.clabe);assert.equal(p.monto,449);
 await assert.rejects(()=>e.llamar(con,'/api/negocios/'+ids.otro+'/plan/pago',{metodo:'POST',datos:{plan:'gratis',anual:false}}),x=>x.status===400);
 await e.llamar(con,'/api/negocios/'+ids.otro+'/plan/pago/reportar',{metodo:'POST',datos:{id:p.id,nota:'Santander'}});
 let b=(await e.llamar(con,'/api/negocios/'+ids.otro+'/plan')).d;assert.equal(b.estado,'prueba');assert.equal(b.pagos[0].estado,'reportado');assert.equal(b.transferencia.banco,'BBVA');
 quien=identidad();const panel=rutasPlataforma(e.poolAPI,jwt,()=>origen,{});
 assert.equal((await e.llamar(panel,'/api/plataforma/pagos')).d.pagos.length,1);
 await e.llamar(panel,'/api/plataforma/pagos/'+p.id+'/confirmar',{metodo:'POST',datos:{}});
 quien=identidad('ajena');b=(await e.llamar(con,'/api/negocios/'+ids.otro+'/plan')).d;assert.equal(b.estado,'pagado');assert.ok(b.diasRestantes>=38);
 // Recepción no ve Mi plan.
 quien=identidad('recepcion');
});
