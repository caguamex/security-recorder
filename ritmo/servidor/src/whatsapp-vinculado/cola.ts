import {createHash} from 'node:crypto';
import type {ClienteSQL} from '../repositorio.js';
import {BaseWhatsApp} from './db.js';
import {anticipo,configuracion,huella,idEnvio,inicio,plan,mensaje,dia,numero,type Datos,type Tipo} from './reglas.js';
export interface Remitente {estado(n:string):Promise<{estado:string;numero?:string;verificado?:boolean}>;codigo(n:string,tel:string):Promise<string>;recuperar(n:string):Promise<void>;salir(n:string):Promise<void>;olvidar?(n:string):Promise<void>;escribir(n:string,tel:string):Promise<void>;enviar(n:string,tel:string,texto:string,id:string):Promise<string>;}
export type Politica={envios:boolean;vincular:boolean;destinatarios?:ReadonlySet<string>};
const fecha=(ms:number)=>new Date(ms);
export class Mensajero {
 constructor(readonly db:BaseWhatsApp,readonly remitente:Remitente,readonly politica:Politica,readonly dormir:(ms:number)=>Promise<void>=ms=>new Promise(r=>setTimeout(r,ms)),readonly azar=()=>Math.random()){}
 async insertar(c:ClienteSQL,n:string,cita:Datos,t:Tipo,h:string,g:number,debido:number){const id=idEnvio(n,cita,t,t==='anticipo'?'pago':h+':'+g);await c.query(`INSERT INTO ritmo.whatsapp_envios(id,negocio_id,cita_id,tipo,huella,debido) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET debido=EXCLUDED.debido,huella=EXCLUDED.huella WHERE whatsapp_envios.estado='pendiente' AND whatsapp_envios.intento_en IS NULL`,[id,n,cita.id,t,h,fecha(debido)]);}
 async reconciliar(n:string){await this.db.tx(async c=>{
  await this.db.prepararConexion(n,c); const a=await this.db.config(n,c),ahora=this.db.ahora();
  const registros=(await c.query('SELECT id,data,actualizado_en FROM ritmo.belleza_objetos WHERE negocio_id=$1',[n])).rows;
  const configHash=createHash('sha256').update(JSON.stringify([a.habilitado,a.horaDia,a.minutosAntes,'24h-v1'])).digest('hex');
  const objetos=new Map<string,Datos>(registros.filter(r=>r.data).map(r=>[r.id,r.data]));
  const previas=(await c.query('SELECT * FROM ritmo.whatsapp_citas WHERE negocio_id=$1',[n])).rows, metas=new Map(previas.map(r=>[r.cita_id,r]));
  for(const r of registros){const v=r.data as Datos;if(v?.kind!=='cita')continue;
   const h=huella(v),m=metas.get(v.id);if(m?.huella===h&&m.config_huella===configHash)continue;
   const configCambio=!!m?.config_huella&&m.config_huella!==configHash,creada=m?new Date(m.creada_en).getTime():new Date(r.actualizado_en).getTime(),movida=!!m?.huella&&m.huella!==h,g=(m?.generacion||0)+(movida||configCambio?1:0);
   await c.query(`INSERT INTO ritmo.whatsapp_citas(negocio_id,cita_id,huella,generacion,creada_en,config_huella) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(negocio_id,cita_id) DO UPDATE SET huella=EXCLUDED.huella,generacion=EXCLUDED.generacion,config_huella=EXCLUDED.config_huella`,[n,v.id,h,g,fecha(creada),configHash]);
   if(configCambio)await c.query("UPDATE ritmo.whatsapp_envios SET estado='cancelado',motivo='configuracion_modificada' WHERE negocio_id=$1 AND cita_id=$2 AND estado='pendiente' AND tipo IN ('dia','antes')",[n,v.id]);
   const calc=anticipo(v,objetos.get(v.servicio)||{},a,creada);
   await c.query(`INSERT INTO ritmo.whatsapp_anticipos(negocio_id,cita_id,monto,estado,limite) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[n,v.id,calc.monto,calc.estado,calc.limite]);
   await c.query(`UPDATE ritmo.whatsapp_envios SET estado='cancelado',motivo='cita_modificada' WHERE negocio_id=$1 AND cita_id=$2 AND estado='pendiente' AND (huella<>$3 OR $4) AND tipo<>'anticipo'`,[n,v.id,h,['cancelada','completada'].includes(v.estado)]);
   await c.query("UPDATE ritmo.whatsapp_envios SET huella=$3 WHERE negocio_id=$1 AND cita_id=$2 AND tipo='anticipo' AND estado='pendiente' AND intento_en IS NULL",[n,v.id,h]);
   if(['cancelada','completada'].includes(v.estado)){await c.query("UPDATE ritmo.whatsapp_envios SET estado='cancelado',motivo='cita_inactiva' WHERE negocio_id=$1 AND cita_id=$2 AND estado='pendiente'",[n,v.id]);continue;}
   if(a.habilitado)for(const p of plan(v,a,creada,!m,movida,ahora))await this.insertar(c,n,v,p.tipo,h,g,p.debido);
  }
  for(const m of previas)if(objetos.get(m.cita_id)?.kind!=='cita')await c.query("UPDATE ritmo.whatsapp_envios SET estado='cancelado',motivo='cita_eliminada' WHERE negocio_id=$1 AND cita_id=$2 AND estado='pendiente'",[n,m.cita_id]);
  const vencidos=(await c.query("UPDATE ritmo.whatsapp_anticipos SET estado='vencido' WHERE negocio_id=$1 AND estado='pendiente' AND limite<=$2 RETURNING cita_id",[n,fecha(ahora)])).rows;
  for(const v of vencidos)await this.db.alerta(n,v.cita_id,'anticipo_vencido',c);
  await c.query("UPDATE ritmo.whatsapp_envios SET estado='incierto',motivo='proceso_interrumpido' WHERE negocio_id=$1 AND estado='procesando' AND intento_en<$2",[n,fecha(ahora-120000)]);
  const con=(await c.query('SELECT * FROM ritmo.whatsapp_conexiones WHERE negocio_id=$1',[n])).rows[0];
  if(con?.ultima_conexion&&con.estado!=='conectado'&&(con.estado==='requiere_vincular'||con.desconectado_desde&&new Date(con.desconectado_desde).getTime()<=ahora-600000))await this.db.alerta(n,null,'whatsapp_desconectado',c);
 });}
 private async datos(c:ClienteSQL,n:string,id:string){const x=(await this.db.fuente(n,id,c))?.data;if(x?.kind!=='cita')return null;const k=(await this.db.fuente(n,x.clienta,c))?.data,s=(await this.db.fuente(n,x.servicio,c))?.data;return k?.kind==='clienta'&&s?.kind==='servicio'?{cita:x,clienta:k,servicio:s}:null;}
 async tomar(n:string){if(!this.politica.envios)return null;
  const estado=await this.remitente.estado(n);if(estado.estado!=='conectado'||!estado.verificado||!estado.numero)return null;
  return this.db.tx(async c=>{
   const con=await this.db.prepararConexion(n,c),a=await this.db.config(n,c),ahora=this.db.ahora();
   if(!a.habilitado||con.manual||con.freno||con.estado!=='conectado'||con.numero!==estado.numero||con.proximo_envio&&new Date(con.proximo_envio).getTime()>ahora)return null;
   // El bloqueo por número hace cumplir topes aunque se intenten procesos paralelos.
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['wa:'+estado.numero]);
   const pendientes=(await c.query("SELECT * FROM ritmo.whatsapp_envios WHERE negocio_id=$1 AND estado='pendiente' AND debido<=$2 ORDER BY debido,id FOR UPDATE SKIP LOCKED LIMIT 50",[n,fecha(ahora)])).rows;
   for(const f of pendientes){
    const d=await this.datos(c,n,f.cita_id);let razon='';
    if(!d||['cancelada','completada'].includes(d.cita.estado)||d&&huella(d.cita)!==f.huella)razon='cita_inactiva_o_modificada';
    else if(d.clienta.whatsappOptIn!==true)razon='sin_consentimiento';
    else if(inicio(d.cita)<=ahora)razon='cita_ya_iniciada';
    else if(f.tipo==='antes'&&!a.direccion.trim())razon='falta_direccion';
    if(!razon&&f.tipo==='dia'){
     const reciente=(await c.query("SELECT id FROM ritmo.whatsapp_envios WHERE negocio_id=$1 AND cita_id=$2 AND tipo IN ('inicio','anticipo') AND estado IN ('aceptado','incierto','procesando') AND intento_en>$3 LIMIT 1",[n,f.cita_id,fecha(ahora-10800000)])).rows[0];if(reciente)razon='confirmacion_reciente';
    }
    let tel='';if(!razon)try{tel=numero(d!.clienta.telefono);}catch{razon='telefono_invalido';}
    if(razon){await c.query("UPDATE ritmo.whatsapp_envios SET estado='omitido',motivo=$2 WHERE id=$1",[f.id,razon]);continue;}
    if(this.politica.destinatarios?.size&&!this.politica.destinatarios.has(tel))continue;
    const intentos=(await c.query('SELECT intento_en FROM ritmo.whatsapp_envios WHERE numero=$1 AND intento_en>=$2',[estado.numero,fecha(ahora-32*86400000)])).rows.map(v=>new Date(v.intento_en).getTime());
    if(intentos.filter(v=>v>ahora-3600000).length>=a.maxHora||intentos.filter(v=>dia(v)===dia(ahora)).length>=a.maxDia||intentos.filter(v=>dia(v).slice(0,7)===dia(ahora).slice(0,7)).length>=a.maxMes)return null;
    // Reserva durable antes de tocar la red; un proceso interrumpido no lo vuelve a tomar.
    await c.query("UPDATE ritmo.whatsapp_envios SET estado='procesando',intento_en=$2,numero=$3,intentos=intentos+1 WHERE id=$1",[f.id,fecha(ahora),estado.numero]);
    await c.query('UPDATE ritmo.whatsapp_conexiones SET proximo_envio=$2 WHERE negocio_id=$1',[n,fecha(ahora+90000)]);
    return {...f,...d,tel};
   }return null;
  });
 }
 async enviarUno(n:string){const f=await this.tomar(n);if(!f)return false;let enviado=false;
  try{
   await this.remitente.escribir(n,f.tel);await this.dormir(2000+Math.floor(this.azar()*3001));
   // Se vuelve a comprobar justo después de la pausa, antes de emitir el texto.
   const actual=await this.db.usar(c=>this.datos(c,n,f.cita_id)),a=await this.db.config(n),ahora=this.db.ahora();
   if(!actual||actual.clienta.whatsappOptIn!==true||numero(actual.clienta.telefono)!==f.tel||huella(actual.cita)!==f.huella||['cancelada','completada'].includes(actual.cita.estado)||inicio(actual.cita)<=ahora||!a.habilitado){await this.finalizar(f.id,n,'cancelado','cita_o_permiso_cambio');return true;}
   const con=await this.db.usar(async c=>(await c.query('SELECT * FROM ritmo.whatsapp_conexiones WHERE negocio_id=$1',[n])).rows[0]);
   const remoto=await this.remitente.estado(n);
   if(con?.freno||con?.manual||remoto.estado!=='conectado'||!remoto.verificado){await this.finalizar(f.id,n,'pendiente','conexion_pendiente');return true;}
   const p=await this.db.usar(async c=>(await c.query('SELECT * FROM ritmo.whatsapp_anticipos WHERE negocio_id=$1 AND cita_id=$2',[n,f.cita_id])).rows[0]);
   const extra=await this.db.usar(async c=>({salon:(await c.query('SELECT nombre FROM ritmo.negocios WHERE id=$1',[n])).rows[0]?.nombre,especialista:actual.cita.especialista?(await c.query('SELECT nombre FROM ritmo.miembros WHERE negocio_id=$1 AND usuario_id=$2 AND activo',[n,actual.cita.especialista])).rows[0]?.nombre:''}));
   const texto=mensaje(f.tipo,actual.cita,actual.clienta,actual.servicio,extra.especialista,extra.salon,a,p,new Date(f.debido).getTime(),parseInt(f.id.slice(0,4),16));
   enviado=true;const id=await this.remitente.enviar(n,f.tel,texto,f.id);
   await this.finalizar(f.id,n,'aceptado','',id);
  }catch(e:any){const codigo=Number(e?.status||e?.output?.statusCode||e?.statusCode);const bloqueo=[401,403,429].includes(codigo);if(bloqueo)await this.db.tx(async c=>{await c.query("UPDATE ritmo.whatsapp_conexiones SET freno=true,motivo='bloqueo_o_limite' WHERE negocio_id=$1",[n]);await this.db.alerta(n,null,'envios_detenidos',c);});await this.finalizar(f.id,n,enviado?'incierto':'pendiente',bloqueo?'bloqueo_o_limite':enviado?'resultado_incierto':'conexion_pendiente');}
  return true;
 }
 private async finalizar(id:string,n:string,estado:string,motivo:string,mensajeId:string|null=null){const ahora=this.db.ahora(),pausa=20000+Math.floor(this.azar()*40001);await this.db.tx(async c=>{await c.query(`UPDATE ritmo.whatsapp_envios SET estado=$2,motivo=$3,mensaje_id=$4,aceptado_en=CASE WHEN $2='aceptado' THEN $5 ELSE aceptado_en END,debido=CASE WHEN $2='pendiente' THEN $6 ELSE debido END WHERE id=$1 AND estado='procesando'`,[id,estado,motivo,mensajeId,fecha(ahora),fecha(ahora+60000)]);await c.query('UPDATE ritmo.whatsapp_conexiones SET proximo_envio=$2 WHERE negocio_id=$1',[n,fecha(ahora+pausa)]);});}
 async vuelta(n:string){await this.reconciliar(n);return this.enviarUno(n);}
}
