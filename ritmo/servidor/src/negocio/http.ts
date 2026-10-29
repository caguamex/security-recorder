import type {IncomingMessage,ServerResponse} from 'node:http';
import type {ConexionSQL} from '../repositorio.js';
import type {IdentidadFirmada} from '../cuentas/jwt.js';
import {enTransaccion,miembroVigente} from '../cuentas/contexto.js';
import {ErrorAPI} from '../modelo.js';
import {validarHorario} from './horarios.js';
export async function cuerpoNegocio(req:IncomingMessage){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ErrorAPI(415,'Usa application/json.');let n=0;const chunks=[];for await(const b of req){n+=b.length;if(n>8192)throw new ErrorAPI(413,'Solicitud demasiado grande.');chunks.push(b);}try{const d=JSON.parse(Buffer.concat(chunks).toString());if(!d||typeof d!=='object'||Array.isArray(d))throw new Error();return d;}catch{throw new ErrorAPI(400,'Solicitud inválida.');}}
export function rutasNegocio(pool:ConexionSQL,jwt:{verificar:(s:string)=>Promise<IdentidadFirmada>},origen:string){return async(req:IncomingMessage,res:ServerResponse,url:URL)=>{
 const m=/^\/api\/negocios\/([a-f0-9-]{36})\/gestion\/(resumen|estadisticas|horarios|horario\/([a-f0-9-]{36}))$/.exec(url.pathname);if(!m)return false;
 if(url.search||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==origen||req.method!=='GET'&&req.headers.origin!==origen)throw new ErrorAPI(403,'Abre Agendappx para continuar.');
 const i=await jwt.verificar(req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'');
 const n=m[1],ruta=m[2];
 const respuesta=await enTransaccion(pool,i,n,async c=>{
  const miembro=await miembroVigente(c,n,i.usuarioId);const admin=miembro.rol==='admin'&&i.aal==='aal2';
  if(ruta==='resumen'&&req.method==='GET'){
   const enlace=(await c.query('SELECT slug FROM ritmo.negocios_enlaces WHERE negocio_id=$1',[n])).rows[0];
   return {rol:miembro.rol,usuarioId:i.usuarioId,perfilUrl:enlace?new URL('/'+enlace.slug,origen).href:null};
  }
  if(ruta==='estadisticas'&&req.method==='GET'){
   if(!admin)throw new ErrorAPI(403,'Las estadísticas son exclusivas de Admin.');
   const datos=(await c.query('SELECT data FROM ritmo.belleza_objetos WHERE negocio_id=$1 AND data IS NOT NULL',[n])).rows.map(r=>r.data);
   const servicios=new Map(datos.filter(d=>d.kind==='servicio').map(d=>[d.id,d]));const citas=datos.filter(d=>d.kind==='cita'&&!['cancelada','solicitada'].includes(d.estado));
   const hoy=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const suma=(arr:any[])=>Math.round(arr.reduce((a,c)=>a+Number(servicios.get(c.servicio)?.precio||0),0)*100)/100;
   return {hoy:{fecha:hoy,citas:citas.filter(c=>c.date===hoy).length,ingresosEstimados:suma(citas.filter(c=>c.date===hoy)),completadas:citas.filter(c=>c.date===hoy&&c.estado==='completada').length},mes:{citas:citas.filter(c=>c.date?.slice(0,7)===hoy.slice(0,7)).length,ingresosEstimados:suma(citas.filter(c=>c.date?.slice(0,7)===hoy.slice(0,7)))},visitasPerfil:null,meGusta:null};
  }
  if(ruta==='horarios'&&req.method==='GET'){
   const filas=(await c.query('SELECT usuario_id AS id,nombre,rol,servicios,horario FROM ritmo.miembros WHERE negocio_id=$1 AND activo ORDER BY nombre',[n])).rows;
   const especiales=(await c.query("SELECT usuario_id AS persona,fecha::text,tipo,desde,hasta FROM ritmo.horario_especial WHERE negocio_id=$1 AND fecha>=current_date-1 AND fecha<=current_date+370",[n])).rows;
   return {personas:filas,especiales,puedeEditarTodas:admin,propia:i.usuarioId};
  }
  if(m[3]&&req.method==='PUT'){
   if(!admin&&m[3]!==i.usuarioId)throw new ErrorAPI(403,'Solo puedes cambiar tu propio horario.');
   const d=await cuerpoNegocio(req);if(Object.keys(d).some(k=>!['horario','especiales'].includes(k)))throw new ErrorAPI(400,'Horario inválido.');const h=validarHorario(d.horario);
   if(!Array.isArray(d.especiales)||d.especiales.length>370)throw new ErrorAPI(400,'Revisa los días especiales.');
   for(const e of d.especiales){if(!e||Object.keys(e).some(k=>!['fecha','tipo','desde','hasta'].includes(k))||!/^\d{4}-\d{2}-\d{2}$/.test(e.fecha)||!Number.isFinite(Date.parse(e.fecha+'T12:00:00Z'))||new Date(e.fecha+'T12:00:00Z').toISOString().slice(0,10)!==e.fecha||!['libre','horario'].includes(e.tipo))throw new ErrorAPI(400,'Revisa los días especiales.');if(e.tipo==='horario')validarHorario({lun:[e.desde,e.hasta]});}
   if(new Set(d.especiales.map((e:any)=>e.fecha)).size!==d.especiales.length)throw new ErrorAPI(400,'Un día especial está repetido.');
   await c.query('SELECT ritmo.guardar_horario($1,$2,$3::jsonb,$4::jsonb)',[n,m[3],JSON.stringify(h),JSON.stringify(d.especiales)]);return {guardado:true};
  }
  throw new ErrorAPI(405,'Método no permitido.');
 });
 res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Authorization','Referrer-Policy':'no-referrer'}).end(JSON.stringify(respuesta));return true;
 };}
