import {test} from 'node:test';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {rutasAcceso} from '../build/cuentas/acceso.js';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {entornoLogin,ids,sesiones} from './login-whatsapp-entorno.mjs';
import {telefonoMX} from '../build/cuentas/acceso.js';
import {enTransaccion} from '../build/cuentas/contexto.js';
import {BaileysSoloEnvios} from '../../whatsapp/baileys.mjs';
import {PLATAFORMA,NUMERO_CODIGOS} from '../../whatsapp/plataforma.mjs';
import {CodigosWhatsApp,verificarFirma} from '../../whatsapp/codigos.mjs';
async function entorno(t){const e=await entornoLogin();t.after(()=>e.cerrar());return e;}
test('teléfonos mexicanos: normaliza diez dígitos y rechaza formatos ambiguos o ajenos',()=>{for(const n of ['5511111111','+52 55 1111 1111','525511111111'])assert.equal(telefonoMX(n),'525511111111');for(const n of ['5215511111111','15511111111','abc5511111111','55111'])assert.throws(()=>telefonoMX(n));});
test('hook firmado: texto fijo, código no persistido en claro, duplicados no se reenvían',async t=>{
 const e=await entorno(t),s=await e.solicitudes.crear('whatsapp','525511111111','ip-local'),v=e.evento();await e.codigos.entregar(v.raw,v.headers);await e.codigos.entregar(v.raw,v.headers);
 assert.equal(e.envios.length,1);assert.equal(e.envios[0].n,PLATAFORMA);assert.equal(e.envios[0].texto,'Tu código de Agendappx es *482913*. Vence en 10 minutos. No lo compartas con nadie.');
 const f=(await e.solicitudes.usar(c=>c.query('SELECT * FROM ritmo.acceso_solicitudes WHERE id=$1',[s.id]))).rows[0];assert.equal(f.estado,'enviado');assert.equal(JSON.stringify(f).includes('482913'),false);assert.equal(JSON.stringify(f).includes('525511111111'),false);assert.equal(JSON.stringify(f).includes(s.prueba),false);
 await assert.rejects(()=>e.codigos.entregar(v.raw+' ',v.headers),err=>err.status===401);e.avanzar(301000);assert.throws(()=>verificarFirma(v.raw,v.headers,'v1,whsec_'+e.hookKey,e.now()),err=>err.status===401);
});
test('no envía sin solicitud previa, con firma ajena o mensaje libre',async t=>{
 const e=await entorno(t),v=e.evento();await assert.rejects(()=>e.codigos.entregar(v.raw,v.headers),err=>err.status===403);
 await e.solicitudes.crear('whatsapp','525511111111','ip');await assert.rejects(()=>e.codigos.entregar(v.raw,{}),err=>err.status===401);const libre=e.evento('525511111111','482913',{texto:'arbitrario'});await assert.rejects(()=>e.codigos.entregar(libre.raw,libre.headers),err=>err.status===400);assert.equal(e.envios.length,0);
});
test('máximo cinco intentos, vencimiento diez minutos y prueba privada no adivinable',async t=>{
 const e=await entorno(t),s=await e.solicitudes.crear('whatsapp','525511111111','ip'),v=e.evento();await e.codigos.entregar(v.raw,v.headers);
 await assert.rejects(()=>e.solicitudes.intento(s.id,'a'.repeat(64),'482913'));for(let i=0;i<5;i++)await assert.rejects(()=>e.solicitudes.intento(s.id,s.prueba,'000000'));
 await assert.rejects(()=>e.solicitudes.intento(s.id,s.prueba,'482913'));
 const b=await e.solicitudes.crear('whatsapp','525522222222','ip'),w=e.evento('525522222222');await e.codigos.entregar(w.raw,w.headers);e.avanzar(600000);await assert.rejects(()=>e.solicitudes.intento(b.id,b.prueba,'482913'));
});
test('límites durables: tres códigos por teléfono en 15 minutos y diez por IP por hora',async t=>{
 const e=await entorno(t);for(let i=0;i<3;i++)await e.solicitudes.crear('whatsapp','525511111111','ip');await assert.rejects(()=>e.solicitudes.crear('whatsapp','525511111111','otra-ip'),err=>err.status===429);
 for(let i=0;i<7;i++)await e.solicitudes.crear('whatsapp','52552222222'+i,'ip');await assert.rejects(()=>e.solicitudes.crear('whatsapp','525533333333','ip'),err=>err.status===429);
 e.avanzar(3600001);await e.solicitudes.crear('whatsapp','525511111111','ip');
});
test('desconexión ofrece error y envío incierto no se repite ni después de reiniciar',async t=>{
 const e=await entorno(t),s=await e.solicitudes.crear('whatsapp','525511111111','ip'),v=e.evento();e.remoto.enviar=async()=>{throw new Error('No se conoce el resultado de la red');};await assert.rejects(()=>e.codigos.entregar(v.raw,v.headers),err=>err.status===503);
 const segundo=new CodigosWhatsApp(e.plataformaDB,e.remoto,{habilitado:true,hookSecret:'whsec_'+e.hookKey,key:e.key,ahora:e.now});await assert.rejects(()=>segundo.entregar(v.raw,v.headers));assert.equal((await e.solicitudes.usar(c=>c.query('SELECT estado FROM ritmo.acceso_solicitudes WHERE id=$1',[s.id]))).rows[0].estado,'incierto');
 const a=await e.solicitudes.crear('whatsapp','525522222222','ip');e.remoto.estado=async()=>({verificado:false});const w=e.evento('525522222222');await assert.rejects(()=>segundo.entregar(w.raw,w.headers));assert.equal((await e.solicitudes.usar(c=>c.query('SELECT estado FROM ritmo.acceso_solicitudes WHERE id=$1',[a.id]))).rows[0].estado,'fallido');
});
test('bloqueo de WhatsApp frena la plataforma; no mezcla el estado de los salones',async t=>{
 const e=await entorno(t);await e.plataformaDB.tx(c=>e.plataformaDB.prepararConexion(PLATAFORMA,c));e.remoto.enviar=async()=>{throw Object.assign(new Error(),{status:429});};await e.solicitudes.crear('whatsapp','525511111111','ip');const v=e.evento();await assert.rejects(()=>e.codigos.entregar(v.raw,v.headers));assert.equal((await e.plataformaDB.usar(c=>c.query('SELECT freno FROM ritmo.plataforma_conexiones'))).rows[0].freno,true);assert.equal((await e.db.usar(c=>c.query('SELECT * FROM ritmo.whatsapp_conexiones'))).rows.length,0);
});
test('nuevas sesiones directas de Auth no saltan el control de intentos de Agendappx',async t=>{
 const e=await entorno(t),sid=randomUUID();await e.pool.connect().then(async c=>{try{await c.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[sid,ids.admin]);}finally{c.release();}});
 const i={usuarioId:ids.admin,sesionId:sid,aal:'aal2'};await assert.rejects(()=>enTransaccion(e.poolAPI,i,ids.salon,c=>c.query('SELECT 1')),err=>err.status===401);await e.solicitudes.admitir(i);assert.ok(await enTransaccion(e.poolAPI,i,ids.salon,c=>c.query('SELECT 1')));
 // La sesión previa y el historial existente siguen vigentes.
 assert.ok(await enTransaccion(e.poolAPI,{...i,sesionId:sesiones.admin},ids.salon,c=>c.query('SELECT 1')));
});
test('rol del salón no lee sesión de plataforma; emisor no concede sesiones de acceso',async t=>{
 const e=await entorno(t);await assert.rejects(()=>e.solicitudes.usar(c=>c.query('SELECT * FROM ritmo.plataforma_sesiones')),/permission denied/);await assert.rejects(()=>e.plataformaDB.usar(c=>c.query('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2)',[randomUUID(),ids.admin])),/permission denied/);
});
test('plataforma conserva claves cifradas y recupera sin tocar conexiones de salón',async t=>{
 const e=await entorno(t),key=randomBytes(32).toString('base64'),fabrica=o=>{const ev=new EventEmitter();setTimeout(()=>ev.emit('connection.update',{qr:'solo-señal-local'}),0);return {ev,user:{id:NUMERO_CODIGOS+'@s.whatsapp.net'},ws:{isOpen:true},async requestPairingCode(){return 'ABCD1234';},end(){},async sendMessage(_n,_m,op){return {key:{id:op.messageId}};}};};
 const a=new BaileysSoloEnvios(e.plataformaDB,key,{fabrica,vincular:true});t.after(()=>a.cerrar());assert.equal(await a.codigo(PLATAFORMA,NUMERO_CODIGOS),'ABCD1234');const x=a.conexiones.get(PLATAFORMA);x.auth.creds.registered=true;x.auth.creds.me={id:NUMERO_CODIGOS+'@s.whatsapp.net'};await x.store.guardar('credenciales','principal',x.auth.creds);await a.cambio(PLATAFORMA,x,{connection:'open'});assert.equal((await a.estado(PLATAFORMA)).verificado,true);await a.cerrar();
 const b=new BaileysSoloEnvios(e.plataformaDB,key,{fabrica});t.after(()=>b.cerrar());await b.restaurar(PLATAFORMA);assert.equal(b.conexiones.get(PLATAFORMA).auth.creds.registered,true);await assert.rejects(()=>b.codigo(PLATAFORMA,NUMERO_CODIGOS),err=>err.status===503);const apagado=new CodigosWhatsApp(e.plataformaDB,b,{habilitado:false});await assert.rejects(()=>apagado.entregar('{}',{}),err=>err.status===503);assert.equal((await e.db.usar(c=>c.query('SELECT * FROM ritmo.whatsapp_sesiones'))).rows.length,0);
});

test('los códigos tienen prioridad sobre citas antes y después de escribir, sin consumir su cuota',async t=>{
 const e=await entorno(t);await e.iniciar();await e.cita();await e.cola.reconciliar(ids.salon);e.cola.politica.codigosPendientes=()=>true;assert.equal(await e.cola.enviarUno(ids.salon),false);assert.equal(e.llamadas.length,0);
 e.cola.politica.codigosPendientes=()=>false;e.cola.dormir=async()=>{e.cola.politica.codigosPendientes=()=>true;};assert.equal(await e.cola.enviarUno(ids.salon),true);assert.equal(e.llamadas.filter(v=>v[0]==='envio').length,0);assert.equal((await e.db.usar(c=>c.query("SELECT motivo FROM ritmo.whatsapp_envios WHERE tipo='inicio'"))).rows[0].motivo,'prioridad_codigo');
});
test('solicitudes simultáneas no eluden el límite y un hook no confirma dos envíos concurrentes',async t=>{
 const e=await entorno(t);const r=await Promise.allSettled(Array.from({length:5},()=>e.solicitudes.crear('whatsapp','525511111111','ip')));assert.equal(r.filter(x=>x.status==='fulfilled').length,3);
 const v=e.evento();let seguir;const esperando=new Promise(r=>{seguir=r;});e.remoto.enviar=async()=>{await esperando;return 'aceptado';};const primero=e.codigos.entregar(v.raw,v.headers);await assert.rejects(()=>e.codigos.entregar(v.raw,v.headers),err=>err.status===503);seguir();await primero;
});

test('API rechaza origen ajeno, recuperación no registrada y altas abiertas; usa solo llave publicable',async t=>{
 const e=await entorno(t),llamadas=[];const config={habilitado:true,correo:false,key:e.key,origen:'https://agendappx.test',supabaseURL:'https://zkqwephmuflbuagevvxj.supabase.co',llavePublica:'sb_publishable_pruebas',salones:new Set([ids.salon]),ip:()=> 'ip-http',fetch:async(url,init)=>{llamadas.push({url,init});return Response.json({});}};
 const jwt={verificar:async()=>{throw new Error('No hay sesión de usuario en esta prueba');}},rutas=rutasAcceso(e.poolAPI,jwt,config);
 const server=createServer(async(req,res)=>{try{if(!await rutas(req,res,new URL(req.url,'http://localhost')))res.writeHead(404).end();}catch(e){res.writeHead(e.status||503,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message}));}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));const url='http://127.0.0.1:'+server.address().port;
 const pedir=(path,body,origin=config.origen)=>fetch(url+'/api/acceso/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await pedir('solicitar',{canal:'whatsapp',destino:'5511111111'},'https://ajena.test')).status,403);
 assert.equal((await pedir('privado',{token_hash:'a'.repeat(64)})).status,400);assert.equal(llamadas.length,0);
 assert.equal((await pedir('solicitar',{canal:'correo',destino:'admin@example.test'})).status,503);
 const r=await pedir('solicitar',{canal:'whatsapp',destino:'5511111111',create_user:true,rol:'admin'});assert.equal(r.status,200);assert.equal(llamadas.length,1);const d=JSON.parse(llamadas[0].init.body);assert.equal(d.create_user,false);assert.equal(d.rol,undefined);assert.equal(llamadas[0].init.headers.apikey,'sb_publishable_pruebas');assert.equal(llamadas[0].init.headers.Authorization,undefined);
 assert.throws(()=>rutasAcceso(e.poolAPI,jwt,{...config,llavePublica:'sb_secret_prohibida'}));
});


test('prueba de un solo código: mismo usuario, phone_change, plazo y bloqueo durable incluso tras reiniciar',async t=>{
 const e=await entorno(t),tel='525511111111',prueba={usuario:ids.admin,destino:tel,desde:e.now()-1,hasta:e.now()+600000};
 const crear=()=>new CodigosWhatsApp(e.plataformaDB,e.remoto,{habilitado:true,hookSecret:'v1,whsec_'+e.hookKey,key:e.key,ahora:e.now,prueba});
 await e.solicitudes.crear('whatsapp',tel,'ip-prueba',ids.admin);const v=e.evento(tel);const a=crear();await a.entregar(v.raw,v.headers);await a.entregar(v.raw,v.headers);assert.equal(e.envios.length,1);
 await e.solicitudes.crear('whatsapp',tel,'ip-segunda',ids.admin);const otro=e.evento(tel);await assert.rejects(()=>crear().entregar(otro.raw,otro.headers),err=>err.status===403);assert.equal(e.envios.length,1);
});

test('prueba restringida rechaza otro destino, otro usuario, login normal y horario vencido antes de enviar',async t=>{
 const e=await entorno(t),tel='525511111111',prueba={usuario:ids.admin,destino:tel,desde:e.now()-1,hasta:e.now()+600000};
 const a=new CodigosWhatsApp(e.plataformaDB,e.remoto,{habilitado:true,hookSecret:'v1,whsec_'+e.hookKey,key:e.key,ahora:e.now,prueba});
 for(const v of [e.evento('525522222222'),e.evento(tel,'482913',{user:{id:ids.especialista,phone:tel}})])await assert.rejects(()=>a.entregar(v.raw,v.headers),err=>err.status===403);
 await e.solicitudes.crear('whatsapp',tel,'ip-login-normal');const v=e.evento(tel);await assert.rejects(()=>a.entregar(v.raw,v.headers),err=>err.status===403);e.avanzar(600001);const vencido=e.evento(tel);await assert.rejects(()=>a.entregar(vencido.raw,vencido.headers),err=>err.status===403);assert.equal(e.envios.length,0);
});

test('prueba incierta no permite un segundo envío ni reutiliza solicitudes anteriores a la autorización',async t=>{
 const e=await entorno(t),tel='525511111111';await e.solicitudes.crear('whatsapp',tel,'ip-antes',ids.admin);e.avanzar(1);const prueba={usuario:ids.admin,destino:tel,desde:e.now(),hasta:e.now()+600000};
 const crear=()=>new CodigosWhatsApp(e.plataformaDB,e.remoto,{habilitado:true,hookSecret:'v1,whsec_'+e.hookKey,key:e.key,ahora:e.now,prueba});const anterior=e.evento(tel);await assert.rejects(()=>crear().entregar(anterior.raw,anterior.headers),err=>err.status===403);
 e.avanzar(1);await e.solicitudes.crear('whatsapp',tel,'ip-actual',ids.admin);e.remoto.enviar=async()=>{e.envios.push('incierto');throw new Error('respuesta perdida');};const v=e.evento(tel);await assert.rejects(()=>crear().entregar(v.raw,v.headers),err=>err.status===503);
 e.avanzar(1);await e.solicitudes.crear('whatsapp',tel,'ip-segunda',ids.admin);const segundo=e.evento(tel);await assert.rejects(()=>crear().entregar(segundo.raw,segundo.headers),err=>err.status===403);assert.equal(e.envios.length,1);
});


for(const formato of ['sesion_nueva','solo_usuario','sesion_ajena'])test('phone_change conserva sesión MFA y no sustituye tokens: '+formato,async t=>{
 const e=await entorno(t),tel='525511111111',nueva=randomUUID();await e.pool.connect().then(async c=>{try{await c.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[nueva,ids.admin]);}finally{c.release();}});
 const s=await e.solicitudes.crear('whatsapp',tel,'ip-phone-change',ids.admin),v=e.evento(tel);await e.codigos.entregar(v.raw,v.headers);
 const jwt={verificar:async token=>token==='anterior'?{usuarioId:ids.admin,sesionId:sesiones.admin,aal:'aal2'}:{usuarioId:formato==='sesion_ajena'?ids.ajena:ids.admin,sesionId:nueva,aal:'aal1'}};
 const config={habilitado:true,correo:false,key:e.key,origen:'https://agendappx.test',supabaseURL:'https://zkqwephmuflbuagevvxj.supabase.co',llavePublica:'sb_publishable_prueba_local',salones:new Set([ids.salon]),ip:()=> 'ip-local',fetch:async(url,init)=>{assert.match(url,/auth\/v1\/verify$/);assert.equal(init.headers.Authorization,'Bearer anterior');assert.equal(JSON.parse(init.body).type,'phone_change');return Response.json({user:{id:ids.admin,phone:tel},...(formato==='solo_usuario'?{}:{access_token:'nueva',refresh_token:'solo-transporte-simulado',expires_in:3600})});}};
 const rutas=rutasAcceso(e.poolAPI,jwt,config),server=createServer(async(req,res)=>{try{await rutas(req,res,new URL(req.url,'http://localhost'));}catch(err){res.writeHead(err.status||503,{'Content-Type':'application/json'}).end(JSON.stringify({error:err.message}));}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/acceso/verificar',{method:'POST',headers:{Origin:config.origen,Authorization:'Bearer anterior','Content-Type':'application/json'},body:JSON.stringify({id:s.id,prueba:s.prueba,destino:tel,codigo:'482913'})}),body=await response.json();assert.equal(response.status,formato==='sesion_ajena'?403:200);
 if(formato!=='sesion_ajena'){assert.equal(body.user.id,ids.admin);assert.equal(body.user.phone,tel);assert.equal(body.access_token,undefined);assert.equal(body.refresh_token,undefined);}
 assert.equal(Number((await e.solicitudes.usar(c=>c.query('SELECT count(*) AS n FROM ritmo.acceso_sesiones WHERE sesion_id=$1',[nueva]))).rows[0].n),0);
 assert.ok(await enTransaccion(e.poolAPI,{usuarioId:ids.admin,sesionId:sesiones.admin,aal:'aal2'},ids.salon,c=>c.query('SELECT 1')));
});
