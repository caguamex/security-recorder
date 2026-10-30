import type {IncomingMessage,ServerResponse} from 'node:http';
import type {ConexionSQL} from '../repositorio.js';
import type {IdentidadFirmada} from '../cuentas/jwt.js';
import {ErrorAPI} from '../modelo.js';
import {enTransaccion} from '../cuentas/contexto.js';

// Panel de Agendappx: solo administradores de la plataforma con MFA. La base vuelve a exigirlo en cada función.
const ACCIONES=['verificar','ocultar','extender_prueba','plan','suspender','reactivar'];
async function cuerpo(req:IncomingMessage){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ErrorAPI(415,'Usa application/json.');let tam=0;const partes=[];for await(const b of req){tam+=b.length;if(tam>2048)throw new ErrorAPI(413,'Solicitud demasiado grande.');partes.push(b);}try{const d=JSON.parse(Buffer.concat(partes).toString());if(!d||Array.isArray(d)||typeof d!=='object')throw new Error();return d;}catch{throw new ErrorAPI(400,'Solicitud inválida.');}}
export function rutasPlataforma(pool:ConexionSQL,jwt:{verificar:(s:string)=>Promise<IdentidadFirmada>},origenActual:()=>string){
 return async(req:IncomingMessage,res:ServerResponse,url:URL)=>{
  const ruta=url.pathname;if(!ruta.startsWith('/api/plataforma/'))return false;const origen=origenActual();
  if(url.search||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==origen||req.method!=='GET'&&req.headers.origin!==origen)throw new ErrorAPI(403,'Abre Agendappx para continuar.');
  const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'',i=await jwt.verificar(token);
  const responder=(d:unknown)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Authorization','Referrer-Policy':'no-referrer'}).end(JSON.stringify(d));return true;};
  const funcion=async(sql:string,args:unknown[]=[])=>{try{return await enTransaccion(pool,i,null,async c=>(await c.query(sql,args)).rows[0]?.r);}catch(e:any){if(e?.code==='42501')throw new ErrorAPI(403,'Este panel es solo para el administrador de Agendappx (con verificación en dos pasos).');if(e?.code==='22023')throw new ErrorAPI(400,String(e.message||'Datos inválidos.'));throw e;}};
  if(ruta==='/api/plataforma/yo'&&req.method==='GET')return responder({admin:await funcion('SELECT ritmo.es_admin_plataforma() AS r')===true});
  if(ruta==='/api/plataforma/resumen'&&req.method==='GET')return responder(await funcion('SELECT ritmo.plataforma_resumen() AS r'));
  if(ruta==='/api/plataforma/salones'&&req.method==='GET')return responder({salones:await funcion('SELECT ritmo.plataforma_salones() AS r')});
  if(ruta==='/api/plataforma/bitacora'&&req.method==='GET')return responder({bitacora:await funcion('SELECT ritmo.plataforma_bitacora_reciente() AS r')});
  const accion=/^\/api\/plataforma\/salones\/([a-f0-9-]{36})$/.exec(ruta);
  if(accion&&req.method==='POST'){const d=await cuerpo(req);if(!ACCIONES.includes(d.accion)||d.valor!==undefined&&(typeof d.valor!=='object'||Array.isArray(d.valor)||d.valor===null))throw new ErrorAPI(400,'Acción inválida.');
   return responder(await funcion('SELECT ritmo.plataforma_accion($1,$2,$3::jsonb) AS r',[accion[1],d.accion,JSON.stringify(d.valor||{})]));}
  throw new ErrorAPI(404,'Ruta no encontrada.');
 };
}
