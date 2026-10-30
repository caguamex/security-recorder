import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {randomBytes,createHmac} from 'node:crypto';
import webpush from 'web-push';
import {entornoSocial,ids,sesiones} from './social-entorno.mjs';
import {CodigosWhatsApp} from '../../whatsapp/codigos.mjs';
import {enTransaccion} from '../build/cuentas/contexto.js';
import {rutasPlataforma} from '../build/plataforma/http.js';
import {cifrarCodigo,descifrarCodigo,firmarAviso,avisoValido,telefonoOculto} from '../build/plataforma/cifrado.js';
const identidad=(u='admin',aal='aal2')=>({usuarioId:ids[u],sesionId:sesiones[u],aal}),origen='https://agendappx.test';
async function entorno(t,{conectado=false}={}){
 const e=await entornoSocial();t.after(()=>e.cerrar());
 const sql=async(q,a)=>{const c=await e.pool.connect();try{return await c.query(q,a);}finally{c.release();}};
 await sql("SELECT set_config('ritmo.plataforma_admin',$1,false)",[ids.admin]);
 for(const m of ['20261030180000_panel_plataforma.sql','20261030190000_codigos_manuales.sql'])await sql(await readFile(new URL('../../supabase/migrations/'+m,import.meta.url),'utf8'));
 await sql('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2),($3,$4) ON CONFLICT DO NOTHING',[sesiones.admin,ids.admin,sesiones.ajena,ids.ajena]);
 const avisos=[],enviados=[];
 const remoto={async estado(){return {estado:conectado?'conectado':'cerrado',verificado:conectado,numero:'528661241483'};},async enviar(){throw Object.assign(new Error('caído'),{status:500});}};
 const codigos=new CodigosWhatsApp(e.plataformaDB,remoto,{habilitado:true,hookSecret:'v1,whsec_'+e.hookKey,key:e.key,ahora:e.now,respaldoManual:true,avisoURL:origen+'/api/plataforma/aviso-codigo',red:async(u,init)=>{avisos.push({u,init});return new Response('{}');}});
 async function pedir(tel='525511111111'){e.avanzar(1);const a=await e.solicitudes.crear('whatsapp',tel,'ip-'+Math.random());const v=e.evento(tel,'482913',{user:{id:ids.nueva,phone:tel}});await codigos.entregar(v.raw,v.headers);return a;}
 const f=(i,q,a=[])=>enTransaccion(e.poolAPI,i,null,async c=>(await c.query(q,a)).rows[0]?.r);
 await codigos.anunciarRespaldo();
 return {...e,sql,codigos,pedir,avisos,enviados,f};
}
test('cifrado: ida y vuelta, alteración detectada y número oculto',()=>{
 const k=randomBytes(32).toString('base64'),c=cifrarCodigo(k,{telefono:'525511112233',codigo:'048213'});
 assert.equal(c.includes('5511112233'),false);assert.equal(c.includes('048213'),false);assert.deepEqual(descifrarCodigo(k,c),{telefono:'525511112233',codigo:'048213'});
 assert.throws(()=>descifrarCodigo(randomBytes(32).toString('base64'),c));const p=c.split('.');p[2]=p[2].slice(0,-2)+(p[2].endsWith('AA')?'BB':'AA');assert.throws(()=>descifrarCodigo(k,p.join('.')));
 assert.equal(telefonoOculto('525511112233'),'+52 551 ••• 33');
 const ts=String(Math.floor(Date.now()/1000));assert.equal(avisoValido(k,ts,firmarAviso(k,ts)),true);assert.equal(avisoValido(k,String(Number(ts)-120),firmarAviso(k,String(Number(ts)-120))),false);assert.equal(avisoValido(k,ts,'0'.repeat(64)),false);
});
test('si WhatsApp no envía: el código queda cifrado, se avisa y la persona puede usarlo',async t=>{
 const e=await entorno(t);const a=await e.pedir();
 const s=(await e.sql('SELECT estado FROM ritmo.acceso_solicitudes WHERE id=$1',[a.id])).rows[0];assert.equal(s.estado,'manual');
 const m=(await e.sql('SELECT * FROM ritmo.codigos_manuales WHERE solicitud_id=$1',[a.id])).rows[0];assert.equal(m.motivo,'desconectado');assert.equal(JSON.stringify(m).includes('482913'),false);assert.equal(JSON.stringify(m).includes('5511111111'),false);
 assert.deepEqual(descifrarCodigo(e.key,m.cifrado),{telefono:'525511111111',codigo:'482913'});
 await new Promise(r=>setTimeout(r,10));assert.equal(e.avisos.length,1);const h=e.avisos[0].init.headers;assert.equal(avisoValido(e.key,h['x-aviso-fecha'],h['x-aviso-firma'],e.now()),true);
 // El código entregado a mano sirve igual que uno enviado por WhatsApp.
 const ok=await e.solicitudes.intento(a.id,a.prueba,'482913');assert.equal(ok.id,a.id);
 // El servicio de WhatsApp solo agrega: no lee lo guardado.
 await assert.rejects(()=>e.plataformaDB.usar(c=>c.query('SELECT * FROM ritmo.codigos_manuales')),x=>x.code==='42501');
});
test('sin respaldo manual se conserva el comportamiento anterior (error y sin guardar)',async t=>{
 const e=await entorno(t);e.codigos.respaldoManual=false;await assert.rejects(()=>e.pedir(),x=>x.status===503);
 assert.equal((await e.sql('SELECT count(*)::int AS n FROM ritmo.codigos_manuales')).rows[0].n,0);
});
test('panel: ver código (queda en bitácora), enviar por WhatsApp al mismo número y marcar entregado; nadie más',async t=>{
 const e=await entorno(t),a=await e.pedir();
 const rutas=rutasPlataforma(e.poolAPI,{verificar:async()=>quien},()=>origen,{key:e.key});let quien=identidad();
 const llamar=async(ruta,{metodo='GET',datos,headers={}}={})=>{const req=Readable.from(datos?[Buffer.from(JSON.stringify(datos))]:[]);req.method=metodo;req.headers={'content-type':'application/json',authorization:'Bearer x',...(metodo==='GET'?{}:{origin:origen}),...headers};let estado=0,cuerpo='';const res={writeHead(s){estado=s;return this;},end(b){cuerpo=b;}};await rutas(req,res,new URL(origen+ruta));return {estado,d:JSON.parse(cuerpo)};};
 // El panel refleja el estado anunciado por el servicio de WhatsApp, no solo la llave del Worker.
 e.codigos.respaldoManual=false;await e.codigos.anunciarRespaldo();assert.equal((await llamar('/api/plataforma/codigos')).d.activo,false);e.codigos.respaldoManual=true;await e.codigos.anunciarRespaldo();
 const lista=(await llamar('/api/plataforma/codigos')).d;assert.equal(lista.activo,true);assert.equal(lista.codigos.length,1);assert.equal(lista.codigos[0].telefono,'+52 551 ••• 11');assert.equal(JSON.stringify(lista).includes('482913'),false);assert.equal('cifrado' in lista.codigos[0],false);
 await assert.rejects(()=>llamar('/api/plataforma/codigos/'+a.id+'/entregado',{metodo:'POST',datos:{}}),x=>x.status===400);
 const v=(await llamar('/api/plataforma/codigos/'+a.id+'/ver',{metodo:'POST',datos:{}})).d;assert.equal(v.codigo,'482913');assert.equal(v.telefono,'+525511111111');assert.match(v.whatsapp,/^https:\/\/wa\.me\/525511111111\?text=Tu%20c%C3%B3digo/);
 await llamar('/api/plataforma/codigos/'+a.id+'/entregado',{metodo:'POST',datos:{}});assert.equal((await llamar('/api/plataforma/codigos')).d.codigos.length,0);
 assert.deepEqual((await e.f(identidad(),'SELECT ritmo.plataforma_bitacora_reciente() AS r')).map(x=>x.accion),['codigo_enviado','ver_codigo']);
 const b=await e.pedir('525522222222');quien=identidad('ajena');await assert.rejects(()=>llamar('/api/plataforma/codigos/'+b.id+'/ver',{metodo:'POST',datos:{}}),x=>x.status===403);await assert.rejects(()=>llamar('/api/plataforma/codigos'),x=>x.status===403);
 quien=identidad('admin','aal1');await assert.rejects(()=>llamar('/api/plataforma/codigos/'+b.id+'/ver',{metodo:'POST',datos:{}}),x=>x.status===403);
 // Vencido: ya no se puede ver.
 quien=identidad();await e.sql("UPDATE ritmo.codigos_manuales SET vence_en=now()-interval '1 minute' WHERE solicitud_id=$1",[b.id]);await assert.rejects(()=>llamar('/api/plataforma/codigos/'+b.id+'/ver',{metodo:'POST',datos:{}}),x=>x.status===400);
});
test('aviso firmado: notifica una sola vez a los celulares del administrador, sin datos sensibles',async t=>{
 const e=await entorno(t),claves=webpush.generateVAPIDKeys(),entregas=[];
 const ecdh=(await import('node:crypto')).createECDH('prime256v1');ecdh.generateKeys();
 const sub={endpoint:'https://web.push.apple.com/prueba-admin',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 await e.sql("INSERT INTO ritmo.push_suscripciones(usuario_id,sesion_id,ambito,negocio_id,endpoint,suscripcion) VALUES($1,$2,'negocio',$3,$4,$5)",[ids.admin,sesiones.admin,ids.salon,sub.endpoint,JSON.stringify(sub)]);
 await e.sql("INSERT INTO ritmo.push_suscripciones(usuario_id,sesion_id,ambito,negocio_id,endpoint,suscripcion) VALUES($1,$2,'negocio',$3,$4,$5)",[ids.ajena,sesiones.ajena,ids.otro,'https://web.push.apple.com/otra',JSON.stringify({...sub,endpoint:'https://web.push.apple.com/otra'})]);
 const rutas=rutasPlataforma(e.poolAPI,{verificar:async()=>{throw new Error('sin identidad');}},()=>origen,{key:e.key,publica:claves.publicKey,privada:claves.privateKey,fetch:async(u,init)=>{entregas.push(u);return new Response(null,{status:201});}});
 const avisar=async(firma,ts=String(Math.floor(Date.now()/1000)))=>{const req=Readable.from([]);req.method='POST';req.headers={'x-aviso-fecha':ts,'x-aviso-firma':firma};let cuerpo='';const res={writeHead(){return this;},end(b){cuerpo=b;}};await rutas(req,res,new URL(origen+'/api/plataforma/aviso-codigo'));return JSON.parse(cuerpo);};
 await assert.rejects(()=>avisar('a'.repeat(64)),x=>x.status===401);
 await e.pedir();const ts=String(Math.floor(Date.now()/1000));
 assert.deepEqual(await avisar(firmarAviso(e.key,ts),ts),{codigos:1,enviados:1});assert.deepEqual(entregas,['https://web.push.apple.com/prueba-admin']);
 assert.deepEqual(await avisar(firmarAviso(e.key,ts),ts),{codigos:0,enviados:0});
});
