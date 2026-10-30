import type {IncomingMessage,ServerResponse} from 'node:http';
import type {ConexionSQL} from '../repositorio.js';
import type {IdentidadFirmada} from '../cuentas/jwt.js';
import {ErrorAPI} from '../modelo.js';
import {enTransaccion} from '../cuentas/contexto.js';
import {avisarCodigos,avisoValido,descifrarCodigo,telefonoOculto} from './codigos.js';

// Panel de Agendappx: dueño reservado con sesión validada por WhatsApp. La base lo exige en cada función.
const ACCIONES=['verificar','ocultar','extender_prueba','plan','suspender','reactivar'];
async function cuerpo(req:IncomingMessage){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ErrorAPI(415,'Usa application/json.');let tam=0;const partes=[];for await(const b of req){tam+=b.length;if(tam>2048)throw new ErrorAPI(413,'Solicitud demasiado grande.');partes.push(b);}try{const d=JSON.parse(Buffer.concat(partes).toString());if(!d||Array.isArray(d)||typeof d!=='object')throw new Error();return d;}catch{throw new ErrorAPI(400,'Solicitud inválida.');}}
type Opciones={key?:string;publica?:string;privada?:string;fetch?:typeof fetch};
export function rutasPlataforma(pool:ConexionSQL,jwt:{verificar:(s:string)=>Promise<IdentidadFirmada>},origenActual:()=>string,opciones:Opciones={}){
 return async(req:IncomingMessage,res:ServerResponse,url:URL)=>{
  const ruta=url.pathname;if(!ruta.startsWith('/api/plataforma/'))return false;const origen=origenActual();
  // Aviso del servicio de WhatsApp (servidor a servidor, firmado): manda la notificación al celular del administrador.
  if(ruta==='/api/plataforma/aviso-codigo'&&req.method==='POST'){if(!opciones.key||!avisoValido(opciones.key,req.headers['x-aviso-fecha'],req.headers['x-aviso-firma']))throw new ErrorAPI(401,'Aviso inválido.');
   const r=await avisarCodigos(pool,{origen,publica:opciones.publica,privada:opciones.privada,fetch:opciones.fetch});res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(r));return true;}
  if(url.search||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==origen||req.method!=='GET'&&req.headers.origin!==origen)throw new ErrorAPI(403,'Abre Agendappx para continuar.');
  const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'',i=await jwt.verificar(token);
  const responder=(d:unknown)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Authorization','Referrer-Policy':'no-referrer'}).end(JSON.stringify(d));return true;};
  const funcion=async(sql:string,args:unknown[]=[])=>{try{return await enTransaccion(pool,i,null,async c=>(await c.query(sql,args)).rows[0]?.r);}catch(e:any){if(e?.code==='42501')throw new ErrorAPI(403,'Este panel es solo para el dueño de Agendappx. Entra con su código de WhatsApp.');if(e?.code==='22023')throw new ErrorAPI(400,String(e.message||'Datos inválidos.'));throw e;}};
  if(ruta==='/api/plataforma/yo'&&req.method==='GET')return responder({admin:await funcion('SELECT ritmo.es_admin_plataforma() AS r')===true});
  if(ruta==='/api/plataforma/resumen'&&req.method==='GET')return responder(await funcion('SELECT ritmo.plataforma_resumen() AS r'));
  if(ruta==='/api/plataforma/salones'&&req.method==='GET')return responder({salones:await funcion('SELECT ritmo.plataforma_salones() AS r')});
  if(ruta==='/api/plataforma/bitacora'&&req.method==='GET')return responder({bitacora:await funcion('SELECT ritmo.plataforma_bitacora_reciente() AS r')});
  if(ruta==='/api/plataforma/codigos'&&req.method==='GET'){if(!opciones.key)return responder({codigos:[],activo:false});const lista=await funcion('SELECT ritmo.plataforma_codigos() AS r'),activo=await funcion('SELECT ritmo.plataforma_respaldo_activo() AS r')===true;
   return responder({activo,codigos:lista.map((x:any)=>{let tel='';try{tel=telefonoOculto(descifrarCodigo(opciones.key!,x.cifrado).telefono);}catch{}const {cifrado,...resto}=x;return {...resto,telefono:tel};})});}
  const codigo=/^\/api\/plataforma\/codigos\/([a-f0-9-]{36})\/(ver|entregado)$/.exec(ruta);
  if(codigo&&req.method==='POST'){if(!opciones.key)throw new ErrorAPI(503,'El respaldo de códigos no está configurado.');
   if(codigo[2]==='entregado'){await funcion('SELECT ritmo.plataforma_codigo_entregado($1) AS r',[codigo[1]]);return responder({entregado:true});}
   const d=descifrarCodigo(opciones.key,await funcion('SELECT ritmo.plataforma_revelar_codigo($1) AS r',[codigo[1]]));
   const mensaje='Tu código de Agendappx es *'+d.codigo+'*. Vence en 10 minutos. No lo compartas con nadie.';
   return responder({codigo:d.codigo,telefono:'+'+d.telefono,mensaje,whatsapp:'https://wa.me/'+d.telefono+'?text='+encodeURIComponent(mensaje)});}
  const accion=/^\/api\/plataforma\/salones\/([a-f0-9-]{36})$/.exec(ruta);
  if(accion&&req.method==='POST'){const d=await cuerpo(req);if(!ACCIONES.includes(d.accion)||d.valor!==undefined&&(typeof d.valor!=='object'||Array.isArray(d.valor)||d.valor===null))throw new ErrorAPI(400,'Acción inválida.');
   return responder(await funcion('SELECT ritmo.plataforma_accion($1,$2,$3::jsonb) AS r',[accion[1],d.accion,JSON.stringify(d.valor||{})]));}
  throw new ErrorAPI(404,'Ruta no encontrada.');
 };
}
