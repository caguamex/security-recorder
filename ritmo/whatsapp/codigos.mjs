import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {huella,telefonoMX} from '../servidor/build/cuentas/acceso.js';
import {PLATAFORMA,NUMERO_CODIGOS} from './plataforma.mjs';
const fallo=(status,message)=>Object.assign(new Error(message),{status});
export function verificarFirma(raw,headers,secreto,ahora=Date.now()){
 const id=headers['webhook-id'],ts=headers['webhook-timestamp'],firma=headers['webhook-signature'];
 const clave=String(secreto||'').replace(/^v1,whsec_|^whsec_/,'');
 if(!/^[A-Za-z0-9+/]{43}=$/.test(clave))throw fallo(503,'Hook pendiente de configurar.');
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(id)||typeof ts!=='string'||!/^\d{10}$/.test(ts)||Math.abs(ahora/1000-Number(ts))>300||typeof firma!=='string'||firma.length>2048)throw fallo(401,'Firma inválida.');
 const esperada=createHmac('sha256',Buffer.from(clave,'base64')).update(id+'.'+ts+'.'+raw).digest();
 const ok=firma.split(' ').some(s=>{if(!/^v1,[A-Za-z0-9+/]{43}=$/.test(s))return false;const b=Buffer.from(s.slice(3),'base64');return b.length===esperada.length&&timingSafeEqual(b,esperada);});
 if(!ok)throw fallo(401,'Firma inválida.');return createHash('sha256').update(id).digest('hex');
}
export class CodigosWhatsApp {
 constructor(db,remitente,{habilitado=false,hookSecret,key,ahora=Date.now,prueba}={}){this.db=db;this.remitente=remitente;this.habilitado=habilitado;this.hookSecret=hookSecret;this.key=key;this.ahora=ahora;this.prueba=prueba;this.pendientes=0;this.cola=Promise.resolve();if(habilitado&&(!/^[A-Za-z0-9+/]{43}=$/.test(key||'')||!/^(?:v1,)?whsec_[A-Za-z0-9+/]{43}=$/.test(hookSecret||'')))throw new Error('Faltan llaves seguras para los códigos.');}
 async entregar(raw,headers){
  if(this.ocupado)throw fallo(503,'Solicita nuevamente tu código en unos segundos.');this.ocupado=true;this.pendientes++;
  try{return await this.procesar(raw,headers);}finally{this.ocupado=false;this.pendientes--;}
 }
 async procesar(raw,headers){
  const comienzo=performance.now();
  if(!this.habilitado)throw fallo(503,'El envío de códigos todavía no está autorizado.');
  const hook=verificarFirma(raw,headers,this.hookSecret,this.ahora());let d;try{d=JSON.parse(raw);}catch{throw fallo(400,'Evento inválido.');}
  if(!d.user||!/^[a-f0-9-]{36}$/i.test(d.user.id||'')||!/^\d{6}$/.test(d.sms?.otp||'')||d.telefono||d.codigo||d.texto)throw fallo(400,'Se requiere el evento firmado de Supabase.');
  // Versiones recientes incluyen sms.phone; las anteriores usan user.phone.
  // phone_change solo procede con el ticket autenticado de ese mismo usuario.
  const tel=telefonoMX(d.sms.phone||d.user.phone_change||d.user.phone),dest=huella(this.key,'destino',tel),payload=createHash('sha256').update(raw).digest('hex');
  const prueba=this.prueba;
  if(prueba&&(d.user.id!==prueba.usuario||tel!==prueba.destino||this.ahora()<prueba.desde||this.ahora()>=prueba.hasta))throw fallo(403,'La prueba solo admite el destinatario y horario autorizados.');
  const s=await this.db.tx(async c=>{
   if(prueba)await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['agendappx-codigo-prueba']);
   const previa=(await c.query('SELECT * FROM ritmo.acceso_solicitudes WHERE hook_hash=$1 FOR UPDATE',[hook])).rows[0];
   if(previa){if(previa.payload_hash!==payload)throw fallo(401,'Evento cambiado.');if(['enviado','verificando','usado'].includes(previa.estado))return null;throw fallo(503,'Entrega pendiente de revisión; no se repitió.');}
   const f=(await c.query("SELECT * FROM ritmo.acceso_solicitudes WHERE destino_hash=$1 AND canal='whatsapp' AND estado='pendiente' AND creado_en>$2 AND vence_en>$3 ORDER BY creado_en DESC LIMIT 1 FOR UPDATE",[dest,new Date(this.ahora()-20000),new Date(this.ahora())])).rows[0];
   if(!f||f.usuario_id&&f.usuario_id!==d.user.id)throw fallo(403,'Falta una solicitud de acceso válida.');
   if(prueba){
    if(f.tipo!=='phone_change'||f.usuario_id!==prueba.usuario||new Date(f.creado_en).getTime()<prueba.desde)throw fallo(403,'La prueba necesita vincular el número desde la cuenta autorizada.');
    const usada=(await c.query("SELECT id FROM ritmo.acceso_solicitudes WHERE usuario_id=$1 AND destino_hash=$2 AND creado_en>=$3 AND creado_en<$4 AND estado IN('enviando','enviado','incierto','verificando','usado') LIMIT 1",[prueba.usuario,dest,new Date(prueba.desde),new Date(prueba.hasta)])).rows[0];
    if(usada)throw fallo(403,'El único código de esta prueba ya fue emitido; no se repite.');
   }
   await c.query("UPDATE ritmo.acceso_solicitudes SET hook_hash=$2,payload_hash=$3,usuario_id=$4,codigo_hash=$5,estado='enviando' WHERE id=$1",[f.id,hook,payload,d.user.id,huella(this.key,'otp',f.id+':'+d.sms.otp)]);return f;
  });if(!s)return;
  const op=this.cola.then(async()=>{
   let salida=false;
   try{
    // Tiempo corto: el hook no espera una reconexión ni una cola de recordatorios.
    const meta=await this.db.usar(async c=>(await c.query("SELECT freno,manual FROM ritmo.plataforma_conexiones WHERE negocio_id='codigos'")).rows[0]);if(meta?.freno||meta?.manual)throw fallo(503,'Envíos de acceso detenidos.');
    const estado=await this.remitente.estado(PLATAFORMA);if(!estado.verificado||estado.numero!==NUMERO_CODIGOS)throw fallo(503,'WhatsApp de acceso no está conectado.');
    if(performance.now()-comienzo>1500)throw fallo(503,'La conexión tardó demasiado para emitir un código válido.');
    salida=true;
    const envio=this.remitente.enviar(PLATAFORMA,tel,'Tu código de Agendappx es *'+d.sms.otp+'*. Vence en 10 minutos. No lo compartas con nadie.',hook);
    let timer;try{await Promise.race([envio,new Promise((_,rechazar)=>{timer=setTimeout(()=>rechazar(fallo(503,'No se confirmó la aceptación del código.')),2500);timer.unref?.();})]);}finally{clearTimeout(timer);}
    await this.db.usar(c=>c.query("UPDATE ritmo.acceso_solicitudes SET estado='enviado' WHERE id=$1 AND estado='enviando'",[s.id]));
   }catch(e){if([401,403,429].includes(Number(e?.status||e?.output?.statusCode)))await this.db.usar(c=>c.query("UPDATE ritmo.plataforma_conexiones SET freno=true,motivo='bloqueo_o_limite' WHERE negocio_id='codigos'"));await this.db.usar(c=>c.query('UPDATE ritmo.acceso_solicitudes SET estado=$2 WHERE id=$1 AND estado=\'enviando\'',[s.id,salida?'incierto':'fallido']));throw fallo(503,'No se pudo enviar el código. Usa tu correo de respaldo.');}
  });this.cola=op.catch(()=>{});return op;
 }
 async ruta(req,res,url){if(url.pathname!=='/hook/codigo')return false;
  try{if(req.method!=='POST'||url.search)throw fallo(405,'Método no permitido.');if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw fallo(415,'Usa application/json.');let size=0;const chunks=[];for await(const b of req){size+=b.length;if(size>16384)throw fallo(413,'Evento demasiado grande.');chunks.push(b);}await this.entregar(Buffer.concat(chunks).toString('utf8'),req.headers);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end('{}');}
  catch(e){res.writeHead([400,401,403,405,413,415,503].includes(e.status)?e.status:503,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:{http_code:[400,401,403,405,413,415].includes(e.status)?e.status:503,message:'No se pudo completar el envío de acceso.'}}));}return true;
 }
}
