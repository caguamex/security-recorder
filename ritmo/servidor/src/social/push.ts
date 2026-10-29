import webpush from 'web-push';
import type {ConexionSQL} from '../repositorio.js';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {IdentidadFirmada} from '../cuentas/jwt.js';
import {enTransaccion} from '../cuentas/contexto.js';
import {cuerpoNegocio} from '../negocio/http.js';
import {ErrorAPI} from '../modelo.js';
type Config={origen:string;publica?:string;privada?:string;fetch?:typeof fetch};
export function endpointPush(v:unknown){if(typeof v!=='string'||v.length>2048)return false;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['web.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com'].includes(u.hostname);}catch{return false;}}
export function validarSuscripcion(s:any){if(!s||!endpointPush(s.endpoint)||!s.keys||typeof s.keys.p256dh!=='string'||typeof s.keys.auth!=='string'||!/^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh)||!/^[A-Za-z0-9_-]{22}$/.test(s.keys.auth)||Buffer.from(s.keys.p256dh,'base64url')[0]!==4)throw new ErrorAPI(400,'Suscripción de avisos inválida.');return {endpoint:s.endpoint,expirationTime:null,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth}};}
const activo=(config:Config)=>!!config.publica&&!!config.privada;
export function rutasPush(pool:ConexionSQL,jwt:{verificar:(s:string)=>Promise<IdentidadFirmada>},config:Config){return async(req:IncomingMessage,res:ServerResponse,url:URL)=>{
 if(!url.pathname.startsWith('/api/avisos/'))return false;
 if(url.search||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==config.origen||req.method!=='GET'&&req.headers.origin!==config.origen)throw new ErrorAPI(403,'Abre Agendappx para continuar.');
 const responder=(d:any)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, no-store'}).end(JSON.stringify(d));return true;};
 if(req.method==='GET'&&url.pathname==='/api/avisos/config')return responder({habilitado:activo(config),llavePublica:activo(config)?config.publica:null});
 if(!activo(config))throw new ErrorAPI(503,'Los avisos están pendientes de configuración.');
 const i=await jwt.verificar(req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'');if(req.method!=='POST')throw new ErrorAPI(405,'Método no permitido.');const d=await cuerpoNegocio(req);
 try{await enTransaccion(pool,i,d.ambito==='negocio'?d.negocioId:null,async c=>{if(url.pathname==='/api/avisos/suscribir'){if(!['cliente','negocio'].includes(d.ambito))throw new ErrorAPI(400,'Elige el ámbito de los avisos.');const s=validarSuscripcion(d.suscripcion);await c.query('SELECT ritmo.guardar_push($1,$2,$3::jsonb)',[d.ambito,d.ambito==='negocio'?d.negocioId:null,JSON.stringify(s)]);}else if(url.pathname==='/api/avisos/quitar'){if(!endpointPush(d.endpoint))throw new ErrorAPI(400,'Suscripción inválida.');await c.query('SELECT ritmo.quitar_push($1)',[d.endpoint]);}else throw new ErrorAPI(405,'Acción no disponible.');});}catch(e:any){if(e instanceof ErrorAPI)throw e;if(e?.code==='42501')throw new ErrorAPI(403,'Tu cuenta no tiene permiso o tiene avisos de otra sesión.');if(e?.code==='28000')throw new ErrorAPI(401,'Verifica tu WhatsApp primero.');if(e?.code==='22023')throw new ErrorAPI(400,'Revisa los dispositivos de avisos.');throw e;}
 return responder({guardado:true});
};}
export async function enviarPush(pool:ConexionSQL,config:Config){if(!activo(config))return {intentados:0};const usar=async(sql:string,args:unknown[]=[])=>{const c=await pool.connect();try{return await c.query(sql,args);}finally{c.release();}};const jobs=(await usar('SELECT ritmo.tomar_push() AS pendientes')).rows[0].pendientes;let intentados=0;
 for(const job of jobs){let bien=false,caducada=false;try{const s=validarSuscripcion(job.suscripcion);const detalles=webpush.generateRequestDetails(s,JSON.stringify({titulo:'Agendappx',texto:'Hay una novedad en tu agenda. Abre la app para verla.',url:job.url,etiqueta:job.id}),{TTL:3600,urgency:'normal',vapidDetails:{subject:config.origen,publicKey:config.publica,privateKey:config.privada}});const r=await(config.fetch||fetch)(detalles.endpoint,{method:'POST',headers:detalles.headers,body:new Uint8Array(detalles.body),redirect:'error',signal:AbortSignal.timeout(8000)});bien=r.status===201||r.status===202;caducada=r.status===404||r.status===410;}catch{/* Un resultado incierto no se reenvía. No registrar endpoints, claves ni contenido. */}await usar('SELECT ritmo.terminar_push($1,$2,$3)',[job.id,bien,caducada]);intentados++;}return {intentados};
}
