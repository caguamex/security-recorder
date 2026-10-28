import {randomBytes,createHash,createHmac} from 'node:crypto';
import {Invitaciones} from './invitaciones.js';
import {calendario} from '../integraciones.js';
import type {Repositorio} from '../repositorio.js';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {ConexionSQL} from '../repositorio.js';
import {ErrorAPI,validarCambio} from '../modelo.js';
import {enTransaccion,miembroVigente} from './contexto.js';
import {RepositorioConCuentas} from './repositorio.js';
import type {IdentidadFirmada} from './jwt.js';
const json=(r:ServerResponse,data:unknown)=>{r.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Authorization','Referrer-Policy':'no-referrer'}).end(JSON.stringify(data));};
export function rutasCuentas(pool:ConexionSQL,jwt:{verificar:(s:string)=>Promise<IdentidadFirmada>},config:{habilitado:boolean;supabaseURL:string;llavePublica:string;salones:ReadonlySet<string>;origen:string;migracionUsuarioId?:string;claveLimite?:string;turnstileSiteKey?:string;temporales?:boolean}){
 const invitaciones=new Invitaciones(pool);
 return async(req:IncomingMessage,res:ServerResponse,url:URL)=>{
 if(url.pathname==='/api/cuentas/config'&&req.method==='GET'){
  // Una clave publicable no autoriza consultas privadas; la base exige JWT, sesión y RLS.
  if(config.habilitado){let publica=/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.llavePublica||'');if(!publica)try{publica=JSON.parse(Buffer.from(config.llavePublica.split('.')[1],'base64url').toString()).role==='anon';}catch{}if(!publica)throw new ErrorAPI(503,'Falta configurar la llave publicable de acceso.');}
  json(res,config.habilitado?{habilitado:true,supabaseURL:config.supabaseURL,llavePublica:config.llavePublica,...(config.turnstileSiteKey?{turnstileSiteKey:config.turnstileSiteKey}:{})}:{habilitado:false});return true;
 }
 if(!config.habilitado)return false;
 const feed=/^\/calendario\/(?:cuentas\/)?([a-f0-9]{64})\.ics$/.exec(url.pathname);
 if(feed&&req.method==='GET'){
  const c=await pool.connect();let records;try{records=(await c.query('SELECT * FROM ritmo.feed_cuentas($1)',[createHash('sha256').update(feed[1]).digest('hex')])).rows;}finally{c.release();}
  if(!records.length)throw new ErrorAPI(404,'Calendario no disponible.');
  const texto=await calendario({estado:async()=>records} as Repositorio,'America/Mexico_City');
  res.writeHead(200,{'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}).end(texto);return true;
 }
 if(req.headers.origin&&req.headers.origin!==config.origen||req.headers['sec-fetch-site']==='cross-site')throw new ErrorAPI(403,'Origen no permitido.');
 const equipo=/^\/api\/negocios\/([a-f0-9-]{36})\/miembros(?:\/([a-f0-9-]{36}))?$/.exec(url.pathname);
 if(equipo){
  if(url.search||!config.salones.has(equipo[1]))throw new ErrorAPI(403,'Salón no disponible.');
  const i=await jwt.verificar(req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'');
  if(i.aal!=='aal2')throw new ErrorAPI(403,'Completa la verificación en dos pasos.');
  const n=equipo[1];
  if(req.method==='GET'&&!equipo[2]){
   const miembros=await enTransaccion(pool,i,n,async c=>{const actual=await miembroVigente(c,n,i.usuarioId);if(actual.rol!=='admin')throw new ErrorAPI(403,'Solo Admin puede administrar el equipo.');
    return (await c.query('SELECT usuario_id,nombre,rol FROM ritmo.miembros WHERE negocio_id=$1 AND activo ORDER BY nombre',[n])).rows;});
   json(res,{miembros:miembros.map(m=>({id:m.usuario_id,nombre:m.nombre,rol:m.rol,propia:m.usuario_id===i.usuarioId}))});return true;
  }
  if(req.method==='DELETE'&&equipo[2]){
   if(req.headers.origin!==config.origen)throw new ErrorAPI(403,'Abre Agendappx para continuar.');
   if(equipo[2]===i.usuarioId)throw new ErrorAPI(403,'No puedes quitar tu propio acceso.');
   const quitada=await enTransaccion(pool,i,n,async c=>{const actual=await miembroVigente(c,n,i.usuarioId);if(actual.rol!=='admin')throw new ErrorAPI(403,'Solo Admin puede administrar el equipo.');
    return (await c.query('UPDATE ritmo.miembros SET activo=false WHERE negocio_id=$1 AND usuario_id=$2 AND activo RETURNING usuario_id',[n,equipo[2]])).rows.length>0;});
   if(!quitada)throw new ErrorAPI(404,'Persona no disponible.');json(res,{quitada:true});return true;
  }
  throw new ErrorAPI(405,'Método no permitido.');
 }
 const invCrear=/^\/api\/negocios\/([a-f0-9-]{36})\/invitaciones$/.exec(url.pathname);
 if(invCrear||url.pathname==='/api/invitaciones/aceptar'){
  if(!config.temporales||!config.turnstileSiteKey)throw new ErrorAPI(503,'Invitaciones no configuradas.');
  if(req.method!=='POST'||url.search)throw new ErrorAPI(405,'Método no permitido.');
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ErrorAPI(415,'Usa application/json.');
  if(req.headers.origin!==config.origen)throw new ErrorAPI(403,'Abre Agendappx para continuar.');
  let size=0;const partes:Buffer[]=[];for await(const b of req){size+=b.length;if(size>4096)throw new ErrorAPI(413,'Solicitud demasiado grande.');partes.push(b);}
  let body:any;try{body=JSON.parse(Buffer.concat(partes).toString('utf8'));}catch{throw new ErrorAPI(400,'Solicitud inválida.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new ErrorAPI(400,'Solicitud inválida.');
  const i=await jwt.verificar(req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'');
  if(i.aal!=='aal2')throw new ErrorAPI(403,'Completa primero la verificación en dos pasos.');
  if(invCrear){
   if(!config.turnstileSiteKey)throw new ErrorAPI(503,'Invitaciones no configuradas.');
   if(!config.salones.has(invCrear[1]))throw new ErrorAPI(403,'Salón no disponible.');
   if(Object.keys(body).some(k=>k!=='nombre'))throw new ErrorAPI(400,'Solicitud inválida.');
   const creada=await invitaciones.crear(i,invCrear[1],{nombre:body.nombre,rol:'admin',servicios:[],horario:{}});
   const enlace=new URL('/',config.origen);enlace.hash='invitacion='+creada.codigo;
   json(res,{enlace:enlace.href,venceEn:creada.venceEn});return true;
  }
  if(Object.keys(body).some(k=>!['codigo','nombre'].includes(k)))throw new ErrorAPI(400,'Solicitud inválida.');
  const ip=String(req.headers['cf-connecting-ip']||req.socket.remoteAddress||'');
  if(!ip||!config.claveLimite||config.claveLimite.length<32)throw new ErrorAPI(503,'Invitaciones no disponibles.');
  const hash=createHmac('sha256',config.claveLimite).update(ip).digest('hex');
  const vista=await invitaciones.ver(body.codigo,hash);
  if(!config.salones.has(vista.negocioId)||vista.rol!=='admin')throw new ErrorAPI(403,'Salón no disponible.');
  await invitaciones.aceptar(i,body.codigo,{nombre:body.nombre,resumenCorreo:false},hash);
  json(res,{unida:true});return true;
 }
 const m=/^\/api\/negocios\/([a-f0-9-]{36})\/datos\/(estado|prestadores|conexiones|calendario\/renovar|objetos\/([a-zA-Z0-9_-]{1,120}))$/.exec(url.pathname);
 if(url.pathname!=='/api/cuentas/contexto'&&!m){
  if(url.pathname.startsWith('/api/')&&!/\/whatsapp(?:\/|$)/.test(url.pathname))throw new ErrorAPI(401,'Inicia sesión con tu cuenta.');return false;
 }
 const i=await jwt.verificar(req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'');
 if(url.pathname==='/api/cuentas/contexto'){
  if(req.method!=='GET'||url.search)throw new ErrorAPI(405,'Método no permitido.');
  const miembros=[];for(const n of config.salones){const m=await enTransaccion(pool,i,n,async c=>(await c.query('SELECT negocio_id,rol FROM ritmo.miembros WHERE negocio_id=$1 AND usuario_id=$2 AND activo',[n,i.usuarioId])).rows[0]);if(m)miembros.push({negocioId:m.negocio_id,rol:m.rol});}
  json(res,{usuarioId:i.usuarioId,aal:i.aal,miembros,recuperarLegado:i.usuarioId===config.migracionUsuarioId&&i.aal==='aal2'&&miembros.some(m=>m.rol==='admin')});return true;
 }
 const n=m![1];if(!config.salones.has(n))throw new ErrorAPI(403,'Salón no disponible.');
 const repo=new RepositorioConCuentas(pool,i,n);
 if(m![2]==='prestadores'&&req.method==='GET'){
  const equipo=await enTransaccion(pool,i,n,async c=>{await miembroVigente(c,n,i.usuarioId);
   return (await c.query('SELECT nombre,servicios FROM ritmo.miembros WHERE negocio_id=$1 AND activo AND cardinality(servicios)>0 ORDER BY nombre',[n])).rows;});
  json(res,{equipo:equipo.map(m=>({nombre:m.nombre,servicios:m.servicios}))});return true;
 }

 if(['conexiones','calendario/renovar'].includes(m![2])){
  if(req.method!==(m![2]==='conexiones'?'GET':'POST'))throw new ErrorAPI(405,'Método no permitido.');
  const token=await enTransaccion(pool,i,n,async c=>{await miembroVigente(c,n,i.usuarioId);const raw=randomBytes(32).toString('hex');
   // Conservar el enlace entre visitas; revocarlo solo al pedir renovar.
   const previo=(await c.query('SELECT token FROM ritmo.calendarios_cuentas WHERE negocio_id=$1 AND usuario_id=$2',[n,i.usuarioId])).rows[0];
   if(previo&&m![2]==='conexiones')return previo.token as string;
   await c.query('INSERT INTO ritmo.calendarios_cuentas(huella,negocio_id,usuario_id,token) VALUES($1,$2,$3,$4) ON CONFLICT(negocio_id,usuario_id) DO UPDATE SET huella=EXCLUDED.huella,token=EXCLUDED.token,creado_en=now()',[createHash('sha256').update(raw).digest('hex'),n,i.usuarioId,raw]);return raw;});
  json(res,{calendarioUrl:token?new URL('/calendario/cuentas/'+token+'.ics',config.origen).href:null,requiereRenovar:!token,whatsapp:{configurado:false,explicacion:'Mensajes desde tu número vinculado.'}});return true;
 }
 if(m![2]==='estado'&&req.method==='GET'){
  const snap=await repo.snapshot();const depositos=await enTransaccion(pool,i,n,async c=>{const m=await miembroVigente(c,n,i.usuarioId);if(m.rol==='especialista')return [];return (await c.query('SELECT cita_id,monto,estado,limite,recibido_en,recibido_por,metodo FROM ritmo.whatsapp_anticipos WHERE negocio_id=$1',[n])).rows;});
  for(const r of snap.records){const a=depositos.find(p=>p.cita_id===r.id);if(a&&r.data?.kind==='cita'){r.data.anticipo={monto:Number(a.monto),estado:a.estado,limite:a.limite,recibidoEn:a.recibido_en,recibidoPor:a.recibido_por,metodo:a.metodo};if(a.estado==='recibido'&&r.data.estado==='pendiente')r.data.estado='confirmada';}}
  json(res,snap);return true;
 }
 if(m![3]&&req.method==='PUT'){
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ErrorAPI(415,'Usa application/json.');
  let size=0;const chunks=[];for await(const b of req){size+=b.length;if(size>65536)throw new ErrorAPI(413,'La solicitud excede 64 KB.');chunks.push(b);}
  let d;try{d=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ErrorAPI(400,'JSON inválido.');}
  const cambio=validarCambio(d,m![3]);
  // Los anticipos los administra el mensajero; ningún JSON de la agenda puede suplantar un pago.
  if(cambio.data&&'anticipo' in cambio.data)delete cambio.data.anticipo;
  json(res,await repo.cambiar(cambio));return true;
 }
 throw new ErrorAPI(405,'Método no permitido.');
 };
}
