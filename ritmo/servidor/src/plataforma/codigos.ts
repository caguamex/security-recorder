import webpush from 'web-push';
import type {ConexionSQL} from '../repositorio.js';
import {validarSuscripcion} from '../social/push.js';
export {cifrarCodigo,descifrarCodigo,telefonoOculto,firmarAviso,avisoValido} from './cifrado.js';

type Push={origen:string;publica?:string;privada?:string;fetch?:typeof fetch};
/** Avisa al celular del administrador. Sin contenido sensible: ni teléfono ni código viajan en el aviso. */
export async function avisarCodigos(pool:ConexionSQL,push:Push){
 if(!push.publica||!push.privada)return {codigos:0,enviados:0};
 const c=await pool.connect();let r:any;try{r=(await c.query('SELECT ritmo.plataforma_tomar_avisos_codigos() AS r')).rows[0].r;}finally{c.release();}
 let enviados=0;for(const s of r.dispositivos||[]){try{const sub=validarSuscripcion(s);const det=webpush.generateRequestDetails(sub,JSON.stringify({tipo:'codigo',url:'/plataforma/',etiqueta:'codigo-pendiente'}),{TTL:600,urgency:'high',vapidDetails:{subject:push.origen,publicKey:push.publica,privateKey:push.privada}});
  const res=await(push.fetch||fetch)(det.endpoint,{method:'POST',headers:det.headers,body:new Uint8Array(det.body),redirect:'error',signal:AbortSignal.timeout(8000)});if(res.status===201||res.status===202)enviados++;}catch{/* Sin registrar dispositivos ni contenido. */}}
 return {codigos:r.codigos,enviados};
}
