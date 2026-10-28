import {readFile} from 'node:fs/promises';
import {randomBytes,createHmac,randomUUID} from 'node:crypto';
import {preparar,ids,sesiones} from './whatsapp-solo-envios-entorno.mjs';
import {SolicitudesAcceso} from '../build/cuentas/acceso.js';
import {BasePlataforma,NUMERO_CODIGOS} from '../../whatsapp/plataforma.mjs';
import {CodigosWhatsApp} from '../../whatsapp/codigos.mjs';
export {ids,sesiones};
export async function entornoLogin(){
 const e=await preparar();await e.db.usar(()=>Promise.resolve());
 await e.db.pool.connect().then(c=>{c.release();});
 await e.pool.connect().then(async c=>{try{await c.query(await readFile(new URL('../../supabase/migrations/20261028093000_login_whatsapp.sql',import.meta.url),'utf8'));}finally{c.release();}});
 let ahora=Date.now();const key=randomBytes(32).toString('base64'),hookKey=randomBytes(32).toString('base64');
 const solicitudes=new SolicitudesAcceso(e.poolAPI,key,()=>ahora),db=new BasePlataforma(e.poolMensajero,()=>ahora),envios=[];
 const remoto={async estado(){return {estado:'conectado',verificado:true,numero:NUMERO_CODIGOS};},async enviar(n,tel,texto,id){envios.push({n,tel,texto,id});return 'aceptado';}};
 const codigos=new CodigosWhatsApp(db,remoto,{habilitado:true,hookSecret:'v1,whsec_'+hookKey,key,ahora:()=>ahora});
 function evento(phone='525511111111',otp='482913',extra={}){const raw=JSON.stringify({user:{id:ids.admin,phone},sms:{otp},...extra});const id='msg_'+randomUUID().replaceAll('-',''),ts=String(Math.floor(ahora/1000));const headers={'webhook-id':id,'webhook-timestamp':ts,'webhook-signature':'v1,'+createHmac('sha256',Buffer.from(hookKey,'base64')).update(id+'.'+ts+'.'+raw).digest('base64')};return {raw,headers};}
 return {...e,key,hookKey,solicitudes,plataformaDB:db,codigos,remoto,envios,evento,now:()=>ahora,avanzar:ms=>ahora+=ms};
}
