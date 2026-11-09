import type {IncomingMessage,ServerResponse} from 'node:http';
import type {ConexionSQL} from '../repositorio.js';
import type {IdentidadFirmada} from '../cuentas/jwt.js';
import {enTransaccion,miembroVigente} from '../cuentas/contexto.js';
import {ErrorAPI} from '../modelo.js';
import {cuerpoNegocio} from '../negocio/http.js';
import {PLANES,precioPlan,diasRestantes,errorPlan} from './catalogo.js';
export function rutasPlanes(pool:ConexionSQL,jwt:{verificar:(s:string)=>Promise<IdentidadFirmada>},origen:string){return async(req:IncomingMessage,res:ServerResponse,url:URL)=>{
 const publico=url.pathname==='/api/planes/catalogo',m=/^\/api\/negocios\/([a-f0-9-]{36})\/plan(?:\/(elegir|factura))?$/.exec(url.pathname);if(!publico&&!m)return false;
 const responder=(d:unknown)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Authorization','Referrer-Policy':'no-referrer'}).end(JSON.stringify(d));return true;};
 if(url.search||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==origen||req.method!=='GET'&&req.headers.origin!==origen)throw new ErrorAPI(403,'Abre Agendappx para continuar.');
 if(publico){if(req.method!=='GET')throw new ErrorAPI(405,'Método no permitido.');const c=await pool.connect();try{return responder({planes:PLANES,moneda:'MXN',ivaIncluido:true,pruebaDias:30,cobrosHabilitados:false,fundadoras:{total:20,disponibles:Number((await c.query('SELECT ritmo.cupos_fundadoras() AS n')).rows[0].n),mensual:199}});}finally{c.release();}}
 const i=await jwt.verificar(req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):''),n=m![1];
 try{return responder(await enTransaccion(pool,i,n,async c=>{
  const miembro=await miembroVigente(c,n,i.usuarioId);if(miembro.rol!=='admin'||i.aal!=='aal2')throw new ErrorAPI(403,'Mi plan es exclusivo de Admin con dos pasos.');
  if(req.method==='GET'&&!m![2]){
   const p=(await c.query('SELECT plan,estado,prueba_inicio,prueba_fin,anual,elegido_en,fundadora_numero,factura FROM ritmo.negocios_planes WHERE negocio_id=$1',[n])).rows[0];if(!p)throw new ErrorAPI(503,'El plan está pendiente de preparar.');
   const equipo=(await c.query("SELECT count(*) AS personas,count(*) FILTER(WHERE rol='admin') AS admins FROM ritmo.miembros WHERE negocio_id=$1 AND activo",[n])).rows[0];
   const wa=(await c.query("SELECT count(*) AS n FROM ritmo.whatsapp_conexiones WHERE negocio_id=$1 AND estado='conectado'",[n])).rows[0];const mes=(await c.query("SELECT count(*) AS n FROM ritmo.whatsapp_envios WHERE negocio_id=$1 AND intento_en>=date_trunc('month',now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City'",[n])).rows[0];
   const info=PLANES.find(v=>v.id===p.plan)!;return {...p,nombre:p.estado==='legado'?'Acceso existente':info.nombre,estado:p.estado==='prueba'&&new Date(p.prueba_fin).getTime()<=Date.now()?'pausada':p.estado,diasRestantes:diasRestantes(p.prueba_fin),precio:precioPlan(p.plan,p.anual,!!p.fundadora_numero),moneda:'MXN',cobrosHabilitados:false,uso:{personas:Number(equipo.personas),admins:Number(equipo.admins),whatsapp:Number(wa.n),mensajes:Number(mes.n)},limites:{personas:p.estado==='legado'?null:info.personas,admins:p.estado==='legado'?null:info.admins,mensajes:600},pagos:[]};
  }
  if(req.method==='POST'&&m![2]==='elegir'){const d=await cuerpoNegocio(req);if(Object.keys(d).some(k=>!['plan','anual'].includes(k))||!PLANES.some(p=>p.id===d.plan)||typeof d.anual!=='boolean')throw new ErrorAPI(400,'Plan inválido.');await c.query('SELECT ritmo.elegir_plan($1,$2,$3)',[n,d.plan,d.anual]);return {guardado:true,cobrado:false};}
  if(req.method==='PUT'&&m![2]==='factura'){const d=await cuerpoNegocio(req);if(Object.keys(d).some(k=>!['rfc','razonSocial','codigoPostal','regimen','usoCFDI','correo'].includes(k))||Object.values(d).some(v=>typeof v!=='string'||v.length>250))throw new ErrorAPI(400,'Revisa los datos fiscales.');if(d.rfc&&!/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(d.rfc)||d.codigoPostal&&!/^\d{5}$/.test(d.codigoPostal)||d.correo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo))throw new ErrorAPI(400,'Revisa RFC, código postal y correo.');await c.query('SELECT ritmo.guardar_factura_plan($1,$2::jsonb)',[n,JSON.stringify(d)]);return {guardado:true,facturado:false};}
  throw new ErrorAPI(405,'Método no permitido.');
 }));}catch(e:any){const p=errorPlan(e);if(p)throw new ErrorAPI(p.status,p.mensaje);if(e?.code==='22023')throw new ErrorAPI(400,'Tu acceso existente se conserva o el plan no está disponible.');throw e;}
 };}
