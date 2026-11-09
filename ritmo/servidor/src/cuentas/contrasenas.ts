import {randomInt,randomUUID,createHmac} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {ConexionSQL,ClienteSQL} from '../repositorio.js';
import type {IdentidadFirmada} from './jwt.js';
import {ErrorAPI} from '../modelo.js';
import {enTransaccion,miembroVigente} from './contexto.js';
import {huella,telefonoMX} from './acceso.js';

// Las contraseñas solo pasan por aquí hacia Supabase Auth; nunca se guardan ni se registran.
export const DOMINIO_MIEMBROS='agendappx.invalid';
const correoMiembro=/^miembro-[a-f0-9-]{36}@agendappx\.invalid$/;
const VENTANA=15*60000,MAX_CUENTA=5,MAX_RED=20,CAPTCHA_DESDE=3,TEMPORAL=72*3600000;
const COMUNES=new Set(['12345678','123456789','1234567890','password','password1','contraseña','contrasena','qwerty123','11111111','00000000','abc12345','12341234','87654321','iloveyou','admin123','mexico123','agendappx','agendappx1','salon123','belleza1']);
const PALABRAS=['rosa','luna','sol','mar','cielo','flor','nube','perla','coral','miel','canela','menta','lima','olivo','jade','brisa','aurora','estrella','palma','salvia','nardo','lirio','dalia','orquidea','violeta','azul','ambar','cobre','plata','seda','lino','alba'];

export function normalizarUsuario(v:unknown){const u=String(v||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._]{2,19}$/.test(u))throw new ErrorAPI(400,'El usuario lleva de 3 a 20 letras, números, punto o guion bajo.');return u;}
export function revisarContrasena(p:unknown,usuario=''){
 if(typeof p!=='string'||p.length<8)return 'Usa mínimo 8 caracteres.';
 if(p.length>72)return 'Usa máximo 72 caracteres.';
 if(!/\p{L}/u.test(p)||!/\d/.test(p))return 'Incluye al menos una letra y un número.';
 const baja=p.toLowerCase();if(COMUNES.has(baja)||/^(.)\1+$/.test(p))return 'Esa contraseña es muy común. Elige otra.';
 if(usuario&&baja.includes(usuario.toLowerCase()))return 'No uses tu usuario dentro de la contraseña.';
 return null;
}
/** Fácil de dictar y con suficiente azar para 72 horas con bloqueo por intentos. */
export function contrasenaTemporal(){const p=()=>{const w=PALABRAS[randomInt(PALABRAS.length)];return w[0].toUpperCase()+w.slice(1);};return [p(),p(),String(randomInt(100,1000)),p()].join('-');}

export async function usuarioLibre(c:ClienteSQL,usuario:string,ahora:Date){return !(await c.query('SELECT 1 FROM ritmo.usuarios_acceso WHERE usuario=$1 UNION ALL SELECT 1 FROM ritmo.usuarios_apartados WHERE usuario=$1 AND vence_en>$2',[usuario,ahora])).rows.length;}
/** Dentro de la transacción del registro: aparta el usuario hasta que venza el ticket. */
export async function apartarUsuario(c:ClienteSQL,usuario:string,registroId:string,vence:Date,ahora:Date){
 await c.query('DELETE FROM ritmo.usuarios_apartados WHERE usuario=$1 AND vence_en<=$2',[usuario,ahora]);
 if(!await usuarioLibre(c,usuario,ahora))throw new ErrorAPI(409,'Ese usuario ya está ocupado. Elige otro.');
 await c.query('INSERT INTO ritmo.usuarios_apartados(usuario,registro_id,vence_en) VALUES($1,$2,$3)',[usuario,registroId,vence]);
}
type Config={habilitado:boolean;key:string;operacionKey:string;turnstileKey:string;origen:string;supabaseURL:string;llavePublica:string;ip:(r:IncomingMessage)=>string;fetch?:typeof fetch;ahora?:()=>number};
type Jwt={verificar:(s:string)=>Promise<IdentidadFirmada>};

export class Contrasenas{
 readonly red:typeof fetch;readonly ahora:()=>number;
 constructor(readonly pool:ConexionSQL,readonly jwt:Jwt,readonly config:Config){this.red=config.fetch||fetch.bind(globalThis);this.ahora=config.ahora||Date.now;}
 async usar<T>(f:(c:ClienteSQL)=>Promise<T>){const c=await this.pool.connect();try{return await f(c);}finally{c.release();}}
 async auth(path:string,d:unknown,token?:string,metodo='POST'){
  let r;try{r=await this.red(this.config.supabaseURL+'/auth/v1/'+path,{method:metodo,headers:{apikey:this.config.llavePublica,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(d===undefined?{}:{body:JSON.stringify(d)}),signal:AbortSignal.timeout(15000)});}catch{throw new ErrorAPI(503,'No se pudo verificar el acceso. Intenta de nuevo.');}
  let data:any={};try{data=await r.json();}catch{}return {ok:r.ok,status:r.status,data};
 }
 async disponible(usuario:string,c?:ClienteSQL){return c?usuarioLibre(c,usuario,new Date(this.ahora())):this.usar(c=>usuarioLibre(c,usuario,new Date(this.ahora())));}
 async fallos(claves:string[]){return this.usar(async c=>{const desde=new Date(this.ahora()-VENTANA);await c.query('DELETE FROM ritmo.contrasena_fallos WHERE en<$1',[new Date(this.ahora()-86400000)]);const r=(await c.query('SELECT clave_hash,count(*)::int AS n FROM ritmo.contrasena_fallos WHERE clave_hash=ANY($1) AND en>$2 GROUP BY clave_hash',[claves,desde])).rows;return Object.fromEntries(r.map((x:any)=>[x.clave_hash,x.n]));});}
 async captcha(token:unknown,ip:string){
  if(typeof token!=='string'||!token||token.length>4096)throw new ErrorAPI(428,'Completa la verificación de seguridad.');
  let r:any;try{const res=await this.red('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:this.config.turnstileKey,response:token,remoteip:ip}),signal:AbortSignal.timeout(8000)});if(!res.ok)throw new Error();r=await res.json();}catch{throw new ErrorAPI(503,'No se pudo comprobar la seguridad. Intenta de nuevo.');}
  if(!r.success||r.hostname!==new URL(this.config.origen).hostname||r.action!=='acceso')throw new ErrorAPI(428,'Vuelve a completar la verificación de seguridad.');
 }
 /** Entrar con WhatsApp o usuario y contraseña. Mismo mensaje si la cuenta no existe. */
 async entrar(d:any,ip:string){
  if(!ip||ip.length>200)throw new ErrorAPI(503,'No se pudo verificar la conexión.');
  const cuenta=String(d.cuenta||'').trim();if(!cuenta||cuenta.length>40||typeof d.contrasena!=='string'||!d.contrasena||d.contrasena.length>72)throw new ErrorAPI(400,'Escribe tu usuario o WhatsApp y tu contraseña.');
  const esTelefono=/^\+?[\d ()-]{10,}$/.test(cuenta);let destino:any,fila:any=null,clave:string;
  if(esTelefono){const tel=telefonoMX(cuenta);destino={phone:'+'+tel};clave='tel:'+tel;}
  else{const u=cuenta.toLowerCase();clave='usuario:'+u;if(/^[a-z0-9][a-z0-9._]{2,19}$/.test(u))fila=await this.usar(async c=>(await c.query('SELECT * FROM ritmo.identificador_acceso($1)',[u])).rows[0]||null);
   if(fila)destino=fila.phone?{phone:'+'+String(fila.phone).replace(/^\+/,'')}:fila.email?{email:fila.email}:null;}
  const kCuenta=huella(this.config.key,'contrasena-cuenta',clave),kRed=huella(this.config.key,'contrasena-red',ip),f=await this.fallos([kCuenta,kRed]);
  if((f[kCuenta]||0)>=MAX_CUENTA||(f[kRed]||0)>=MAX_RED)throw new ErrorAPI(429,'Demasiados intentos. Espera 15 minutos o entra con código de WhatsApp.');
  if((f[kCuenta]||0)>=CAPTCHA_DESDE)await this.captcha(d.captchaToken,ip);
  const fallar=async()=>{await this.usar(c=>c.query('INSERT INTO ritmo.contrasena_fallos(clave_hash,en) VALUES($1,$3),($2,$3)',[kCuenta,kRed,new Date(this.ahora())]));const n=(f[kCuenta]||0)+1;throw new ErrorAPI(400,n>=CAPTCHA_DESDE?'Usuario o contraseña incorrectos. Completa la verificación para seguir.':'Usuario o contraseña incorrectos.');};
  if(!destino)return fallar();
  const r=await this.auth('token?grant_type=password',{...destino,password:d.contrasena});
  if(!r.ok){if(String(r.data?.error_code||r.data?.code||'').includes('rate_limit'))throw new ErrorAPI(429,'Demasiados intentos. Espera unos minutos.');return fallar();}
  const i=await this.jwt.verificar(r.data.access_token);
  if(!fila&&esTelefono)fila=await this.usar(async c=>(await c.query('SELECT usuario_id,debe_cambiar,temporal_vence FROM ritmo.usuarios_acceso WHERE usuario_id=$1',[i.usuarioId])).rows[0]||null);
  if(fila&&fila.usuario_id!==i.usuarioId)throw new ErrorAPI(403,'No se pudo verificar tu cuenta.');
  await this.usar(c=>c.query('DELETE FROM ritmo.contrasena_fallos WHERE clave_hash=$1',[kCuenta]));
  if(fila?.debe_cambiar){
   if(new Date(fila.temporal_vence).getTime()<=this.ahora()){await this.auth('logout',undefined,r.data.access_token);throw new ErrorAPI(400,'Tu contraseña temporal venció. Pide a tu Admin una nueva.');}
   // Sesión sin admitir: solo sirve para cambiar la contraseña temporal.
   return {...r.data,cambiarContrasena:true};
  }
  await this.usar(c=>c.query('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[i.sesionId,i.usuarioId]));
  return r.data;
 }
 /** Crear o cambiar la contraseña de la sesión actual (registro, código de WhatsApp o temporal). */
 async cambiar(token:string,d:any){
  const i=await this.jwt.verificar(token);const ahora=new Date(this.ahora());
  const estado=await this.usar(async c=>({fila:(await c.query('SELECT * FROM ritmo.usuarios_acceso WHERE usuario_id=$1',[i.usuarioId])).rows[0]||null,
   sesion:(await c.query('SELECT solicitud_otp,creado_en FROM ritmo.acceso_sesiones WHERE sesion_id=$1 AND usuario_id=$2',[i.sesionId,i.usuarioId])).rows[0]||null}));
  const {fila,sesion}=estado;let usuario=fila?.usuario as string|undefined;
  if(fila?.debe_cambiar){if(new Date(fila.temporal_vence).getTime()<=this.ahora())throw new ErrorAPI(400,'Tu contraseña temporal venció. Pide a tu Admin una nueva.');}
  else if(!sesion)throw new ErrorAPI(401,'Inicia sesión de nuevo.');
  else if(fila?.con_contrasena&&!(sesion.solicitud_otp&&new Date(sesion.creado_en).getTime()>this.ahora()-VENTANA))throw new ErrorAPI(403,'Para cambiar tu contraseña, entra con un código de WhatsApp.');
  if(!fila){usuario=normalizarUsuario(d.usuario);
   const libre=await this.usar(async c=>{const a=(await c.query('SELECT r.usuario_id FROM ritmo.usuarios_apartados a JOIN ritmo.registro_solicitudes r ON r.id=a.registro_id WHERE a.usuario=$1',[usuario])).rows[0];return a?a.usuario_id===i.usuarioId:await this.disponible(usuario!,c);});
   if(!libre)throw new ErrorAPI(409,'Ese usuario ya está ocupado. Elige otro.');}
  const problema=revisarContrasena(d.contrasena,usuario);if(problema)throw new ErrorAPI(400,problema);
  const r=await this.auth('user',{password:d.contrasena},token,'PUT');
  if(!r.ok){const code=String(r.data?.error_code||r.data?.code||'');
   if(code==='same_password')throw new ErrorAPI(400,'Usa una contraseña distinta a la anterior.');
   if(code==='weak_password')throw new ErrorAPI(400,'Esa contraseña es muy débil. Elige otra.');
   if(code==='reauthentication_needed')throw new ErrorAPI(403,'Para cambiar tu contraseña, entra con un código de WhatsApp.');
   if(code==='insufficient_aal')throw new ErrorAPI(403,'Completa la verificación en dos pasos antes de cambiar tu contraseña.');
   throw new ErrorAPI(503,'No se pudo guardar la contraseña. Intenta de nuevo.');}
  await this.usar(async c=>{
   if(fila)await c.query('UPDATE ritmo.usuarios_acceso SET con_contrasena=true,debe_cambiar=false,temporal_vence=NULL,actualizado_en=$2 WHERE usuario_id=$1',[i.usuarioId,ahora]);
   else{await c.query('INSERT INTO ritmo.usuarios_acceso(usuario_id,usuario,con_contrasena) VALUES($1,$2,true)',[i.usuarioId,usuario]);await c.query('DELETE FROM ritmo.usuarios_apartados WHERE usuario=$1',[usuario]);}
   if(fila?.debe_cambiar)await c.query('INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[i.sesionId,i.usuarioId]);
  });
  // Cierra las demás sesiones; la actual sigue abierta.
  const fuera=await this.auth('logout?scope=others',undefined,token);
  return {guardada:true,usuario,otrasSesionesCerradas:fuera.ok};
 }
 async firmarIntermediario(proposito:string,cuerpo:object){
  const raw=JSON.stringify(cuerpo),ts=String(Math.floor(this.ahora()/1000));
  const firma=createHmac('sha256',Buffer.from(this.config.operacionKey,'base64')).update(proposito+'\0'+ts+'\0'+raw).digest('hex');
  let r;try{r=await this.red(this.config.supabaseURL+'/functions/v1/agendappx-registro',{method:'POST',headers:{'Content-Type':'application/json','x-registro-fecha':ts,'x-registro-firma':firma,'x-registro-proposito':proposito},body:raw,signal:AbortSignal.timeout(12000)});}catch{throw new ErrorAPI(503,'No se pudo preparar el acceso. Intenta más tarde.');}
  let data:any={};try{data=await r.json();}catch{}if(!r.ok)throw new ErrorAPI(r.status===409?409:503,r.status===409?'Esa cuenta ya existe.':'No se pudo preparar el acceso. Intenta más tarde.');return data;
 }
 /** Admin crea a una persona del equipo con usuario y contraseña temporal (sin WhatsApp). */
 async crearMiembro(i:IdentidadFirmada,n:string,d:any){
  if(i.aal!=='aal2')throw new ErrorAPI(403,'Completa la verificación en dos pasos.');
  if(Object.keys(d).some(k=>!['nombre','usuario','rol'].includes(k)))throw new ErrorAPI(400,'Datos inválidos.');
  const nombre=String(d.nombre||'').trim();if(!nombre||nombre.length>200)throw new ErrorAPI(400,'Escribe el nombre de la persona.');
  if(!['recepcion','especialista'].includes(d.rol))throw new ErrorAPI(400,'Elige Recepción o Especialista. Admin se agrega con invitación.');
  const usuario=normalizarUsuario(d.usuario);
  await enTransaccion(this.pool,i,n,async c=>{const m=await miembroVigente(c,n,i.usuarioId);if(m.rol!=='admin')throw new ErrorAPI(403,'Solo Admin puede administrar el equipo.');
   if(!await this.disponible(usuario,c))throw new ErrorAPI(409,'Ese usuario ya está ocupado. Elige otro.');
   // Revisa el cupo del plan antes de crear la cuenta en Auth; el disparador lo vuelve a exigir al dar de alta.
   // Sin plan o con plan heredado no hay límite, igual que el disparador limite_miembros_plan.
   const p=(await c.query("SELECT (SELECT plan FROM ritmo.negocios_planes WHERE negocio_id=$1 AND estado<>'legado') AS plan,(SELECT count(*) FROM ritmo.miembros WHERE negocio_id=$1 AND activo)::int+(SELECT count(*) FROM ritmo.invitaciones WHERE negocio_id=$1 AND usada_en IS NULL AND revocada_en IS NULL AND vence_en>now())::int AS personas",[n])).rows[0];
   if(p.plan&&p.personas+1>(p.plan==='solo'?1:p.plan==='salon'?5:Infinity))throw new ErrorAPI(402,'Tu equipo está completo para tu plan.');});
  const temporal=contrasenaTemporal(),correo='miembro-'+randomUUID()+'@'+DOMINIO_MIEMBROS;
  const creada=await this.firmarIntermediario('alta-miembro-v1',{email:correo,password:temporal});
  if(!/^[a-f0-9-]{36}$/i.test(String(creada.usuario||'')))throw new ErrorAPI(503,'No se pudo preparar el acceso. Intenta más tarde.');
  const vence=new Date(this.ahora()+TEMPORAL);
  try{await enTransaccion(this.pool,i,n,c=>c.query('SELECT ritmo.alta_miembro_usuario($1,$2,$3,$4,$5,$6)',[n,creada.usuario,nombre,d.rol,usuario,vence]));}
  catch(e:any){if(e?.code==='23505')throw new ErrorAPI(409,'Ese usuario ya está ocupado. Elige otro.');if(e?.code==='P0001')throw new ErrorAPI(402,String(e.message).includes('prueba')?'Tu prueba gratis terminó. Elige un plan para agregar personas.':'Tu equipo está completo para tu plan.');throw e;}
  return {usuario,contrasenaTemporal:temporal,venceEn:vence.toISOString(),id:creada.usuario};
 }
 /** Admin da una contraseña temporal nueva a una cuenta del equipo sin WhatsApp y cierra sus sesiones. */
 async nuevaTemporal(i:IdentidadFirmada,n:string,u:string){
  if(i.aal!=='aal2')throw new ErrorAPI(403,'Completa la verificación en dos pasos.');
  if(u===i.usuarioId)throw new ErrorAPI(403,'Cambia tu propia contraseña desde tu cuenta.');
  const fila=await enTransaccion(this.pool,i,n,async c=>{const m=await miembroVigente(c,n,i.usuarioId);if(m.rol!=='admin')throw new ErrorAPI(403,'Solo Admin puede administrar el equipo.');
   return (await c.query('SELECT a.usuario FROM ritmo.usuarios_acceso a JOIN ritmo.miembros m ON m.usuario_id=a.usuario_id AND m.negocio_id=$1 AND m.activo WHERE a.usuario_id=$2 AND a.negocio_id=$1 AND a.creada_por IS NOT NULL',[n,u])).rows[0];});
  if(!fila)throw new ErrorAPI(404,'Esa persona entra con su WhatsApp: puede restablecer su contraseña con un código.');
  const temporal=contrasenaTemporal(),vence=new Date(this.ahora()+TEMPORAL);
  await this.firmarIntermediario('contrasena-miembro-v1',{usuario:u,password:temporal});
  await enTransaccion(this.pool,i,n,async c=>{await c.query('UPDATE ritmo.usuarios_acceso SET debe_cambiar=true,temporal_vence=$3,actualizado_en=now() WHERE usuario_id=$1 AND negocio_id=$2',[u,n,vence]);await c.query('SELECT ritmo.revocar_sesiones_miembro($1,$2)',[n,u]);});
  return {usuario:fila.usuario,contrasenaTemporal:temporal,venceEn:vence.toISOString()};
 }
 /** Para la lista del equipo: cómo entra cada persona. */
 async accesosEquipo(i:IdentidadFirmada,n:string){return enTransaccion(this.pool,i,n,async c=>{const m=await miembroVigente(c,n,i.usuarioId);if(m.rol!=='admin')throw new ErrorAPI(403,'Solo Admin puede administrar el equipo.');
  return {accesos:(await c.query('SELECT a.usuario_id AS id,a.usuario,(a.creada_por IS NOT NULL) AS sin_whatsapp,a.debe_cambiar FROM ritmo.usuarios_acceso a JOIN ritmo.miembros m ON m.usuario_id=a.usuario_id AND m.negocio_id=$1 AND m.activo',[n])).rows};});}
 async miCuenta(token:string){const i=await this.jwt.verificar(token);return this.usar(async c=>{const f=(await c.query('SELECT usuario,con_contrasena,debe_cambiar FROM ritmo.usuarios_acceso WHERE usuario_id=$1',[i.usuarioId])).rows[0];return f?{usuario:f.usuario,conContrasena:f.con_contrasena,debeCambiar:f.debe_cambiar}:{usuario:null,conContrasena:false,debeCambiar:false};});}
}

async function cuerpo(req:IncomingMessage){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ErrorAPI(415,'Usa application/json.');let tam=0;const partes=[];for await(const b of req){tam+=b.length;if(tam>4096)throw new ErrorAPI(413,'Solicitud demasiado grande.');partes.push(b);}try{const d=JSON.parse(Buffer.concat(partes).toString());if(!d||Array.isArray(d)||typeof d!=='object')throw new Error();return d;}catch{throw new ErrorAPI(400,'Solicitud inválida.');}}
export function rutasContrasenas(pool:ConexionSQL,jwt:Jwt,config:Config){
 const c=new Contrasenas(pool,jwt,config);
 return async(req:IncomingMessage,res:ServerResponse,url:URL)=>{
  const ruta=url.pathname,equipo=/^\/api\/negocios\/([a-f0-9-]{36})\/miembros\/(?:(usuario|accesos)|([a-f0-9-]{36})\/contrasena)$/.exec(ruta);
  if(!['/api/acceso/contrasena','/api/acceso/usuario-disponible','/api/cuenta/contrasena','/api/cuenta/acceso'].includes(ruta)&&!equipo)return false;
  if(!config.habilitado||!config.key||!config.operacionKey)throw new ErrorAPI(503,'El acceso con contraseña todavía no está activado.');
  // Como en el registro: un GET del mismo sitio puede llegar sin Origin; todo lo demás lo exige.
  if(url.search||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==config.origen||req.method!=='GET'&&req.headers.origin!==config.origen)throw new ErrorAPI(403,'Abre Agendappx para continuar.');
  const responder=(d:unknown)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}).end(JSON.stringify(d));return true;};
  const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
  if(ruta==='/api/cuenta/acceso'&&req.method==='GET')return responder(await c.miCuenta(token));
  if(req.method!=='POST')throw new ErrorAPI(405,'Método no permitido.');
  const d=await cuerpo(req);
  if(ruta==='/api/acceso/contrasena')return responder(await c.entrar(d,config.ip(req)));
  if(ruta==='/api/acceso/usuario-disponible')return responder({disponible:await c.disponible(normalizarUsuario(d.usuario))});
  if(ruta==='/api/cuenta/contrasena')return responder(await c.cambiar(token,d));
  const i=await jwt.verificar(token);
  if(equipo![2]==='usuario')return responder(await c.crearMiembro(i,equipo![1],d));
  if(equipo![2]==='accesos')return responder(await c.accesosEquipo(i,equipo![1]));
  return responder(await c.nuevaTemporal(i,equipo![1],equipo![3]));
 };
}
