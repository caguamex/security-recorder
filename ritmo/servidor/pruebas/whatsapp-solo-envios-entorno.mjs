import {cuentasEntorno,ids,sesiones} from './cuentas-entorno.mjs';
import {readFile,readdir} from 'node:fs/promises';
import {BaseWhatsApp} from '../build/whatsapp-vinculado/db.js';
import {Mensajero} from '../build/whatsapp-vinculado/cola.js';
import {ControlWhatsApp} from '../build/whatsapp-vinculado/api.js';
export {ids,sesiones};
export async function preparar(){
 const e=await cuentasEntorno();
 const dir=new URL('../../supabase/migrations/',import.meta.url),f=(await readdir(dir)).find(v=>v.endsWith('_whatsapp_solo_envios.sql'));
 await e.db.exec(await readFile(new URL(f,dir),'utf8'));
 const pool={async connect(){const c=await e.pool.connect();await c.query('SET ROLE agendappx_whatsapp');return{query:c.query,release(){void c.query('RESET ROLE').finally(()=>c.release());}};}};
 let ahora=Date.parse('2026-11-09T12:00:00-06:00');const db=new BaseWhatsApp(pool,()=>ahora);
 const llamadas=[],esperas=[];let conectado=true,error=null,antesDeEnviar=null;
 const remoto={async estado(){return {estado:conectado?'conectado':'reconectando',numero:'525511111111',verificado:conectado};},async codigo(){llamadas.push(['codigo']);return 'ABCD1234';},async recuperar(){},async salir(){conectado=false;},async escribir(){llamadas.push(['escribiendo']);},async enviar(n,tel,text,id){if(antesDeEnviar)await antesDeEnviar();llamadas.push(['envio',tel,text,id]);if(error)throw error;return 'mensaje_'+id;}};
 const politica={envios:true,vincular:true},cola=new Mensajero(db,remoto,politica,async ms=>{esperas.push(ms);ahora+=ms;},()=>.5);
 const control=new ControlWhatsApp(db,remoto,cola,politica,new Set([ids.salon]));
 const ident=(u='admin',aal=u==='admin'?'aal2':'aal1')=>({usuarioId:ids[u],sesionId:sesiones[u],aal});
 async function fuente(data){
  await e.como('admin',ids.salon,c=>c.query(`INSERT INTO ritmo.belleza_objetos AS o(negocio_id,id,version,data,revision,actualizado_en) VALUES($1,$2,1,$3,1,$4) ON CONFLICT(negocio_id,id) DO UPDATE SET data=EXCLUDED.data,version=o.version+1,actualizado_en=EXCLUDED.actualizado_en`,[ids.salon,data.id,data,new Date(ahora)]));
 }
 async function iniciar(extra={}){
  await control.ajustes(ident(),ids.salon,{habilitado:true,direccion:'Calle de prueba 123',...extra});
  await db.usar(c=>c.query("UPDATE ritmo.whatsapp_conexiones SET estado='conectado',esperado='525511111111',numero='525511111111',ultima_conexion=$2 WHERE negocio_id=$1",[ids.salon,new Date(ahora)]));
  await fuente({id:'cejas',kind:'servicio',nombre:'Cejas',duracion:60,precio:500});
  await fuente({id:'clienta',kind:'clienta',nombre:'Clienta de prueba',telefono:'5511111111',whatsappOptIn:true});
 }
 async function cita(extra={}){const c={id:'cita',kind:'cita',date:'2026-11-10',start:'14:00',estado:'pendiente',clienta:'clienta',servicio:'cejas',especialista:ids.especialista,...extra};await fuente(c);return c;}
 return {...e,db,poolMensajero:pool,cola,control,remoto,politica,ident,llamadas,esperas,iniciar,cita,fuente,ahora:()=>ahora,avanzar:ms=>{ahora+=ms;},fijar:t=>{ahora=Date.parse(t);},desconectar:()=>{conectado=false;},fallar:codigo=>{error=Object.assign(new Error('Fallo simulado'),{status:codigo});},antes:fn=>{antesDeEnviar=fn;}};
}
