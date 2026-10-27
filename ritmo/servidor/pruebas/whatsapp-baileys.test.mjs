import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {preparar,ids} from './whatsapp-solo-envios-entorno.mjs';
import {BaileysSoloEnvios,SesionesCifradas,OPCIONES_PRIVADAS} from '../../whatsapp/baileys.mjs';
import {configurar} from '../../whatsapp/config.mjs';
const n=ids.salon,esperar=()=>new Promise(r=>setTimeout(r,5));
function simular(){const sockets=[],opciones=[];let leidos=0;return {sockets,opciones,get leidos(){return leidos;},fabrica(o){opciones.push(o);const ev=new EventEmitter(),s={ev,user:{id:'525511111111:2@s.whatsapp.net'},ws:{isOpen:true},async requestPairingCode(){return 'ABCD1234';},async sendPresenceUpdate(){},async sendMessage(_a,_b,op){return {key:{id:op.messageId}};},async readMessages(){leidos++;},end(){},async logout(){}};sockets.push(s);return s;}};}
async function entorno(t){const e=await preparar();t.after(()=>e.cerrar());await e.iniciar();return e;}
test('solo conexión/credenciales: descarta entradas e historial y nunca marca leído',async t=>{
 const e=await entorno(t),f=simular(),a=new BaileysSoloEnvios(e.db,randomBytes(32).toString('base64'),{fabrica:f.fabrica,vincular:true});t.after(()=>a.cerrar());
 assert.equal(await a.codigo(n,'525511111111'),'ABCD1234');const s=f.sockets[0];assert.deepEqual(s.ev.eventNames().sort(),['connection.update','creds.update']);
 const antes=(await e.db.usar(c=>c.query('SELECT * FROM ritmo.whatsapp_envios'))).rows;
 s.ev.emit('messages.upsert',{messages:[{key:{remoteJid:'525500000000@s.whatsapp.net'},message:{conversation:'contenido entrante privado'}}]});s.ev.emit('messaging-history.set',{chats:[{id:'privado'}],contacts:[{name:'persona'}],messages:[]});await esperar();
 assert.equal(f.leidos,0);assert.deepEqual((await e.db.usar(c=>c.query('SELECT * FROM ritmo.whatsapp_envios'))).rows,antes);assert.equal(OPCIONES_PRIVADAS.shouldIgnoreJid('525500000000@s.whatsapp.net'),true);assert.equal(OPCIONES_PRIVADAS.shouldSyncHistoryMessage({}),false);assert.equal(OPCIONES_PRIVADAS.markOnlineOnConnect,false);
 const upstream=await readFile(new URL('../../whatsapp/node_modules/baileys/lib/Socket/messages-recv.js',import.meta.url),'utf8');assert.match(upstream,/shouldIgnoreJid/);assert.match(upstream,/NACK_REASONS\.UnhandledError/);
});
test('reinicio conserva credenciales y claves Signal cifradas; recuperación no pide otro código',async t=>{
 const e=await entorno(t),key=randomBytes(32).toString('base64'),f=simular();const a=new BaileysSoloEnvios(e.db,key,{fabrica:f.fabrica,vincular:true});t.after(()=>a.cerrar());
 await a.codigo(n,'525511111111');const x=a.conexiones.get(n);x.auth.creds.registered=true;x.auth.creds.me={id:'525511111111@s.whatsapp.net'};await x.store.guardar('credenciales','principal',x.auth.creds);await x.auth.keys.set({'session':{'peer-privado':{key:Buffer.from('valor secreto')}}});await a.cambio(n,x,{connection:'open'});assert.equal((await a.estado(n)).verificado,true);
 const guardado=(await e.db.usar(c=>c.query('SELECT llave,cifrado FROM ritmo.whatsapp_sesiones'))).rows;assert.equal(JSON.stringify(guardado).includes('peer-privado'),false);assert.equal(JSON.stringify(guardado).includes('valor secreto'),false);assert.equal(JSON.stringify(guardado).includes('525511111111'),false);
 await a.cerrar();const g=simular(),b=new BaileysSoloEnvios(e.db,key,{fabrica:g.fabrica,vincular:false});t.after(()=>b.cerrar());await b.restaurar(n);const z=b.conexiones.get(n);assert.equal(z.auth.creds.registered,true);assert.equal((await z.auth.keys.get('session',['peer-privado']))['peer-privado'].key.toString(),'valor secreto');await b.cambio(n,z,{connection:'open'});assert.equal((await b.estado(n)).verificado,true);
 await b.enviar(n,'525500000000','mensaje simulado','a'.repeat(64));assert.equal(g.sockets.length,1);
});
test('llave errónea no borra ni reemplaza la sesión',async t=>{
 const e=await entorno(t),key=randomBytes(32).toString('base64'),owner=randomUUID(),fence=await e.db.reservar(n,owner),s=new SesionesCifradas(e.db,key,n,owner,fence);await s.guardar('credenciales','principal',{registered:true,me:{id:'525511111111@s.whatsapp.net'}});await e.db.soltar(n,owner,fence);
 const antes=(await e.db.usar(c=>c.query('SELECT * FROM ritmo.whatsapp_sesiones'))).rows;const f=simular(),a=new BaileysSoloEnvios(e.db,randomBytes(32).toString('base64'),{fabrica:f.fabrica});t.after(()=>a.cerrar());await assert.rejects(()=>a.restaurar(n),/llave/);assert.equal(f.sockets.length,0);assert.deepEqual((await e.db.usar(c=>c.query('SELECT * FROM ritmo.whatsapp_sesiones'))).rows,antes);assert.equal((await e.control.estado(e.ident(),n)).freno,true);
});
test('dos procesos no pueden custodiar la sesión y el dueño antiguo pierde permisos al expirar',async t=>{
 const e=await entorno(t),key=randomBytes(32).toString('base64'),p=randomUUID(),q=randomUUID(),f=await e.db.reservar(n,p),s=new SesionesCifradas(e.db,key,n,p,f);await s.guardar('session','x',{key:'antes'});await assert.rejects(()=>e.db.reservar(n,q),err=>err.status===409);e.avanzar(45001);const nuevo=await e.db.reservar(n,q);assert.ok(nuevo>f);await assert.rejects(()=>s.guardar('session','x',{key:'después'}),/custodia/);assert.equal(await e.db.renovar(n,p,f),false);await e.db.soltar(n,p,f);assert.equal(await e.db.renovar(n,q,nuevo),true);
});
test('reconexión gradual, cierre manual y permisos de operación separados',async t=>{
 const e=await entorno(t),f=simular(),timers=[],a=new BaileysSoloEnvios(e.db,randomBytes(32).toString('base64'),{fabrica:f.fabrica,vincular:false,temporizador:(fn,ms)=>{timers.push({fn,ms});return {unref(){}};}});t.after(()=>a.cerrar());await assert.rejects(()=>a.codigo(n,'525511111111'),/confirmación/);a.reconectar(n);assert.equal(timers[0].ms,30000);a.reintentos.clear();a.reconectar(n);assert.equal(timers[1].ms,60000);a.reintentos.clear();a.fallos.set(n,20);a.reconectar(n);assert.equal(timers[2].ms,300000);
});
test('configuración rechaza FiNeCi, rol amplio, activación implícita y proveedor ajeno',()=>{
 const env={WA_ACTIVAR_SERVICIO:'true',SUPABASE_URL:'https://zkqwephmuflbuagevvxj.supabase.co',PUBLIC_URL:'https://agendappx.local/',DATABASE_URL:'postgresql://agendappx_whatsapp:clave@db.zkqwephmuflbuagevvxj.supabase.co/postgres',WHATSAPP_SALONES_HABILITADOS:n};const c=configurar(env);assert.equal(c.politica.envios,false);assert.equal(c.politica.vincular,false);assert.equal(c.ssl.rejectUnauthorized,true);
 for(const patch of [{WA_ACTIVAR_SERVICIO:'false'},{SUPABASE_URL:'https://fineci.supabase.co'},{DATABASE_URL:env.DATABASE_URL.replace('agendappx_whatsapp:','postgres:')},{DATABASE_URL:env.DATABASE_URL.replace('db.zkqwephmuflbuagevvxj','db.otro')},{WHATSAPP_SALONES_HABILITADOS:''}])assert.throws(()=>configurar({...env,...patch}));
 assert.equal(configurar({...env,DATABASE_URL:'postgresql://agendappx_whatsapp.zkqwephmuflbuagevvxj:clave@aws-0-us-east-1.pooler.supabase.com:6543/postgres'}).politica.envios,false);
});
