import {randomBytes,randomUUID,createHash,createHmac} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {ConexionSQL} from '../repositorio.js';
import type {IdentidadFirmada} from './jwt.js';
import {ErrorAPI} from '../modelo.js';
import {enTransaccion,miembroVigente} from './contexto.js';
import {Invitaciones} from './invitaciones.js';
import {huella,iguales,telefonoMX} from './acceso.js';
const h=(v:string)=>createHash('sha256').update(v).digest('hex');
const uuid=/^[a-f0-9-]{36}$/i;
type Config={habilitado:boolean;key:string;operacionKey:string;turnstileKey:string;turnstileSiteKey:string;origen:string;supabaseURL:string;llavePublica:string;ip:(r:IncomingMessage)=>string;fetch?:typeof fetch;ahora?:()=>number};
export class RegistroWhatsApp {
 readonly red:typeof fetch;readonly ahora:()=>number;
 constructor(readonly pool:ConexionSQL,readonly config:Config){this.red=config.fetch||fetch;this.ahora=config.ahora||Date.now;}
 async usar<T>(f:(c:any)=>Promise<T>){const c=await this.pool.connect();try{return await f(c);}finally{c.release();}}
 async tx<T>(f:(c:any)=>Promise<T>){return this.usar(async c=>{try{await c.query('BEGIN');const r=await f(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}});}
 async ticket(id:unknown,prueba:unknown){if(!uuid.test(String(id))||!/^[a-f0-9]{64}$/.test(String(prueba)))throw new ErrorAPI(400,'Registro inválido.');
  const r=await this.usar(async c=>(await c.query('SELECT * FROM ritmo.registro_solicitudes WHERE id=$1',[id])).rows[0]);
  if(!r||!iguales(r.prueba_hash,huella(this.config.key,'registro',String(prueba)))||new Date(r.vence_en).getTime()<=this.ahora())throw new ErrorAPI(400,'El registro venció. Empieza de nuevo.');return r;
 }
 async invitacion(codigo:unknown,ip:string){const vista=await new Invitaciones(this.pool).ver(String(codigo||''),huella(this.config.key,'registro-ip',ip));return vista;}
 async crear(d:any,ip:string){
  if(d.consentimiento!==true||typeof d.nombre!=='string'||!d.nombre.trim()||d.nombre.length>200)throw new ErrorAPI(400,'Escribe tu nombre y acepta recibir el código solicitado.');
  if(!ip||ip.length>200)throw new ErrorAPI(503,'No se pudo verificar la conexión.');
  const destino=telefonoMX(d.telefono),tipo=d.invitacion?'invitacion':'salon';let inv:any;
  const perfil:any={nombre:d.nombre.trim()};
  if(tipo==='invitacion')inv=await this.invitacion(d.invitacion,ip);
  else {if(typeof d.salon!=='string'||!d.salon.trim()||d.salon.length>200||typeof d.slug!=='string'||!/^([a-z0-9][a-z0-9-]{2,59})$/.test(d.slug)||['comunidad','api','calendario','salud','webhooks','unirse'].includes(d.slug))throw new ErrorAPI(400,'Revisa el nombre y el enlace de tu salón.');perfil.salon=d.salon.trim();perfil.slug=d.slug;}
  if(typeof d.captchaToken!=='string'||!d.captchaToken||d.captchaToken.length>4096)throw new ErrorAPI(400,'Completa la verificación de seguridad.');
  let captcha:any;try{const r=await this.red('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:this.config.turnstileKey,response:d.captchaToken,remoteip:ip}),signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error();captcha=await r.json();}catch{throw new ErrorAPI(503,'No se pudo comprobar la seguridad. Intenta de nuevo.');}
  if(!captcha.success||captcha.hostname!==new URL(this.config.origen).hostname||captcha.action!=='registro')throw new ErrorAPI(400,'Vuelve a completar la verificación de seguridad.');
  const id=randomUUID(),prueba=randomBytes(32).toString('hex'),dest=huella(this.config.key,'destino',destino),red=huella(this.config.key,'registro-ip',ip);
  await this.tx(async c=>{
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended('agendappx-altas',0))");
   await c.query('DELETE FROM ritmo.registro_solicitudes WHERE creado_en<$1 AND completado_en IS NULL',[new Date(this.ahora()-86400000)]);
   const limite=(await c.query('SELECT count(*) FILTER(WHERE ip_hash=$1) AS ip,count(*) AS total FROM ritmo.registro_solicitudes WHERE creado_en>$2',[red,new Date(this.ahora()-86400000)])).rows[0];
   if(Number(limite.ip)>=3||Number(limite.total)>=100)throw new ErrorAPI(429,'Por seguridad, espera antes de comenzar otro registro.');
   if(tipo==='salon'&&(await c.query('SELECT 1 FROM ritmo.negocios_enlaces WHERE slug=$1',[perfil.slug])).rows.length)throw new ErrorAPI(409,'Ese enlace ya está ocupado. Elige otro.');
   await c.query('INSERT INTO ritmo.registro_solicitudes(id,prueba_hash,destino_hash,ip_hash,tipo,perfil,invitacion_hash,creado_en,vence_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,huella(this.config.key,'registro',prueba),dest,red,tipo,perfil,inv?h(String(d.invitacion)):null,new Date(this.ahora()),new Date(this.ahora()+1800000)]);
  });
  // Solo este intermediario de Supabase posee la llave Admin; ni Worker, navegador ni mensajero la reciben.
  const raw=JSON.stringify({id,phone:'+'+destino}),ts=String(Math.floor(this.ahora()/1000));
  const firma=createHmac('sha256',Buffer.from(this.config.operacionKey,'base64')).update('alta-whatsapp-v1\0'+ts+'\0'+raw).digest('hex');
  try{const r=await this.red(this.config.supabaseURL+'/functions/v1/agendappx-registro',{method:'POST',headers:{'Content-Type':'application/json','x-registro-fecha':ts,'x-registro-firma':firma},body:raw,signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error();}catch{throw new ErrorAPI(503,'No se pudo preparar la cuenta. Intenta más tarde.');}
  return {id,prueba,rol:inv?.rol||'admin',tipo};
 }
 async verificar(i:IdentidadFirmada,token:string,d:any){const r=await this.ticket(d.id,d.prueba);let usuario:any;
  try{const res=await this.red(this.config.supabaseURL+'/auth/v1/user',{headers:{apikey:this.config.llavePublica,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)});if(!res.ok)throw new Error();usuario=await res.json();}catch{throw new ErrorAPI(401,'Verifica tu código de WhatsApp primero.');}
  if(usuario.id!==i.usuarioId||!usuario.phone_confirmed_at||!iguales(r.destino_hash,huella(this.config.key,'destino',telefonoMX(usuario.phone))))throw new ErrorAPI(403,'Usa el WhatsApp con el que comenzaste este registro.');
  return enTransaccion(this.pool,i,null,async c=>{const actual=(await c.query('SELECT * FROM ritmo.registro_solicitudes WHERE id=$1 FOR UPDATE',[r.id])).rows[0];
   const codigo=(await c.query("SELECT 1 FROM ritmo.acceso_sesiones ses JOIN ritmo.acceso_solicitudes a ON a.id=ses.solicitud_otp WHERE ses.sesion_id=$1 AND ses.usuario_id=$2 AND a.usuario_id=$2 AND a.canal='whatsapp' AND a.tipo='sms' AND a.estado='usado' AND a.destino_hash=$3 AND a.creado_en>=$4",[i.sesionId,i.usuarioId,r.destino_hash,r.creado_en])).rows[0];
   if(!codigo)throw new ErrorAPI(403,'Verifica un código nuevo para completar este registro.');
   if(actual.usuario_id&&actual.usuario_id!==i.usuarioId)throw new ErrorAPI(403,'Registro de otra cuenta.');
   if(actual.completado_en)throw new ErrorAPI(400,'Este registro ya terminó. Inicia sesión.');
   await c.query('UPDATE ritmo.registro_solicitudes SET usuario_id=$2,sesion_id=$3,verificado_en=now() WHERE id=$1',[r.id,i.usuarioId,i.sesionId]);return {verificado:true};});
 }
 async finalizar(i:IdentidadFirmada,d:any){const r=await this.ticket(d.id,d.prueba);try{return await enTransaccion(this.pool,i,null,async c=>({negocioId:(await c.query('SELECT ritmo.finalizar_registro($1,$2) AS negocio_id',[r.id,r.prueba_hash])).rows[0].negocio_id}));}catch(e:any){if(e?.code==='23505')throw new ErrorAPI(409,'Ese enlace ya está ocupado. Comienza con otro enlace.');if(['22023','42501','28000'].includes(e?.code))throw new ErrorAPI(e.code==='42501'?403:400,e.code==='42501'?'Completa la verificación en dos pasos.':'La invitación o el registro ya no están disponibles.');throw e;}}
}
async function cuerpo(req:IncomingMessage){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ErrorAPI(415,'Usa application/json.');let tam=0;const partes=[];for await(const b of req){tam+=b.length;if(tam>8192)throw new ErrorAPI(413,'Solicitud demasiado grande.');partes.push(b);}try{const d=JSON.parse(Buffer.concat(partes).toString());if(!d||Array.isArray(d)||typeof d!=='object')throw new Error();return d;}catch{throw new ErrorAPI(400,'Solicitud inválida.');}}
export function rutasRegistro(pool:ConexionSQL,jwt:{verificar:(s:string)=>Promise<IdentidadFirmada>},config:Config){
 const registro=new RegistroWhatsApp(pool,config),inv=new Invitaciones(pool);
 return async(req:IncomingMessage,res:ServerResponse,url:URL)=>{
  const ruta=url.pathname,miembros=/^\/api\/negocios\/([a-f0-9-]{36})\/(miembros|invitaciones)(?:\/([a-f0-9-]{36}))?$/.exec(ruta);
  if(!ruta.startsWith('/api/registro/')&&!miembros)return false;
  if(!config.habilitado||!config.turnstileSiteKey||!config.turnstileKey||!config.operacionKey)throw new ErrorAPI(503,'El registro todavía no está habilitado.');
  if(config.supabaseURL!=='https://zkqwephmuflbuagevvxj.supabase.co'||!/^[A-Za-z0-9+/]{43}=$/.test(config.operacionKey))throw new ErrorAPI(503,'Registro pendiente de configurar.');
  if(url.search||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==config.origen)throw new ErrorAPI(403,'Abre Agendappx para continuar.');
  const responder=(d:unknown)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}).end(JSON.stringify(d));return true;};
  if(req.method!=='GET'&&req.headers.origin!==config.origen)throw new ErrorAPI(403,'Abre Agendappx para continuar.');
  const ip=config.ip(req);
  if(ruta==='/api/registro/invitacion'&&req.method==='POST'){const d=await cuerpo(req);return responder(await registro.invitacion(d.codigo,ip));}
  if(ruta==='/api/registro/crear'&&req.method==='POST')return responder(await registro.crear(await cuerpo(req),ip));
  const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'',i=await jwt.verificar(token);
  if(ruta==='/api/registro/verificado'&&req.method==='POST')return responder(await registro.verificar(i,token,await cuerpo(req)));
  if(ruta==='/api/registro/finalizar'&&req.method==='POST')return responder(await registro.finalizar(i,await cuerpo(req)));
  if(miembros){const n=miembros[1];
   if(i.aal!=='aal2')throw new ErrorAPI(403,'Completa la verificación en dos pasos.');
   if(miembros[2]==='invitaciones'&&!miembros[3]&&req.method==='POST'){const d=await cuerpo(req);if(Object.keys(d).some(k=>!['nombre','rol','servicios','horario'].includes(k)))throw new ErrorAPI(400,'Invitación inválida.');const creada=await inv.crear(i,n,{nombre:d.nombre,rol:d.rol,servicios:d.servicios||[],horario:d.horario||{}});return responder({enlace:config.origen+'/#invitacion='+creada.codigo,venceEn:creada.venceEn});}
   if(miembros[2]==='miembros'&&req.method==='GET'&&!miembros[3]){return responder(await enTransaccion(pool,i,n,async c=>{const m=await miembroVigente(c,n,i.usuarioId);if(m.rol!=='admin')throw new ErrorAPI(403,'Solo Admin puede administrar el equipo.');return {miembros:(await c.query('SELECT usuario_id AS id,nombre,rol,servicios,ver_todas FROM ritmo.miembros WHERE negocio_id=$1 AND activo ORDER BY nombre',[n])).rows.map(m=>({...m,propia:m.id===i.usuarioId}))};}));}
   if(miembros[2]==='miembros'&&req.method==='PATCH'&&miembros[3]){const d=await cuerpo(req);if(Object.keys(d).some(k=>!['servicios','verTodas'].includes(k))||!Array.isArray(d.servicios)||d.servicios.length>100||new Set(d.servicios).size!==d.servicios.length||!d.servicios.every((s:unknown)=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(s))||typeof d.verTodas!=='boolean')throw new ErrorAPI(400,'Revisa los servicios y permisos.');return responder(await enTransaccion(pool,i,n,async c=>{const m=await miembroVigente(c,n,i.usuarioId);if(m.rol!=='admin')throw new ErrorAPI(403,'Solo Admin puede cambiar asignaciones.');const servicios=(await c.query("SELECT id FROM ritmo.belleza_objetos WHERE negocio_id=$1 AND tipo='servicio' AND data IS NOT NULL AND id=ANY($2::text[])",[n,d.servicios])).rows;if(servicios.length!==d.servicios.length)throw new ErrorAPI(400,'Algún servicio no pertenece a este salón.');const r=await c.query('UPDATE ritmo.miembros SET servicios=$3,ver_todas=$4 WHERE negocio_id=$1 AND usuario_id=$2 AND activo RETURNING usuario_id',[n,miembros[3],d.servicios,d.verTodas]);if(!r.rows.length)throw new ErrorAPI(404,'Persona no disponible.');return {guardado:true};}));}
   if(miembros[2]==='miembros'&&req.method==='DELETE'&&miembros[3]){if(miembros[3]===i.usuarioId)throw new ErrorAPI(403,'No puedes quitar tu propio acceso.');return responder(await enTransaccion(pool,i,n,async c=>{const m=await miembroVigente(c,n,i.usuarioId);if(m.rol!=='admin')throw new ErrorAPI(403,'Solo Admin puede administrar el equipo.');const r=await c.query('UPDATE ritmo.miembros SET activo=false WHERE negocio_id=$1 AND usuario_id=$2 AND activo RETURNING usuario_id',[n,miembros[3]]);if(!r.rows.length)throw new ErrorAPI(404,'Persona no disponible.');return {quitada:true};}));}
  }
  throw new ErrorAPI(405,'Método no permitido.');
 };
}
