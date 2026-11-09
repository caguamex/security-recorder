import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {entornoLogin,ids,sesiones} from './login-whatsapp-entorno.mjs';
import {RegistroWhatsApp,rutasRegistro} from '../build/cuentas/registro.js';
import {Invitaciones} from '../build/cuentas/invitaciones.js';
import {enTransaccion} from '../build/cuentas/contexto.js';
import {RepositorioConCuentas} from '../build/cuentas/repositorio.js';
import {configurar} from '../../whatsapp/config.mjs';
import {CodigosWhatsApp} from '../../whatsapp/codigos.mjs';
import {intermediario} from '../../supabase/functions/agendappx-registro/intermediario.mjs';
const origen='https://agendappx.test',url='https://zkqwephmuflbuagevvxj.supabase.co';
const identidad=(u='nueva',aal='aal2')=>({usuarioId:ids[u],sesionId:sesiones[u],aal});
async function entorno(t){const e=await entornoLogin();t.after(()=>e.cerrar());const sql=async(q,args)=>{const c=await e.pool.connect();try{return await c.query(q,args);}finally{c.release();}};await sql(await readFile(new URL('../../supabase/migrations/20261029174619_registro_whatsapp.sql',import.meta.url),'utf8'));
 const operacionKey=randomBytes(32).toString('base64'),creaciones=[];let captcha=true,usuario={id:ids.nueva,phone:'525511111111',phone_confirmed_at:new Date().toISOString()};
 const edge=intermediario({key:operacionKey,url,adminKey:'admin-solo-prueba',fetch:async(u,init)=>{assert.equal(u,url+'/auth/v1/admin/users');const d=JSON.parse(init.body);assert.deepEqual(Object.keys(d).sort(),['phone','phone_confirm']);assert.equal(d.phone_confirm,false);creaciones.push(d);return Response.json({id:ids.nueva});}});
 const red=async(u,init)=>{if(u.endsWith('/siteverify'))return Response.json({success:captcha,hostname:'agendappx.test',action:'registro'});if(u.endsWith('/agendappx-registro'))return edge(new Request(u,init));if(u.endsWith('/auth/v1/user'))return Response.json(usuario);throw new Error('Red inesperada');};
 const config={habilitado:true,key:e.key,operacionKey,turnstileKey:'secreto-local',turnstileSiteKey:'sitio-local',origen,supabaseURL:url,llavePublica:'sb_publishable_prueba',ip:()=> 'ip-local',fetch:red,ahora:e.now};
 const registro=new RegistroWhatsApp(e.poolAPI,config);
 async function probarCodigo(ticket){e.avanzar(1);const a=await e.solicitudes.crear('whatsapp','525511111111','ip-codigo-'+randomUUID()),v=e.evento('525511111111','482913',{user:{id:ids.nueva,phone:'525511111111'}});await e.codigos.entregar(v.raw,v.headers);await e.solicitudes.intento(a.id,a.prueba,'482913');await sql('DELETE FROM ritmo.acceso_sesiones WHERE sesion_id=$1',[sesiones.nueva]);await e.solicitudes.admitir(identidad(),a.id);await e.solicitudes.resultado(a.id,true);}
 return {...e,sql,probarCodigo,registro,config,creaciones,setCaptcha(v){captcha=v;},setUsuario(v){usuario=v;},datos:{nombre:'Mariana',telefono:'5511111111',salon:'Salón Mariana',slug:'salon-mariana',consentimiento:true,captchaToken:'captcha-local'}};
}
test('registro de salón: CAPTCHA, OTP y MFA antes de crear una agenda vacía e independiente',async t=>{
 const e=await entorno(t),antes=(await e.sql('SELECT count(*) AS n FROM ritmo.negocios')).rows[0].n;
 e.setCaptcha(false);await assert.rejects(()=>e.registro.crear(e.datos,'ip'),x=>x.status===400);assert.equal(e.creaciones.length,0);e.setCaptcha(true);
 const ticket=await e.registro.crear(e.datos,'ip');assert.equal(ticket.rol,'admin');assert.equal(e.creaciones.length,1);assert.equal((await e.sql('SELECT count(*) AS n FROM ritmo.negocios')).rows[0].n,antes);
 await assert.rejects(()=>e.registro.finalizar(identidad(),ticket));await e.probarCodigo(ticket);await e.registro.verificar(identidad('nueva','aal1'),'sesion-simulada',ticket);
 await assert.rejects(()=>e.registro.finalizar(identidad('nueva','aal1'),ticket),x=>x.status===403);
 const r=await e.registro.finalizar(identidad(),ticket);assert.notEqual(r.negocioId,ids.salon);assert.equal((await e.registro.finalizar(identidad(),ticket)).negocioId,r.negocioId);
 const snapshot=await new RepositorioConCuentas(e.poolAPI,identidad(),r.negocioId).snapshot();assert.equal(snapshot.records.length,1);assert.equal(snapshot.records[0].id,'__settings');assert.equal(snapshot.records[0].data.negocio,'Salón Mariana');assert.equal(snapshot.records[0].data.examplesOff,true);
 await assert.rejects(()=>new RepositorioConCuentas(e.poolAPI,identidad(),ids.salon).snapshot());
 const propios=await enTransaccion(e.poolAPI,identidad(),null,async c=>(await c.query('SELECT * FROM ritmo.mis_negocios()')).rows);assert.deepEqual(propios.map(x=>x.negocio_id),[r.negocioId]);
 const guardado=(await e.sql('SELECT * FROM ritmo.registro_solicitudes WHERE id=$1',[ticket.id])).rows[0];assert.equal(JSON.stringify(guardado).includes('5511111111'),false);assert.equal(JSON.stringify(guardado).includes(ticket.prueba),false);
});
test('invitación: dos administradoras comparten promociones, uso único y revocación inmediata',async t=>{
 const e=await entorno(t),inv=new Invitaciones(e.poolAPI),creada=await inv.crear(identidad('admin'),ids.salon,{nombre:'Mariana',rol:'admin',servicios:[],horario:{}});
 const ticket=await e.registro.crear({...e.datos,invitacion:creada.codigo},'ip-invitada');await e.probarCodigo(ticket);await e.registro.verificar(identidad(),'sesion-simulada',ticket);
 await assert.rejects(()=>e.registro.finalizar(identidad('nueva','aal1'),ticket),x=>x.status===403);
 const r=await e.registro.finalizar(identidad(),ticket);assert.equal(r.negocioId,ids.salon);
 const repo=new RepositorioConCuentas(e.poolAPI,identidad('admin'),ids.salon);await repo.cambiar({id:'promo-compartida',baseVersion:0,mutationId:'registro-promocion-uno',data:{id:'promo-compartida',kind:'promo',titulo:'Promoción real compartida',texto:'Mismo salón'}});
 assert.ok((await new RepositorioConCuentas(e.poolAPI,identidad(),ids.salon).snapshot()).records.some(x=>x.id==='promo-compartida'));
 await assert.rejects(()=>e.registro.crear({...e.datos,invitacion:creada.codigo},'ip-segunda'),x=>x.status===404);
 await enTransaccion(e.poolAPI,identidad('admin'),ids.salon,c=>c.query('UPDATE ritmo.miembros SET activo=false WHERE negocio_id=$1 AND usuario_id=$2',[ids.salon,ids.nueva]));
 await assert.rejects(()=>new RepositorioConCuentas(e.poolAPI,identidad(),ids.salon).snapshot());
});
test('registro: teléfono ajeno, token de ticket ajeno y sesión no admitida no conceden membresía',async t=>{
 const e=await entorno(t),ticket=await e.registro.crear(e.datos,'ip');
 e.setUsuario({id:ids.nueva,phone:'525522222222',phone_confirmed_at:new Date().toISOString()});await assert.rejects(()=>e.registro.verificar(identidad(),'token',ticket),x=>x.status===403);
 e.setUsuario({id:ids.nueva,phone:'525511111111'});await assert.rejects(()=>e.registro.verificar(identidad(),'token',ticket),x=>x.status===403);
 await assert.rejects(()=>e.registro.ticket(ticket.id,'a'.repeat(64)),x=>x.status===400);
 e.setUsuario({id:ids.nueva,phone:'525511111111',phone_confirmed_at:new Date().toISOString()});await e.sql('DELETE FROM ritmo.acceso_sesiones WHERE sesion_id=$1',[sesiones.nueva]);
 await assert.rejects(()=>e.registro.verificar(identidad(),'token',ticket),x=>x.status===401);assert.equal((await e.sql('SELECT count(*) AS n FROM ritmo.miembros WHERE usuario_id=$1',[ids.nueva])).rows[0].n,0);
});
test('registro: límites durables, consentimiento, slug reservado y caducidad',async t=>{
 const e=await entorno(t);await assert.rejects(()=>e.registro.crear({...e.datos,consentimiento:false},'ip'),x=>x.status===400);await assert.rejects(()=>e.registro.crear({...e.datos,slug:'comunidad'},'ip'),x=>x.status===400);
 let ticket;for(let i=0;i<3;i++)ticket=await e.registro.crear(e.datos,'misma-ip');await assert.rejects(()=>e.registro.crear(e.datos,'misma-ip'),x=>x.status===429);
 await e.sql("UPDATE ritmo.registro_solicitudes SET vence_en=now()-interval '1 second' WHERE id=$1",[ticket.id]);await assert.rejects(()=>e.registro.ticket(ticket.id,ticket.prueba),x=>x.status===400);
});
test('intermediario: firma y caducidad obligatorias, no modifica ni confirma cuentas existentes',async()=>{
 const key=randomBytes(32).toString('base64'),ahora=Date.now(),llamadas=[];
 let respuestaAuth={code:422,error_code:'phone_exists',msg:'Phone number already registered by another user'};
 const edge=intermediario({key,url,adminKey:'privada-prueba',ahora:()=>ahora,fetch:async(u,init)=>{llamadas.push(init);return Response.json(respuestaAuth,{status:422});}});
 const raw=JSON.stringify({id:randomUUID(),phone:'+525511111111'}),ts=String(Math.floor(ahora/1000));const firma=createHmac('sha256',Buffer.from(key,'base64')).update('alta-whatsapp-v1\0'+ts+'\0'+raw).digest('hex');
 const req=(f=firma,fecha=ts,body=raw)=>new Request('https://local.test/registro',{method:'POST',headers:{'Content-Type':'application/json','x-registro-fecha':fecha,'x-registro-firma':f},body});
 assert.equal((await edge(req('a'.repeat(64)))).status,401);assert.equal(llamadas.length,0);assert.equal((await edge(req(firma,String(Number(ts)-61)))).status,401);
 const r=await edge(req());assert.equal(r.status,200);assert.equal(JSON.stringify(await r.json()).includes('privada'),false);assert.deepEqual(JSON.parse(llamadas[0].body),{phone:'+525511111111',phone_confirm:false});
 for(const [datos,esperado] of [[{code:422,error_code:'user_already_exists'},200],[{code:'phone_exists'},200],[{code:422,error_code:'validation_failed'},503],[{code:422},503]]){
  respuestaAuth=datos;assert.equal((await edge(req())).status,esperado);
 }
 assert.equal(llamadas.every(x=>x.method==='POST'),true,'No modifica ni confirma la identidad existente');
});
test('modo de cuentas: códigos normales admitidos, duplicados no enviados y límite global durable',async t=>{
 const e=await entorno(t),codigos=()=>new CodigosWhatsApp(e.plataformaDB,e.remoto,{modo:'cuentas',habilitado:true,hookSecret:'v1,whsec_'+e.hookKey,key:e.key,ahora:e.now});
 const a=codigos();await e.solicitudes.crear('whatsapp','525511111111','ip');const v=e.evento();await a.entregar(v.raw,v.headers);await a.entregar(v.raw,v.headers);assert.equal(e.envios.length,1);
 for(let j=0;j<29;j++){e.avanzar(1);const tel='52553333'+String(j).padStart(4,'0');await e.solicitudes.crear('whatsapp',tel,'ip-'+j);const w=e.evento(tel);await codigos().entregar(w.raw,w.headers);}
 const tel='525599999999';await e.solicitudes.crear('whatsapp',tel,'ip-limite');const w=e.evento(tel);await assert.rejects(()=>codigos().entregar(w.raw,w.headers),x=>x.status===503);assert.equal(e.envios.length,30);
});

test('configuración: cuentas requiere modo explícito y mantiene citas y vinculación apagadas',()=>{
 const env={WA_ACTIVAR_SERVICIO:'true',SUPABASE_URL:url,PUBLIC_URL:origen+'/',DATABASE_URL:'postgresql://agendappx_whatsapp:prueba@db.zkqwephmuflbuagevvxj.supabase.co/postgres',WHATSAPP_SALONES_HABILITADOS:ids.salon,WA_NUMERO_CODIGOS:'528661241483',WA_CODIGOS_HABILITADOS:'true',WA_CODIGOS_HOOK_SECRET:'solo-prueba',ACCESO_HMAC_KEY:'solo-prueba'};
 assert.throws(()=>configurar(env),/único código/);const c=configurar({...env,WA_CODIGOS_MODO:'cuentas'});assert.equal(c.codigos.modo,'cuentas');assert.equal(c.codigos.prueba,undefined);assert.equal(c.codigos.vincular,false);assert.equal(c.politica.envios,false);assert.equal(c.politica.vincular,false);assert.throws(()=>configurar({...env,WA_CODIGOS_MODO:'libre'}));
});
test('invitación revocada después del código no concede membresía y un slug concurrente no deja salones huérfanos',async t=>{
 const e=await entorno(t),inv=new Invitaciones(e.poolAPI),creada=await inv.crear(identidad('admin'),ids.salon,{nombre:'Mariana',rol:'admin',servicios:[],horario:{}});
 const ticket=await e.registro.crear({...e.datos,invitacion:creada.codigo},'ip-invitacion');await e.probarCodigo(ticket);await e.registro.verificar(identidad(),'token',ticket);await e.sql('UPDATE ritmo.invitaciones SET revocada_en=now() WHERE id=$1',[creada.id]);await assert.rejects(()=>e.registro.finalizar(identidad(),ticket),x=>x.status===400);
 assert.equal((await e.sql('SELECT count(*) AS n FROM ritmo.miembros WHERE usuario_id=$1 AND negocio_id=$2',[ids.nueva,ids.salon])).rows[0].n,0);
 const a=await e.registro.crear(e.datos,'ip-a'),b=await e.registro.crear(e.datos,'ip-b');await e.probarCodigo(a);await e.registro.verificar(identidad(),'token',a);await e.probarCodigo(b);await e.registro.verificar(identidad(),'token',b);const antes=(await e.sql('SELECT count(*) AS n FROM ritmo.negocios')).rows[0].n;await e.registro.finalizar(identidad(),a);await assert.rejects(()=>e.registro.finalizar(identidad(),b),x=>x.status===409);assert.equal((await e.sql('SELECT count(*) AS n FROM ritmo.negocios')).rows[0].n,antes+1);
});
test('tablas y funciones de registro no están expuestas a anon/authenticated ni al mensajero',async t=>{
 const e=await entorno(t);for(const rol of ['anon','authenticated','agendappx_whatsapp'])for(const tabla of ['registro_solicitudes','negocios_enlaces'])assert.equal((await e.sql('SELECT has_table_privilege($1,$2,\'SELECT\') AS ok',[rol,'ritmo.'+tabla])).rows[0].ok,false);
 for(const f of ['ritmo.mis_negocios()','ritmo.finalizar_registro(uuid,text)'])for(const rol of ['anon','authenticated','agendappx_whatsapp'])assert.equal((await e.sql('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS ok',[rol,f])).rows[0].ok,false);
});

test('registro: una sesión antigua o recuperada no sustituye el código nuevo del registro',async t=>{
 const e=await entorno(t),ticket=await e.registro.crear(e.datos,'ip');await assert.rejects(()=>e.registro.verificar(identidad(),'token',ticket),x=>x.status===403);assert.equal((await e.sql('SELECT count(*) AS n FROM ritmo.miembros WHERE usuario_id=$1',[ids.nueva])).rows[0].n,0);
});


test('Asignaciones de equipo: solo Admin con MFA, servicios del salón y revocación inmediata',async t=>{
 const e=await entorno(t);await new RepositorioConCuentas(e.poolAPI,identidad('admin'),ids.salon).cambiar({id:'cejas-asignada',baseVersion:0,mutationId:randomUUID(),data:{id:'cejas-asignada',kind:'servicio',nombre:'Cejas',precio:300,duracion:30}});
 let actor=identidad('admin');const rutas=rutasRegistro(e.poolAPI,{verificar:async()=>actor},e.config);
 async function cambiar(data,persona=ids.especialista,n=ids.salon){const req={method:'PATCH',headers:{origin:origen,authorization:'Bearer prueba','content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data));}},res={writeHead(){return this;},end(){}};await rutas(req,res,new URL('/api/negocios/'+n+'/miembros/'+persona,origen));}
 await cambiar({servicios:['cejas-asignada'],verTodas:true});assert.deepEqual((await e.sql('SELECT servicios,ver_todas FROM ritmo.miembros WHERE negocio_id=$1 AND usuario_id=$2',[ids.salon,ids.especialista])).rows[0],{servicios:['cejas-asignada'],ver_todas:true});
 await assert.rejects(()=>cambiar({servicios:['otro-salon'],verTodas:false}),x=>x.status===400);await assert.rejects(()=>cambiar({servicios:[],verTodas:false,rol:'admin'}),x=>x.status===400);
 actor=identidad('recepcion','aal1');await assert.rejects(()=>cambiar({servicios:[],verTodas:false}),x=>x.status===403);actor=identidad('especialista','aal2');await assert.rejects(()=>cambiar({servicios:[],verTodas:false}),x=>x.status===403);actor=identidad('ajena');await assert.rejects(()=>cambiar({servicios:[],verTodas:false}),x=>x.status===403);
});
