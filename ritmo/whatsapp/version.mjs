// Consulta pública de compatibilidad; nunca contiene teléfonos ni credenciales.
import {fetchLatestWaWebVersion} from 'baileys';
export function crearResolverVersion({consultar=fetchLatestWaWebVersion,ahora=Date.now}={}){
 let valor,hasta=0,pendiente;
 return async()=>{
  if(valor&&ahora()<hasta)return [...valor];
  if(!pendiente)pendiente=(async()=>{
   const r=await consultar({signal:AbortSignal.timeout(6000)});
   if(!r.isLatest||!Array.isArray(r.version)||r.version.length!==3||r.version.some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('No se pudo comprobar la versión actual de WhatsApp.');
   valor=[...r.version];hasta=ahora()+3600000;return valor;
  })().finally(()=>{pendiente=undefined;});
  return [...await pendiente];
 };
}
export const versionActual=crearResolverVersion();
