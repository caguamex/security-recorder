// Conector exclusivamente emisor. Ningún mensaje, historial ni contacto entra en la aplicación.
import makeWASocket,{initAuthCreds,BufferJSON,proto,DisconnectReason} from 'baileys';
import {randomUUID} from 'node:crypto';
import {CifradoSesion} from '../servidor/build/whatsapp-vinculado/cifrado.js';
const tablasSalones=Object.freeze({sesiones:'ritmo.whatsapp_sesiones',conexiones:'ritmo.whatsapp_conexiones',alertas:'ritmo.whatsapp_alertas'});
const tablasPlataforma=Object.freeze({sesiones:'ritmo.plataforma_sesiones',conexiones:'ritmo.plataforma_conexiones',alertas:'ritmo.plataforma_alertas'});
const tablas=db=>db.plataforma===true?tablasPlataforma:tablasSalones;
const silencio={trace(){},debug(){},info(){},warn(){},error(){},fatal(){},child(){return this;},level:'silent'};
export const OPCIONES_PRIVADAS={logger:silencio,markOnlineOnConnect:false,syncFullHistory:false,emitOwnEvents:false,enableRecentMessageCache:false,shouldSyncHistoryMessage:()=>false,shouldIgnoreJid:()=>true,getMessage:async()=>undefined,generateHighQualityLinkPreview:false,connectTimeoutMs:15000,defaultQueryTimeoutMs:15000,retryRequestDelayMs:1000,maxMsgRetryCount:0,fireInitQueries:false,appStateMacVerification:{patch:true,snapshot:true}};
export class SesionesCifradas {
 constructor(db,key,negocio,propietario,cerca){this.db=db;this.tablas=tablas(db);this.cifrado=new CifradoSesion(key);this.n=negocio;this.propietario=propietario;this.cerca=cerca;this.pendiente=Promise.resolve();}
 async leer(tipo,id){const llave=this.cifrado.id(this.n,tipo,id);return this.db.usar(async c=>{const f=(await c.query(`SELECT cifrado FROM ${this.tablas.sesiones} WHERE negocio_id=$1 AND llave=$2`,[this.n,llave])).rows[0];return f?JSON.parse(this.cifrado.abrir(this.n,llave,f.cifrado),BufferJSON.reviver):null;});}
 guardar(tipo,id,valor){const llave=this.cifrado.id(this.n,tipo,id),texto=valor===null?null:JSON.stringify(valor,BufferJSON.replacer);const op=this.pendiente.then(()=>this.db.tx(async c=>{await this.db.cercar(this.n,this.propietario,this.cerca,c);if(texto===null)await c.query(`DELETE FROM ${this.tablas.sesiones} WHERE negocio_id=$1 AND llave=$2`,[this.n,llave]);else await c.query(`INSERT INTO ${this.tablas.sesiones}(negocio_id,llave,cifrado) VALUES($1,$2,$3) ON CONFLICT(negocio_id,llave) DO UPDATE SET cifrado=EXCLUDED.cifrado,actualizado_en=now()`,[this.n,llave,this.cifrado.sellar(this.n,llave,texto)]);}));this.pendiente=op;return op;}
 async estado(){let creds=await this.leer('credenciales','principal');if(!creds){const existen=await this.db.usar(async c=>(await c.query(`SELECT negocio_id FROM ${this.tablas.sesiones} WHERE negocio_id=$1 LIMIT 1`,[this.n])).rows[0]);if(existen)throw new Error('La llave no permite abrir las credenciales guardadas.');creds=initAuthCreds();}return {creds,keys:{get:async(tipo,ids)=>{const out={};for(const id of ids){let v=await this.leer(tipo,id);if(tipo==='app-state-sync-key'&&v)v=proto.Message.AppStateSyncKeyData.fromObject(v);if(v)out[id]=v;}return out;},set:async datos=>{for(const [tipo,items] of Object.entries(datos))for(const [id,valor] of Object.entries(items||{}))await this.guardar(tipo,id,valor);}}};}
}
export class BaileysSoloEnvios {
 constructor(db,key,{vincular=false,fabrica=makeWASocket,temporizador=setTimeout}={}){this.db=db;this.tablas=tablas(db);this.key=key;new CifradoSesion(key);this.vincular=vincular;this.fabrica=fabrica;this.temporizador=temporizador;this.propietario=randomUUID();this.conexiones=new Map();this.iniciando=new Map();this.cerrado=false;this.fallos=new Map();this.reintentos=new Map();}
 async meta(n,estado,motivo='',extra={}){await this.db.usar(c=>c.query(`UPDATE ${this.tablas.conexiones} SET estado=$2,motivo=$3,numero=coalesce($4,numero),ultima_conexion=CASE WHEN $2='conectado' THEN $5 ELSE ultima_conexion END,desconectado_desde=CASE WHEN $2='conectado' THEN NULL ELSE coalesce(desconectado_desde,$5) END,freno=freno OR $6 WHERE negocio_id=$1 AND propietario=$7 AND cerca=$8`,[n,estado,motivo,extra.numero||null,new Date(this.db.ahora()),!!extra.freno,this.propietario,extra.cerca]));}
 async abrir(n){if(this.cerrado)throw new Error('Proceso cerrado.');if(this.conexiones.has(n))return this.conexiones.get(n);if(this.iniciando.has(n))return this.iniciando.get(n);
  const op=this.crear(n).finally(()=>this.iniciando.delete(n));this.iniciando.set(n,op);return op;
 }
 async crear(n){const cerca=await this.db.reservar(n,this.propietario);const store=new SesionesCifradas(this.db,this.key,n,this.propietario,cerca);let auth;
  try{auth=await store.estado();}catch{await this.db.usar(c=>c.query(`UPDATE ${this.tablas.conexiones} SET freno=true,estado='revisar',motivo='revisar_llave_sesion' WHERE negocio_id=$1 AND propietario=$2 AND cerca=$3`,[n,this.propietario,cerca]));await this.db.soltar(n,this.propietario,cerca);throw new Error('Revisa la llave de sesión; no se reemplazaron los datos.');}
  // requestPairingCode añade me antes de registrar el dispositivo. Tras un rechazo,
  // esa identidad provisional no debe convertir el siguiente saludo en un login.
  if(!auth.creds.registered&&!auth.creds.account){delete auth.creds.me;auth.creds.pairingCode=undefined;}
  if(auth.creds.registered)await this.meta(n,'reconectando','recuperando_sesion',{cerca});
  const x={cerca,store,auth,socket:null,abierta:false,cerrada:false,fallos:0,latido:null,reintento:null,listaParaVincular:false,listos:[]};
  let socket;try{socket=this.fabrica({...OPCIONES_PRIVADAS,auth});}catch{await this.db.soltar(n,this.propietario,cerca);throw new Error('No se pudo preparar la conexión.');}x.socket=socket;this.conexiones.set(n,x);
  // Solo conexión y credenciales. No hay listeners de messages.upsert, history, contacts ni chats.
  socket.ev.on('creds.update',datos=>{Object.assign(auth.creds,datos);void store.guardar('credenciales','principal',auth.creds).catch(()=>this.detener(n,'persistencia_no_disponible'));});
  socket.ev.on('connection.update',u=>{void this.cambio(n,x,u).catch(()=>this.detener(n,'conexion_no_verificada'));});
  x.latido=setInterval(()=>{void this.db.renovar(n,this.propietario,cerca).then(ok=>{if(!ok)return this.detener(n,'custodia_perdida');}).catch(()=>this.detener(n,'base_no_disponible'));},10000);x.latido.unref?.();
  return x;
 }
 async cambio(n,x,u){if(x.cerrada)return;
  // El QR indica que terminó el registro inicial; connecting o ws abierto no bastan.
  // Se usa únicamente la señal: no guardar ni imprimir el contenido del QR.
  if(u.qr){x.listaParaVincular=true;for(const r of x.listos.splice(0))r.resolve();}
  if(u.connection==='open'){
   const esperado=await this.db.usar(async c=>(await c.query(`SELECT esperado FROM ${this.tablas.conexiones} WHERE negocio_id=$1`,[n])).rows[0]?.esperado);
   const num=String(x.socket.user?.id||x.auth.creds.me?.id||'').split('@')[0].split(':')[0];
   if(!x.auth.creds.registered||num!==esperado){await this.meta(n,'revisar','numero_no_coincide',{cerca:x.cerca,freno:true});await this.detener(n,'numero_no_coincide');return;}
   await x.store.pendiente;await this.db.renovar(n,this.propietario,x.cerca);x.abierta=true;
   this.fallos.delete(n);clearTimeout(this.reintentos.get(n));this.reintentos.delete(n);await this.meta(n,'conectado','',{numero:num,cerca:x.cerca});await this.db.usar(c=>c.query(`UPDATE ${this.tablas.alertas} SET resuelta=true WHERE negocio_id=$1 AND tipo='whatsapp_desconectado'`,[n]));
  }
  if(u.connection==='close'){
   x.abierta=false;const code=Number(u.lastDisconnect?.error?.output?.statusCode||u.lastDisconnect?.error?.statusCode),cerrada=code===DisconnectReason.loggedOut;
   await this.meta(n,cerrada?'requiere_vincular':'reconectando',cerrada?(x.auth.creds.registered?'sesion_cerrada':'vinculacion_rechazada'):'conexion_interrumpida',{cerca:x.cerca,freno:[403,429].includes(code)});
   if(cerrada||[403,429].includes(code))await this.db.alerta(n,null,cerrada?'whatsapp_desconectado':'envios_detenidos');
   await this.detener(n,'conexion_interrumpida');
   if(!cerrada&&![403,429].includes(code)&&!this.cerrado){this.reconectar(n);}
  }
 }
 reconectar(n){if(this.cerrado||this.reintentos.has(n))return;const fallos=this.fallos.get(n)||0;this.fallos.set(n,fallos+1);const t=this.temporizador(()=>{this.reintentos.delete(n);void this.restaurar(n).catch(()=>this.reconectar(n));},Math.min(300000,30000*2**Math.min(fallos,4)));t.unref?.();this.reintentos.set(n,t);}
 async codigo(n,tel){if(!this.vincular)throw Object.assign(new Error('Falta la confirmación para vincular el número.'),{status:503});let x=this.conexiones.get(n);if(x?.abierta)throw Object.assign(new Error('Primero desvincula el número actual.'),{status:409});x=await this.abrir(n);
  if(x.auth.creds.registered)throw Object.assign(new Error('Conservamos la sesión existente; usa Recuperar conexión.'),{status:409});
  if(!x.listaParaVincular)await new Promise((resolve,reject)=>{const espera={resolve:()=>{clearTimeout(t);resolve();},reject:()=>{clearTimeout(t);reject(new Error('WhatsApp cerró la preparación. Pide otro código.'));}};const t=setTimeout(()=>{x.listos=x.listos.filter(v=>v!==espera);reject(new Error('WhatsApp no terminó de preparar la vinculación.'));},15000);x.listos.push(espera);});
  if(x.cerrada||x.socket.ws?.isOpen!==true)throw new Error('WhatsApp cerró la preparación. Pide otro código.');
  const code=String(await x.socket.requestPairingCode(tel)).replace(/[^A-Za-z0-9]/g,'').toUpperCase();if(!/^[A-Z0-9]{8}$/.test(code))throw new Error('Código de vinculación inválido.');await x.store.pendiente;if(x.cerrada)throw new Error('WhatsApp rechazó la vinculación. Pide otro código.');return code;
 }
 async restaurar(n){if(this.conexiones.has(n)||this.iniciando.has(n))return;const f=await this.db.usar(async c=>(await c.query(`SELECT * FROM ${this.tablas.conexiones} WHERE negocio_id=$1`,[n])).rows[0]);if(!f||f.manual||f.freno||f.estado==='requiere_vincular')return;const existe=await this.db.usar(async c=>(await c.query(`SELECT negocio_id FROM ${this.tablas.sesiones} WHERE negocio_id=$1 LIMIT 1`,[n])).rows[0]);if(!existe)return;const x=await this.abrir(n);if(!x.auth.creds.registered)await this.detener(n,'pendiente_de_vincular');}
 async recuperar(n){await this.restaurar(n);}
 async estado(n){const x=this.conexiones.get(n),f=await this.db.usar(async c=>(await c.query(`SELECT estado,numero,esperado FROM ${this.tablas.conexiones} WHERE negocio_id=$1`,[n])).rows[0]);const verificado=!!x?.abierta&&!x.cerrada&&f?.numero===f?.esperado&&await this.db.renovar(n,this.propietario,x.cerca);return {estado:verificado?'conectado':f?.estado==='conectado'?'reconectando':f?.estado||'sin_vincular',numero:verificado?f.numero:undefined,verificado};}
 async escribir(n,tel){const x=await this.verificar(n);await x.socket.sendPresenceUpdate('composing',tel+'@s.whatsapp.net');}
 async enviar(n,tel,texto,id){const x=await this.verificar(n);const r=await x.socket.sendMessage(tel+'@s.whatsapp.net',{text:texto},{messageId:'AG'+id.slice(0,30).toUpperCase()});if(!r?.key?.id)throw new Error('No se obtuvo aceptación del envío.');return r.key.id;}
 async verificar(n){const s=await this.estado(n);if(s.estado!=='conectado'||!s.verificado)throw new Error('WhatsApp no está conectado.');return this.conexiones.get(n);}
 async salir(n){clearTimeout(this.reintentos.get(n));this.reintentos.delete(n);let x=this.conexiones.get(n);if(!x){const f=await this.db.usar(async c=>(await c.query(`SELECT negocio_id FROM ${this.tablas.sesiones} WHERE negocio_id=$1 LIMIT 1`,[n])).rows[0]);if(f)throw Object.assign(new Error('La sesión está sin conexión y los envíos quedaron detenidos. Cierra el dispositivo de Agendappx desde WhatsApp → Dispositivos vinculados; después confirma aquí para quitar la sesión guardada.'),{status:409});}if(x)await x.socket.logout();await this.detener(n,'cierre_manual');}
 async olvidar(n){clearTimeout(this.reintentos.get(n));this.reintentos.delete(n);await this.detener(n,'cerrado_en_telefono');}
 async detener(n,motivo){const x=this.conexiones.get(n);if(!x||x.cerrada)return;x.cerrada=true;x.abierta=false;clearInterval(x.latido);clearTimeout(x.reintento);this.conexiones.delete(n);for(const r of x.listos.splice(0))r.reject();try{await x.socket.end(undefined);}catch{}await x.store.pendiente.catch(()=>{});await this.db.soltar(n,this.propietario,x.cerca).catch(()=>{});}
 async cerrar(){this.cerrado=true;for(const t of this.reintentos.values())clearTimeout(t);this.reintentos.clear();for(const n of [...this.conexiones.keys()])await this.detener(n,'proceso_finalizado');}
}
