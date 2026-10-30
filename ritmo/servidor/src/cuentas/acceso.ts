import {createHmac,createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {ConexionSQL,ClienteSQL} from '../repositorio.js';
import type {IdentidadFirmada} from './jwt.js';
import {enTransaccion,miembroVigente} from './contexto.js';
import {ErrorAPI} from '../modelo.js';
export function telefonoMX(valor:unknown){const t=String(valor||'').trim().replace(/[ ()-]/g,'').replace(/^\+/,'');const n=/^\d{10}$/.test(t)?'52'+t:t;if(!/^52\d{10}$/.test(n))throw new ErrorAPI(400,'Escribe los diez dígitos de tu WhatsApp de México.');return n;}
export function huella(key:string,tipo:string,valor:string){return createHmac('sha256',Buffer.from(key,'base64')).update(tipo+'\0'+valor).digest('hex');}
export function iguales(a:string,b:string){return /^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}
export class SolicitudesAcceso {
 constructor(readonly pool:ConexionSQL,readonly key:string,readonly ahora=()=>Date.now()){
  if(!/^[A-Za-z0-9+/]{43}=$/.test(key)||Buffer.from(key,'base64').length!==32)throw new Error('Falta la llave privada de límites de acceso.');
 }
 async usar<T>(fn:(c:ClienteSQL)=>Promise<T>){const c=await this.pool.connect();try{return await fn(c);}finally{c.release();}}
 async tx<T>(fn:(c:ClienteSQL)=>Promise<T>){return this.usar(async c=>{try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}});}
 async crear(canal:string,destino:string,ip:string,usuarioId?:string){
  if(!ip||ip.length>200)throw new ErrorAPI(503,'No se pudo verificar la conexión.');
  const id=randomUUID(),prueba=randomBytes(32).toString('hex'),dest=huella(this.key,'destino',destino),red=huella(this.key,'ip',ip),now=this.ahora();
  await this.tx(async c=>{
   for(const k of [dest,red].sort())await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[k]);
   await c.query("DELETE FROM ritmo.acceso_solicitudes WHERE creado_en<$1",[new Date(now-86400000)]);
   const f=(await c.query('SELECT count(*) FILTER(WHERE destino_hash=$1 AND creado_en>$3) AS telefono,count(*) FILTER(WHERE ip_hash=$2 AND creado_en>$4) AS ip FROM ritmo.acceso_solicitudes WHERE destino_hash=$1 OR ip_hash=$2',[dest,red,new Date(now-900000),new Date(now-3600000)])).rows[0];
   if(Number(f.telefono)>=3||Number(f.ip)>=10)throw new ErrorAPI(429,'Por seguridad, espera antes de pedir otro código.');
   await c.query('INSERT INTO ritmo.acceso_solicitudes(id,prueba_hash,destino_hash,ip_hash,canal,tipo,usuario_id,creado_en,vence_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,huella(this.key,'prueba',prueba),dest,red,canal,usuarioId?'phone_change':canal==='whatsapp'?'sms':'email',usuarioId||null,new Date(now),new Date(now+600000)]);
  });return {id,prueba};
 }
 async fallar(id:string){await this.usar(c=>c.query("UPDATE ritmo.acceso_solicitudes SET estado='fallido' WHERE id=$1 AND estado='pendiente'",[id]));}
 async intento(id:string,prueba:string,codigo:string){
  if(!/^[a-f0-9-]{36}$/.test(id)||!/^\d{6}$/.test(codigo)||!/^[a-f0-9]{64}$/.test(prueba))throw new ErrorAPI(400,'Escribe el código de seis dígitos.');
  const salida=await this.tx(async c=>{const s=(await c.query('SELECT * FROM ritmo.acceso_solicitudes WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!s||!iguales(s.prueba_hash,huella(this.key,'prueba',prueba))||new Date(s.vence_en).getTime()<=this.ahora()||s.intentos>=5||!['pendiente','enviado'].includes(s.estado))return null;
   const correcto=s.canal==='correo'||!!s.codigo_hash&&iguales(s.codigo_hash,huella(this.key,'otp',id+':'+codigo));
   await c.query('UPDATE ritmo.acceso_solicitudes SET intentos=intentos+1,estado=$2 WHERE id=$1',[id,correcto?'verificando':s.estado]);return correcto?s:null;
  });if(!salida)throw new ErrorAPI(400,'Código inválido, vencido o sin intentos. Pide uno nuevo.');return salida;
 }
 async resultado(id:string,ok:boolean,incierto=false){await this.usar(c=>c.query("UPDATE ritmo.acceso_solicitudes SET estado=$2 WHERE id=$1 AND estado='verificando'",[id,ok?'usado':incierto?'incierto':'enviado']));}
 async admitir(i:IdentidadFirmada,solicitudOtp?:string){await this.usar(c=>solicitudOtp?c.query('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id,solicitud_otp) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[i.sesionId,i.usuarioId,solicitudOtp]):c.query('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[i.sesionId,i.usuarioId]));}
}
async function cuerpo(req:IncomingMessage){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ErrorAPI(415,'Usa application/json.');const partes=[];let tam=0;for await(const b of req){tam+=b.length;if(tam>4096)throw new ErrorAPI(413,'Solicitud demasiado grande.');partes.push(b);}try{const d=JSON.parse(Buffer.concat(partes).toString());if(!d||typeof d!=='object'||Array.isArray(d))throw new Error();return d;}catch{throw new ErrorAPI(400,'Solicitud inválida.');}}
const responder=(res:ServerResponse,status:number,d:unknown)=>res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}).end(JSON.stringify(d));
type Config={registro?:boolean;recuperacionHash?:string;recuperacionUsuario?:string;habilitado:boolean;correo:boolean;key:string;origen:string;supabaseURL:string;llavePublica:string;salones:ReadonlySet<string>;ip:(req:IncomingMessage)=>string;fetch?:typeof fetch};
export function rutasAcceso(pool:ConexionSQL,jwt:{verificar:(s:string)=>Promise<IdentidadFirmada>},config:Config){
 if(config.habilitado&&(config.supabaseURL!=='https://zkqwephmuflbuagevvxj.supabase.co'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.llavePublica)))throw new Error('Usa exclusivamente el proyecto y la llave publicable de Agendappx.');
 const solicitudes=config.habilitado?new SolicitudesAcceso(pool,config.key):null;
 const red=config.fetch||fetch;
 async function auth(path:string,d:unknown,token?:string,metodo='POST'){
  let r;try{r=await red(config.supabaseURL+'/auth/v1/'+path,{method:metodo,headers:{apikey:config.llavePublica,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(d),signal:AbortSignal.timeout(18000)});}catch{throw new ErrorAPI(503,config.correo?'WhatsApp tardó demasiado. Puedes usar tu correo de respaldo.':'WhatsApp tardó demasiado. Intenta más tarde.');}
  let data:any;try{data=await r.json();}catch{throw new ErrorAPI(503,'No se pudo verificar el acceso.');}return {ok:r.ok,data};
 }
 // Restablecer con el usuario: el teléfono se resuelve aquí y nunca se devuelve.
 async function telefonoDeUsuario(v:unknown){const u=String(v||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._]{2,19}$/.test(u))return null;const c=await pool.connect();try{const f=(await c.query('SELECT phone FROM ritmo.identificador_acceso($1)',[u])).rows[0];return f?.phone?telefonoMX(f.phone):null;}finally{c.release();}}
 return async(req:IncomingMessage,res:ServerResponse,url:URL)=>{
  if(!url.pathname.startsWith('/api/acceso/'))return false;
  if(!solicitudes)throw new ErrorAPI(503,'El acceso por código todavía no está activado.');
  if(req.headers.origin!==config.origen||req.headers['sec-fetch-site']==='cross-site')throw new ErrorAPI(403,'Abre Agendappx para iniciar sesión.');
  if(req.method!=='POST'||url.search)throw new ErrorAPI(405,'Método no permitido.');
  const d=await cuerpo(req),token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
  if(url.pathname==='/api/acceso/solicitar'){
   const canal=d.canal;if(!['whatsapp','correo'].includes(canal))throw new ErrorAPI(400,'Elige WhatsApp o correo.');
   if(canal==='correo'&&!config.correo)throw new ErrorAPI(503,'El correo de respaldo aún no está configurado. Tu acceso privado sigue disponible.');
   const porUsuario=canal==='whatsapp'&&d.usuario!==undefined&&d.vincular!==true;
   const resuelto=porUsuario?await telefonoDeUsuario(d.usuario):canal==='whatsapp'?telefonoMX(d.destino):String(d.destino||'').trim().toLowerCase();
   // Misma respuesta si el usuario no existe o no tiene WhatsApp; cuenta igual para los límites.
   if(porUsuario&&!resuelto){const s=await solicitudes.crear(canal,'usuario:'+String(d.usuario).trim().toLowerCase().slice(0,40),config.ip(req));await solicitudes.fallar(s.id);responder(res,200,s);return true;}
   const destino=String(resuelto);
   if(canal==='correo'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)||destino.length>254))throw new ErrorAPI(400,'Escribe tu correo.');
   let usuarioId:string|undefined;
   if(d.vincular===true){if(canal!=='whatsapp')throw new ErrorAPI(400,'Elige tu número.');const i=await jwt.verificar(token);
    let permitido=false;for(const n of config.salones)await enTransaccion(pool,i,n,async c=>{const m=await miembroVigente(c,n,i.usuarioId);if(m.rol==='admin'&&i.aal==='aal2')permitido=true;});
    if(!permitido)throw new ErrorAPI(403,'Vincula tu número desde tu cuenta con los dos pasos verificados.');usuarioId=i.usuarioId;
   }
   const s=await solicitudes.crear(canal,destino,config.ip(req),usuarioId);
   const payload=usuarioId?{phone:'+'+destino,channel:'sms'}:{...(canal==='whatsapp'?{phone:'+'+destino,channel:'sms'}:{email:destino}),create_user:false,...(d.captchaToken?{gotrue_meta_security:{captcha_token:String(d.captchaToken).slice(0,4096)}}:{})};
   let r;try{r=await auth(usuarioId?'user':'otp',payload,usuarioId?token:undefined,usuarioId?'PUT':'POST');}catch(e){await solicitudes.fallar(s.id);throw e;}
   if(!r.ok){await solicitudes.fallar(s.id);if(['user_not_found','otp_disabled','signup_disabled'].includes(r.data?.code||r.data?.error_code)){responder(res,200,s);return true;}throw new ErrorAPI(String(r.data?.code||r.data?.error_code||'').includes('rate_limit')?429:503,config.correo?'No se pudo enviar el código. Usa tu correo de respaldo o intenta más tarde.':'No se pudo enviar el código. Intenta más tarde.');}
   responder(res,200,{...s,...(usuarioId?{usuario:r.data}:{})});return true;
  }
  if(url.pathname==='/api/acceso/verificar'){
   const s=await solicitudes.intento(String(d.id||''),String(d.prueba||''),String(d.codigo||''));
   const destino=s.canal==='whatsapp'?(d.usuario!==undefined?await telefonoDeUsuario(d.usuario):telefonoMX(d.destino)):String(d.destino||'').trim().toLowerCase();
   if(!destino||!iguales(s.destino_hash,huella(config.key,'destino',destino))){await solicitudes.resultado(s.id,false);throw new ErrorAPI(400,'Código inválido.');}
   let i:IdentidadFirmada|undefined;if(s.tipo==='phone_change'){i=await jwt.verificar(token);if(i.usuarioId!==s.usuario_id||i.aal!=='aal2'){await solicitudes.resultado(s.id,false);throw new ErrorAPI(403,'Conserva la sesión que inició la vinculación.');}}
   let r;try{r=await auth('verify',{...(s.canal==='whatsapp'?{phone:'+'+destino}:{email:destino}),token:d.codigo,type:s.tipo},i?token:undefined);}catch(e){await solicitudes.resultado(s.id,false,true);throw e;}
   if(!r.ok){await solicitudes.resultado(s.id,false);throw new ErrorAPI(400,'Código inválido o vencido.');}
   let respuesta=r.data;
   if(i){
    const usuario=r.data.user||r.data;
    if(usuario.id!==i.usuarioId){await solicitudes.resultado(s.id,false,true);throw new ErrorAPI(403,'No se pudo conservar tu cuenta.');}
    if(r.data.access_token){
     try{const nueva=await jwt.verificar(r.data.access_token);if(nueva.usuarioId!==i.usuarioId)throw new Error();}
     catch{await solicitudes.resultado(s.id,false,true);throw new ErrorAPI(403,'No se pudo conservar tu cuenta.');}
    }
    // Auth puede emitir una sesión aal1 al verificar phone_change. No reemplazar
    // la sesión aal2 que autorizó el cambio ni admitir esa sesión secundaria.
    // El navegador refresca su propia sesión vigente para actualizar el teléfono.
    respuesta={user:usuario};
   }
   else {const identidad=await jwt.verificar(r.data.access_token);if(s.usuario_id&&s.usuario_id!==identidad.usuarioId)throw new ErrorAPI(403,'Cuenta distinta.');await solicitudes.admitir(identidad,config.registro?s.id:undefined);}
   await solicitudes.resultado(s.id,true);responder(res,200,respuesta);return true;
  }
  // Mantener el acceso de recuperación ya existente, verificándolo siempre con Auth.
  if(url.pathname==='/api/acceso/privado'){
   if(!/^[a-f0-9]{32,128}$/i.test(String(d.token_hash||''))||!config.recuperacionHash||!iguales(createHash('sha256').update(d.token_hash).digest('hex'),config.recuperacionHash))throw new ErrorAPI(400,'Enlace inválido o vencido.');
   await solicitudes.crear('correo',huella(config.key,'enlace',d.token_hash),config.ip(req));
   const r=await auth('verify',{token_hash:d.token_hash,type:'magiclink'});if(!r.ok)throw new ErrorAPI(400,'Enlace inválido o vencido.');
   const i=await jwt.verificar(r.data.access_token);if(i.usuarioId!==config.recuperacionUsuario)throw new ErrorAPI(403,'Enlace de otra cuenta.');await solicitudes.admitir(i);responder(res,200,r.data);return true;
  }
  throw new ErrorAPI(404,'Ruta no encontrada.');
 };
}
