import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { once } from 'node:events';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { cuentasEntorno, ids, sesiones } from './cuentas-entorno.mjs';
import { ProveedorEvolution, instanciaDelSalon } from '../build/whatsapp-evolution/proveedor.js';
import { VinculacionWhatsApp } from '../build/whatsapp-evolution/vinculacion.js';
import { rutasVinculacion } from '../build/whatsapp-evolution/http.js';
import { VerificadorJWT } from '../build/cuentas/jwt.js';
import { crearServidor } from '../build/http.js';
let e,servicio,proveedor,server,base,par,estados,peticiones,timeout,retener,desbloquear,llego,esperarInicio;
const admin={usuarioId:ids.admin,sesionId:sesiones.admin,aal:'aal2'};
const numero='525511111111';
async function remoto(url,opciones){
  const u=new URL(url), partes=u.pathname.split('/');
  const nombre=partes.at(-1);
  peticiones.push({ruta:u.pathname,metodo:opciones.method,datos:opciones.body?JSON.parse(opciones.body):null});
  assert.equal(opciones.redirect,'error');
  if(timeout)throw new Error('corte simulado');
  if(u.pathname.startsWith('/instance/connectionState/'))return Response.json(estados.has(nombre)?{instance:{instanceName:nombre,state:estados.get(nombre)}}:{status:404,error:'Not Found',response:{message:['No existe la instancia']}},{status:estados.has(nombre)?200:404});
  if(u.pathname==='/instance/fetchInstances')return Response.json([{name:u.searchParams.get('instanceName'),ownerJid:numero+'@s.whatsapp.net',token:'secreto-que-nunca-sale-al-cliente'}]);
  if(u.pathname==='/instance/create'){estados.set(JSON.parse(opciones.body).instanceName,'close');return Response.json({},{status:201});}
  if(u.pathname.startsWith('/instance/connect/')){if(retener){llego();await new Promise(r=>{desbloquear=r;});}return Response.json({pairingCode:'ABCD1234'});}
  if(u.pathname.startsWith('/instance/logout/')){estados.set(nombre,'close');return new Response(null,{status:204});}
  if(u.pathname.startsWith('/instance/restart/')){assert.equal(opciones.method,'PUT');estados.set(nombre,'connecting');return Response.json({});}
  if(u.pathname.startsWith('/webhook/set/')){const w=JSON.parse(opciones.body).webhook;assert.equal(w.byEvents,false);assert.equal(w.base64,false);return Response.json({},{status:201});}
  throw new Error('Ruta inesperada '+u.pathname);
}
before(async()=>{
  e=await cuentasEntorno();
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  const archivo=(await readdir(dir)).find(v=>v.endsWith('_whatsapp_vinculacion.sql'));
  await e.db.exec(await readFile(new URL(archivo,dir),'utf8'));
  proveedor=new ProveedorEvolution({url:'https://evolution.local',apiKey:'k'.repeat(40),webhookKey:'w'.repeat(40),publicURL:'https://agendappx.local'},remoto);
  servicio=new VinculacionWhatsApp(e.poolAPI,proveedor,new Set([ids.salon]));
  par=await generateKeyPair('ES256',{extractable:true});
  const jwk={...await exportJWK(par.publicKey),kid:'local',alg:'ES256'};
  const jwt=new VerificadorJWT('https://proyecto-local.supabase.co',{fetch:async()=>Response.json({keys:[jwk]})});
  const repo={salud:async()=>{},snapshot:async()=>({records:[],cursor:0,full:true}),estado:async()=>[],cambiar:async()=>{throw new Error('No usar el repositorio heredado');}};
  server=crearServidor(repo,'token_heredado_de_prueba_123456789012345','/sin-publicar',{vinculacion:rutasVinculacion(servicio,jwt)});
  server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await new Promise(r=>{server.close(r);server.closeAllConnections();});await e?.cerrar();});
beforeEach(async()=>{
  const c=await e.pool.connect();try{await c.query('TRUNCATE ritmo.whatsapp_vinculaciones');}finally{c.release();}
  estados=new Map();peticiones=[];timeout=false;retener=false;desbloquear=null;esperarInicio=new Promise(r=>{llego=r;});
});
async function token(usuario='admin',aal=usuario==='admin'?'aal2':'aal1'){
  return new SignJWT({session_id:sesiones[usuario],aal,role:'authenticated'})
    .setProtectedHeader({alg:'ES256',kid:'local'}).setSubject(ids[usuario]).setIssuer('https://proyecto-local.supabase.co/auth/v1')
    .setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(par.privateKey);
}
async function api(accion='',datos,usuario='admin',aal,negocio=ids.salon,origin=base){
  return fetch(base+'/api/negocios/'+negocio+'/whatsapp'+(accion?'/'+accion:''),{
    method:datos?'POST':'GET',headers:{Origin:origin,Authorization:'Bearer '+await token(usuario,aal),'Content-Type':'application/json'},
    ...(datos?{body:JSON.stringify(datos)}:{})});
}
async function vincular(){await servicio.solicitarCodigo(admin,ids.salon,numero);estados.set(instanciaDelSalon(ids.salon),'open');return servicio.estado(admin,ids.salon);}

test('Vincular devuelve ocho caracteres, crea solo la instancia del salón y no guarda el código ni revela secretos',async()=>{
  const r=await api('codigo',{telefono:'55 1111 1111'});assert.equal(r.status,200);const j=await r.json();
  assert.equal(j.codigo,'ABCD1234');assert.equal(j.estado,'vinculando');assert.equal(j.enviosActivados,false);
  assert.equal(r.headers.get('cache-control'),'private, no-store');
  const fila=(await e.db.query('SELECT * FROM ritmo.whatsapp_vinculaciones')).rows[0];
  assert.equal(fila.instancia,instanciaDelSalon(ids.salon));assert.equal(JSON.stringify(fila).includes(j.codigo),false);
  assert.equal(JSON.stringify(j).includes('clave_webhook'),false);
  const creada=peticiones.find(p=>p.ruta==='/instance/create').datos;
  assert.equal(creada.syncFullHistory,false);assert.equal(creada.qrcode,false);assert.equal(creada.integration,'WHATSAPP-BAILEYS');
});
test('APP_TOKEN, sesión sin MFA, Recepción, Especialista, otro salón y origen ajeno no controlan WhatsApp',async()=>{
  const r=await fetch(base+'/api/negocios/'+ids.salon+'/whatsapp/codigo',{method:'POST',headers:{Authorization:'Bearer token_heredado_de_prueba_123456789012345','Content-Type':'application/json'},body:JSON.stringify({telefono:numero})});
  assert.equal(r.status,401);
  for(const [u,aal,negocio,origin] of [['admin','aal1',ids.salon,base],['recepcion','aal1',ids.salon,base],['especialista','aal1',ids.salon,base],['admin','aal2',ids.otro,base],['admin','aal2',ids.salon,'https://ajeno.invalid']]){
    assert.equal((await api('codigo',{telefono:numero},u,aal,negocio,origin)).status,403);
  }
  assert.equal((await api('codigo',{telefono:numero,instancia:'otra'})).status,400);
  assert.equal(peticiones.length,0);
});
test('Estado y reinicio del cliente API conservan la instancia y no piden otro código',async()=>{
  assert.equal((await vincular()).numero,numero);
  const otroCliente=new VinculacionWhatsApp(e.poolAPI,proveedor,new Set([ids.salon]));
  const estado=await otroCliente.estado(admin,ids.salon);assert.equal(estado.estado,'conectado');assert.equal(estado.verificado,true);
  assert.equal(JSON.stringify(estado).includes('secreto-que-nunca-sale'),false);
  assert.equal(peticiones.filter(p=>p.ruta==='/instance/create').length,1);
  assert.equal(peticiones.filter(p=>p.ruta.startsWith('/instance/connect/')).length,1);
  assert.equal(peticiones.some(p=>p.ruta.includes('logout')||p.ruta.includes('/delete/')),false);
});
test('Error de red no borra ni recrea la sesión; recuperar utiliza restart con espera progresiva',async()=>{
  await vincular();timeout=true;await assert.rejects(servicio.estado(admin,ids.salon),v=>v.status===503);
  assert.equal((await e.db.query('SELECT estado FROM ritmo.whatsapp_vinculaciones')).rows[0].estado,'conectado');
  timeout=false;estados.set(instanciaDelSalon(ids.salon),'close');
  assert.equal((await servicio.recuperar(admin,ids.salon)).estado,'reconectando');
  await assert.rejects(servicio.recuperar(admin,ids.salon),v=>v.status===429);
  assert.equal(peticiones.filter(p=>p.ruta.startsWith('/instance/restart/')).length,1);
  assert.equal(peticiones.some(p=>p.ruta.includes('logout')||p.ruta.includes('/delete/')),false);
});
test('Solicitudes concurrentes y límite de tres códigos en cinco minutos impiden regeneraciones repetidas',async()=>{
  retener=true;const primera=servicio.solicitarCodigo(admin,ids.salon,numero);
  await esperarInicio;
  assert.ok(desbloquear);await assert.rejects(servicio.solicitarCodigo(admin,ids.salon,numero),v=>v.status===409);
  retener=false;desbloquear();await primera;
  await servicio.solicitarCodigo(admin,ids.salon,numero);await servicio.solicitarCodigo(admin,ids.salon,numero);
  await assert.rejects(servicio.solicitarCodigo(admin,ids.salon,numero),v=>v.status===429);
  assert.equal(peticiones.filter(p=>p.ruta.startsWith('/instance/connect/')).length,3);
});
test('Desvincular exige confirmación y no se recupera después por accidente',async()=>{
  await vincular();await assert.rejects(servicio.desvincular(admin,ids.salon,false),v=>v.status===400);
  const j=await servicio.desvincular(admin,ids.salon,true);assert.equal(j.estado,'sin_vincular');assert.equal(j.cerradaManualmente,true);
  await assert.rejects(servicio.recuperar(admin,ids.salon),v=>v.status===409);
  assert.equal(peticiones.filter(p=>p.ruta.includes('logout')).length,1);
});
test('Webhook exige secreto por salón, ignora repetidos y detiene recuperación cuando WhatsApp revoca la sesión',async()=>{
  await vincular();
  const evento={instance:instanciaDelSalon(ids.salon),event:'connection.update',date_time:new Date().toISOString(),data:{state:'close',statusReason:401}};
  await assert.rejects(servicio.webhook(ids.salon,'Bearer '+'a'.repeat(64),evento),v=>v.status===403);
  await servicio.webhook(ids.salon,'Bearer '+proveedor.claveWebhook(ids.salon),evento);
  const f=(await e.db.query('SELECT * FROM ritmo.whatsapp_vinculaciones')).rows[0];assert.equal(f.estado,'requiere_vincular');
  await servicio.webhook(ids.salon,'Bearer '+proveedor.claveWebhook(ids.salon),evento);
  assert.equal((await e.db.query('SELECT evento_en FROM ritmo.whatsapp_vinculaciones')).rows[0].evento_en.toISOString(),f.evento_en.toISOString());
  await assert.rejects(servicio.recuperar(admin,ids.salon),v=>v.status===409);
  await assert.rejects(servicio.webhook(ids.otro,'Bearer '+proveedor.claveWebhook(ids.salon),evento),v=>v.status===403);
});
test('RLS impide a otro salón leer o modificar la conexión y cerrar la sesión de Admin bloquea la siguiente operación',async()=>{
  await vincular();assert.equal((await e.como('ajena',ids.otro,c=>c.query('SELECT * FROM ritmo.whatsapp_vinculaciones'))).rows.length,0);
  assert.equal((await e.como('recepcion',ids.salon,c=>c.query('SELECT * FROM ritmo.whatsapp_vinculaciones'))).rows.length,0);
  await e.db.query("UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id=$1",[sesiones.admin]);
  assert.equal((await api()).status,401);
  await e.db.query('UPDATE auth.sessions SET not_after=NULL WHERE id=$1',[sesiones.admin]);
});


test('Un salón nuevo no crea recursos automáticamente sin habilitación expresa de consumo',async()=>{
  const sinHabilitar=new VinculacionWhatsApp(e.poolAPI,proveedor);
  await assert.rejects(sinHabilitar.solicitarCodigo(admin,ids.salon,numero),v=>v.status===403);
  assert.equal(peticiones.length,0);
});


test('Un 404 de infraestructura no se confunde con una instancia ausente ni provoca recreación',async()=>{
 let llamadas=0;
 const noDisponible=new ProveedorEvolution({url:'https://evolution.local',apiKey:'k'.repeat(40),webhookKey:'w'.repeat(40),publicURL:'https://agendappx.local'},async()=>{llamadas++;return new Response('<html>No disponible</html>',{status:404});});
 const v=new VinculacionWhatsApp(e.poolAPI,noDisponible,new Set([ids.salon]));
 await assert.rejects(v.solicitarCodigo(admin,ids.salon,numero),e=>e.status===503);
 assert.equal(llamadas,1);
});
test('Una sesión ya vinculada que desaparece del proveedor no se recrea por solicitar otro código',async()=>{
 await vincular();estados.delete(instanciaDelSalon(ids.salon));
 await assert.rejects(servicio.solicitarCodigo(admin,ids.salon,numero),e=>e.status===409);
 assert.equal(peticiones.filter(p=>p.ruta==='/instance/create').length,1);
 assert.equal(peticiones.some(p=>p.ruta.includes('logout')),false);
});
