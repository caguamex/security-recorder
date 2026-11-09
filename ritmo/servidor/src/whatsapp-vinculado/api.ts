import {createHash} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {ErrorAPI} from '../modelo.js';
import type {IdentidadFirmada} from '../cuentas/jwt.js';
import {BaseWhatsApp} from './db.js';
import {Mensajero,type Remitente,type Politica} from './cola.js';
import {configuracion,huella,inicio,numero,type Datos} from './reglas.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const responder=(res:ServerResponse,v:unknown)=>{res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(v));};
async function body(req:IncomingMessage){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ErrorAPI(415,'Usa application/json.');let bytes=0;const partes=[];for await(const b of req){bytes+=b.length;if(bytes>65536)throw new ErrorAPI(413,'La solicitud excede 64 KB.');partes.push(b);}try{const d=JSON.parse(Buffer.concat(partes).toString('utf8'));if(!d||typeof d!=='object'||Array.isArray(d))throw 0;return d as Datos;}catch{throw new ErrorAPI(400,'Datos inválidos.');}}
function solo(d:Datos,campos:string[]){if(Object.keys(d).some(k=>!campos.includes(k)))throw new ErrorAPI(400,'Campo no permitido.');}
export class ControlWhatsApp {
 constructor(readonly db:BaseWhatsApp,readonly emisor:Remitente,readonly cola:Mensajero,readonly politica:Politica,readonly salones:ReadonlySet<string>){}
 private permitido(n:string){if(!uuid.test(n)||!this.salones.has(n))throw new ErrorAPI(403,'Este salón no tiene habilitado WhatsApp.');}
 async estado(i:IdentidadFirmada,n:string){this.permitido(n);const datos=await this.db.miembro(i,n,true,async c=>({f:(await c.query('SELECT * FROM ritmo.whatsapp_conexiones WHERE negocio_id=$1',[n])).rows[0],ajustes:await this.db.config(n,c),resumen:(await c.query('SELECT estado,count(*)::integer AS cantidad FROM ritmo.whatsapp_envios WHERE negocio_id=$1 GROUP BY estado',[n])).rows}));const r=await this.emisor.estado(n);return {estado:r.estado,numero:r.numero||datos.f?.esperado||'',verificado:!!r.verificado,ultimaConexion:datos.f?.ultima_conexion||null,detalle:datos.f?.motivo||'',cerradaManualmente:!!datos.f?.manual,freno:!!datos.f?.freno,enviosActivados:this.politica.envios&&datos.ajustes.habilitado&&!datos.f?.freno,vinculacionAutorizada:this.politica.vincular,ajustes:datos.ajustes,resumen:datos.resumen};}
 async codigo(i:IdentidadFirmada,n:string,d:Datos){this.permitido(n);solo(d,['telefono']);const tel=numero(d.telefono);await this.db.miembro(i,n,true,async c=>{if(!this.politica.vincular)throw new ErrorAPI(503,'Falta la confirmación para vincular tu número.');const f=await this.db.prepararConexion(n,c),ahora=this.db.ahora();if(f.numero&&f.numero!==tel&&!f.manual)throw new ErrorAPI(409,'Desvincula el número actual antes de cambiarlo.');if(f.ultima_solicitud&&new Date(f.ultima_solicitud).getTime()>ahora-20000)throw new ErrorAPI(429,'Ya hay una solicitud reciente. Espera antes de repetirla.');const misma=f.ventana_codigo&&new Date(f.ventana_codigo).getTime()>ahora-300000;if(misma&&f.codigos>=3)throw new ErrorAPI(429,'Espera cinco minutos antes de pedir otro código.');await c.query("UPDATE ritmo.whatsapp_conexiones SET esperado=$2,manual=false,estado='vinculando',ultima_solicitud=$3,ventana_codigo=$4,codigos=$5 WHERE negocio_id=$1",[n,tel,new Date(ahora),misma?f.ventana_codigo:new Date(ahora),misma?f.codigos+1:1]);});const codigo=await this.emisor.codigo(n,tel);return {...await this.estado(i,n),codigo,mostrarHasta:new Date(this.db.ahora()+120000).toISOString()};}
 async salir(i:IdentidadFirmada,n:string,d:Datos){this.permitido(n);solo(d,['confirmar','cerradoEnTelefono']);if(d.confirmar!==true||d.cerradoEnTelefono!==undefined&&d.cerradoEnTelefono!==true)throw new ErrorAPI(400,'Confirma que quieres desvincular.');await this.db.miembro(i,n,true,async c=>{await this.db.prepararConexion(n,c);await c.query("UPDATE ritmo.whatsapp_conexiones SET manual=true,estado='sin_vincular' WHERE negocio_id=$1",[n]);});if(d.cerradoEnTelefono!==true)await this.emisor.salir(n);else await this.emisor.olvidar?.(n);await this.db.miembro(i,n,true,async c=>{await c.query('DELETE FROM ritmo.whatsapp_sesiones WHERE negocio_id=$1',[n]);await c.query('UPDATE ritmo.whatsapp_conexiones SET numero=NULL,esperado=NULL WHERE negocio_id=$1',[n]);});return this.estado(i,n);}
 async recuperar(i:IdentidadFirmada,n:string,d:Datos){this.permitido(n);solo(d,[]);await this.db.miembro(i,n,true,async c=>{const f=await this.db.prepararConexion(n,c);if(f.manual||f.freno||f.estado==='requiere_vincular')throw new ErrorAPI(409,'Revisa la vinculación o el freno de emergencia.');});await this.emisor.recuperar(n);return this.estado(i,n);}
 async ajustes(i:IdentidadFirmada,n:string,d:Datos){this.permitido(n);await this.db.miembro(i,n,true,async c=>{const a=configuracion(d,await this.db.config(n,c));if(a.habilitado&&!a.direccion.trim())throw new ErrorAPI(400,'Agrega la dirección antes de activar avisos.');await c.query('INSERT INTO ritmo.whatsapp_config(negocio_id,data) VALUES($1,$2) ON CONFLICT(negocio_id) DO UPDATE SET data=EXCLUDED.data',[n,a]);await this.db.prepararConexion(n,c);});return this.estado(i,n);}
 async reanudar(i:IdentidadFirmada,n:string,d:Datos){this.permitido(n);solo(d,['confirmar']);if(d.confirmar!==true)throw new ErrorAPI(400,'Confirma que revisaste el bloqueo.');await this.db.miembro(i,n,true,async c=>{await c.query("UPDATE ritmo.whatsapp_conexiones SET freno=false,motivo='' WHERE negocio_id=$1",[n]);await c.query("UPDATE ritmo.whatsapp_alertas SET resuelta=true WHERE negocio_id=$1 AND tipo='envios_detenidos'",[n]);});return this.estado(i,n);}
 async cita(i:IdentidadFirmada,n:string,id:string,d?:Datos,tipo?:string){this.permitido(n);
  // Reconciliar no cambia citas: solo prepara anticipo, avisos y metadatos propios del mensajero.
  await this.db.miembro(i,n,false,async(c,m)=>{const x=(await this.db.fuente(n,id,c))?.data;if(x?.kind!=='cita'||m.rol==='especialista'&&x.especialista!==i.usuarioId)throw new ErrorAPI(403,'Cita no disponible.');if(tipo&&m.rol==='especialista')throw new ErrorAPI(403,'Solo Admin o Recepción pueden revisar anticipos.');});
  await this.cola.reconciliar(n);
  return this.db.miembro(i,n,false,async(c,m)=>{
   if(m.rol==='especialista')return {soloLectura:true};
   const f=(await this.db.fuente(n,id,c))?.data;if(f?.kind!=='cita')throw new ErrorAPI(404,'Cita no disponible.');
   if(d&&tipo==='recibido'){
    solo(d,['metodo']);if(!['transferencia','efectivo','tarjeta'].includes(d.metodo))throw new ErrorAPI(400,'Elige el método de pago.');if(['cancelada','completada'].includes(f.estado))throw new ErrorAPI(409,'La cita ya no admite cambios de anticipo.');
    const p=(await c.query('SELECT * FROM ritmo.whatsapp_anticipos WHERE negocio_id=$1 AND cita_id=$2 FOR UPDATE',[n,id])).rows[0];if(!p||p.estado==='no_aplica')throw new ErrorAPI(409,'Esta cita no requiere anticipo.');
    if(p.estado!=='recibido'){
     await c.query("UPDATE ritmo.whatsapp_anticipos SET estado='recibido',recibido_en=$3,recibido_por=$4,metodo=$5 WHERE negocio_id=$1 AND cita_id=$2",[n,id,new Date(this.db.ahora()),i.usuarioId,d.metodo]);
     await this.cola.insertar(c,n,f,'anticipo',huella(f),0,this.db.ahora());
     await c.query("UPDATE ritmo.whatsapp_envios SET estado='cancelado',motivo='anticipo_recibido' WHERE negocio_id=$1 AND cita_id=$2 AND tipo='inicio' AND estado='pendiente'",[n,id]);
     await c.query("UPDATE ritmo.whatsapp_alertas SET resuelta=true WHERE negocio_id=$1 AND cita_id=$2 AND tipo='anticipo_vencido'",[n,id]);
    }
   }
   if(d&&tipo==='comprobante'){
    solo(d,['foto']);const s=d.foto;if(s!==null&&(typeof s!=='string'||s.length>48000||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(s)))throw new ErrorAPI(400,'Sube una foto JPG optimizada.');
    if(s){const bytes=Buffer.from(s.slice(23),'base64');if(bytes.length<4||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new ErrorAPI(400,'La foto no es un JPG válido.');}
    await c.query('UPDATE ritmo.whatsapp_anticipos SET comprobante=$3 WHERE negocio_id=$1 AND cita_id=$2',[n,id,s]);
   }
   const p=(await c.query('SELECT monto,estado,limite,recibido_en,metodo,comprobante FROM ritmo.whatsapp_anticipos WHERE negocio_id=$1 AND cita_id=$2',[n,id])).rows[0];
   const a=await this.db.config(n,c),envios=(await c.query('SELECT tipo,debido,estado,motivo,aceptado_en FROM ritmo.whatsapp_envios WHERE negocio_id=$1 AND cita_id=$2 ORDER BY debido',[n,id])).rows;
   return {anticipo:p?{...p,monto:Number(p.monto)}:null,transferencia:a.anticipoActivo?{banco:a.banco,clabe:a.clabe,titular:a.titular}:null,envios};
  });
 }
 async alertas(i:IdentidadFirmada,n:string){this.permitido(n);return this.db.miembro(i,n,false,async(c,m)=>{if(m.rol==='especialista')throw new ErrorAPI(403,'Avisos reservados al salón.');return (await c.query("SELECT cita_id,tipo,creado_en FROM ritmo.whatsapp_alertas WHERE negocio_id=$1 AND NOT resuelta AND ($2 OR tipo='anticipo_vencido') ORDER BY creado_en DESC LIMIT 50",[n,m.rol==='admin'])).rows;});}
}
export function rutasSoloEnvios(servicio:ControlWhatsApp,jwt:{verificar:(token:string)=>Promise<IdentidadFirmada>},origen:string){return async(req:IncomingMessage,res:ServerResponse,url:URL)=>{
 const m=/^\/api\/negocios\/([a-f0-9-]{36})\/whatsapp(?:\/(codigo|recuperar|desvincular|ajustes|reanudar|alertas|citas\/[a-zA-Z0-9_-]{1,120}(?:\/(?:recibido|comprobante))?))?$/.exec(url.pathname);if(!m)return false;
 if(url.search)throw new ErrorAPI(400,'No se admiten parámetros de instancia.');if(req.headers.origin&&req.headers.origin!==origen||req.headers['sec-fetch-site']==='cross-site')throw new ErrorAPI(403,'Origen no permitido.');
 const i=await jwt.verificar(req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):''),n=m[1],accion=m[2]||'';
 if(req.method==='GET'){
  if(accion==='alertas')responder(res,await servicio.alertas(i,n));else if(accion.startsWith('citas/')&&accion.split('/').length===2)responder(res,await servicio.cita(i,n,accion.split('/')[1]));else if(!accion||accion==='ajustes')responder(res,await servicio.estado(i,n));else throw new ErrorAPI(405,'Método no permitido.');return true;
 }
 if(req.method!=='POST')throw new ErrorAPI(405,'Método no permitido.');const d=await body(req);let r;
 if(accion.startsWith('citas/')){const [,id,tipo]=accion.split('/');if(!tipo)throw new ErrorAPI(405,'Método no permitido.');r=await servicio.cita(i,n,id,d,tipo);}
 else if(accion==='codigo')r=await servicio.codigo(i,n,d);else if(accion==='recuperar')r=await servicio.recuperar(i,n,d);else if(accion==='desvincular')r=await servicio.salir(i,n,d);else if(accion==='ajustes')r=await servicio.ajustes(i,n,d);else if(accion==='reanudar')r=await servicio.reanudar(i,n,d);else throw new ErrorAPI(405,'Método no permitido.');
 responder(res,r);return true;
};}
