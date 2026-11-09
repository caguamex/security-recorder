import type {IncomingMessage,ServerResponse} from 'node:http';
import type {ConexionSQL} from '../repositorio.js';
import type {IdentidadFirmada} from '../cuentas/jwt.js';
import {enTransaccion,miembroVigente} from '../cuentas/contexto.js';
import {ErrorAPI} from '../modelo.js';
import {cuerpoNegocio} from '../negocio/http.js';
import {PLANES,precioPlan,diasRestantes,errorPlan} from './catalogo.js';
export type CobroTransferencia={clabe:string;banco:string;titular:string};
/** Datos de transferencia solo si están completos y la CLABE es válida (18 dígitos con dígito verificador). */
export function cobroValido(c?:Partial<CobroTransferencia>|null):CobroTransferencia|null{
 const clabe=String(c?.clabe||'').replace(/\s/g,''),banco=String(c?.banco||'').trim(),titular=String(c?.titular||'').trim();
 if(!/^\d{18}$/.test(clabe)||!banco||!titular)return null;const pesos=[3,7,1];let suma=0;for(let i=0;i<17;i++)suma+=(Number(clabe[i])*pesos[i%3])%10;
 return (10-suma%10)%10===Number(clabe[17])?{clabe,banco:banco.slice(0,80),titular:titular.slice(0,120)}:null;}
export function rutasPlanes(pool:ConexionSQL,jwt:{verificar:(s:string)=>Promise<IdentidadFirmada>},origen:string,opciones:{cobro?:Partial<CobroTransferencia>|null}={}){const cobro=cobroValido(opciones.cobro);return async(req:IncomingMessage,res:ServerResponse,url:URL)=>{
 const publico=url.pathname==='/api/planes/catalogo',m=/^\/api\/negocios\/([a-f0-9-]{36})\/plan(?:\/(elegir|factura|pago|pago\/reportar|pago\/cancelar))?$/.exec(url.pathname);if(!publico&&!m)return false;
 const responder=(d:unknown)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Authorization','Referrer-Policy':'no-referrer'}).end(JSON.stringify(d));return true;};
 if(url.search||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==origen||req.method!=='GET'&&req.headers.origin!==origen)throw new ErrorAPI(403,'Abre Agendappx para continuar.');
 if(publico){if(req.method!=='GET')throw new ErrorAPI(405,'Método no permitido.');const c=await pool.connect();try{return responder({planes:PLANES,moneda:'MXN',ivaIncluido:true,pruebaDias:30,cobrosHabilitados:!!cobro,fundadoras:{total:20,disponibles:Number((await c.query('SELECT ritmo.cupos_fundadoras() AS n')).rows[0].n),mensual:199}});}finally{c.release();}}
 const i=await jwt.verificar(req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):''),n=m![1];
 try{return responder(await enTransaccion(pool,i,n,async c=>{
  const miembro=await miembroVigente(c,n,i.usuarioId);if(miembro.rol!=='admin'||i.aal!=='aal2')throw new ErrorAPI(403,'Mi plan es exclusivo de Admin con dos pasos.');
  if(req.method==='GET'&&!m![2]){
   // to_jsonb: sigue funcionando aunque la migración de cobros (pagado_hasta) aún no esté aplicada.
   const fila=(await c.query('SELECT to_jsonb(p) AS r FROM ritmo.negocios_planes p WHERE negocio_id=$1',[n])).rows[0]?.r;const p=fila&&{plan:fila.plan,estado:fila.estado,prueba_inicio:fila.prueba_inicio,prueba_fin:fila.prueba_fin,anual:fila.anual,elegido_en:fila.elegido_en,fundadora_numero:fila.fundadora_numero,factura:fila.factura,pagado_hasta:fila.pagado_hasta??null};if(!p)throw new ErrorAPI(503,'El plan está pendiente de preparar.');
   const equipo=(await c.query("SELECT count(*) AS personas,count(*) FILTER(WHERE rol='admin') AS admins FROM ritmo.miembros WHERE negocio_id=$1 AND activo",[n])).rows[0];
   const wa=(await c.query("SELECT count(*) AS n FROM ritmo.whatsapp_conexiones WHERE negocio_id=$1 AND estado='conectado'",[n])).rows[0];const mes=(await c.query("SELECT count(*) AS n FROM ritmo.whatsapp_envios WHERE negocio_id=$1 AND intento_en>=date_trunc('month',now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City'",[n])).rows[0];
   const info=PLANES.find(v=>v.id===p.plan)!;const ahora=Date.now(),pagado=p.pagado_hasta&&new Date(p.pagado_hasta).getTime()>ahora,gracia=!pagado&&p.pagado_hasta&&new Date(p.pagado_hasta).getTime()+3*86400000>ahora;
   const pagos=p.estado==='legado'||!cobro?[]:(await c.query('SELECT ritmo.pagos_negocio($1) AS r',[n])).rows[0].r;
   return {...p,nombre:p.estado==='legado'?'Acceso existente':info.nombre,estado:p.estado==='legado'?'legado':pagado?'pagado':gracia?'gracia':new Date(p.prueba_fin).getTime()<=ahora?'pausada':'prueba',diasRestantes:diasRestantes(pagado||gracia?p.pagado_hasta:p.prueba_fin),precio:precioPlan(p.plan,p.anual,!!p.fundadora_numero),moneda:'MXN',cobrosHabilitados:!!cobro&&p.estado!=='legado',transferencia:cobro&&p.estado!=='legado'?cobro:null,uso:{personas:Number(equipo.personas),admins:Number(equipo.admins),whatsapp:Number(wa.n),mensajes:Number(mes.n)},limites:{personas:p.estado==='legado'?null:info.personas,admins:p.estado==='legado'?null:info.admins,mensajes:600},pagos};
  }
  if(req.method==='POST'&&m![2]==='elegir'){const d=await cuerpoNegocio(req);if(Object.keys(d).some(k=>!['plan','anual'].includes(k))||!PLANES.some(p=>p.id===d.plan)||typeof d.anual!=='boolean')throw new ErrorAPI(400,'Plan inválido.');await c.query('SELECT ritmo.elegir_plan($1,$2,$3)',[n,d.plan,d.anual]);return {guardado:true,cobrado:false};}
  if(req.method==='POST'&&m![2]?.startsWith('pago')){if(!cobro)throw new ErrorAPI(503,'Los pagos por transferencia todavía no están habilitados.');const d=await cuerpoNegocio(req);
   if(m![2]==='pago'){if(Object.keys(d).some(k=>!['plan','anual'].includes(k))||!PLANES.some(p=>p.id===d.plan)||typeof d.anual!=='boolean')throw new ErrorAPI(400,'Plan inválido.');return {...(await c.query('SELECT ritmo.pago_solicitar($1,$2,$3) AS r',[n,d.plan,d.anual])).rows[0].r,transferencia:cobro};}
   if(Object.keys(d).some(k=>!['id','nota'].includes(k))||typeof d.id!=='string'||!/^[a-f0-9-]{36}$/.test(d.id)||d.nota!==undefined&&(typeof d.nota!=='string'||d.nota.length>200))throw new ErrorAPI(400,'Solicitud inválida.');
   if(m![2]==='pago/reportar'){await c.query('SELECT ritmo.pago_reportar($1,$2,$3)',[n,d.id,d.nota||'']);return {reportado:true};}
   await c.query('SELECT ritmo.pago_cancelar($1,$2)',[n,d.id]);return {cancelado:true};}
  if(req.method==='PUT'&&m![2]==='factura'){const d=await cuerpoNegocio(req);if(Object.keys(d).some(k=>!['rfc','razonSocial','codigoPostal','regimen','usoCFDI','correo'].includes(k))||Object.values(d).some(v=>typeof v!=='string'||v.length>250))throw new ErrorAPI(400,'Revisa los datos fiscales.');if(d.rfc&&!/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(d.rfc)||d.codigoPostal&&!/^\d{5}$/.test(d.codigoPostal)||d.correo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo))throw new ErrorAPI(400,'Revisa RFC, código postal y correo.');await c.query('SELECT ritmo.guardar_factura_plan($1,$2::jsonb)',[n,JSON.stringify(d)]);return {guardado:true,facturado:false};}
  throw new ErrorAPI(405,'Método no permitido.');
 }));}catch(e:any){const p=errorPlan(e);if(p)throw new ErrorAPI(p.status,p.mensaje);if(e?.code==='22023')throw new ErrorAPI(400,/pago|revisado|acceso existente no requiere/i.test(String(e.message))?String(e.message)+'.':'Tu acceso existente se conserva o el plan no está disponible.');throw e;}
 };}
