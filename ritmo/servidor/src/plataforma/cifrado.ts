import {createCipheriv,createDecipheriv,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

// Respaldo manual de códigos de acceso. Sin dependencias: el servicio de WhatsApp cifra y el Worker descifra para el panel.
const llave=(key:string)=>createHmac('sha256',Buffer.from(key,'base64')).update('codigos-manuales-v1').digest();
export function cifrarCodigo(key:string,d:{telefono:string;codigo:string}){
 if(!/^52\d{10}$/.test(d.telefono)||!/^\d{6}$/.test(d.codigo))throw new Error('Código o teléfono inválido.');
 const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',llave(key),iv),datos=Buffer.concat([c.update(JSON.stringify({t:d.telefono,c:d.codigo}),'utf8'),c.final()]);
 return [iv,c.getAuthTag(),datos].map(b=>b.toString('base64url')).join('.');
}
export function descifrarCodigo(key:string,cifrado:string){
 const [iv,tag,datos]=cifrado.split('.').map(p=>Buffer.from(p,'base64url'));const d=createDecipheriv('aes-256-gcm',llave(key),iv);d.setAuthTag(tag);
 const v=JSON.parse(Buffer.concat([d.update(datos),d.final()]).toString('utf8'));if(!/^52\d{10}$/.test(v.t)||!/^\d{6}$/.test(v.c))throw new Error('Código dañado.');return {telefono:v.t as string,codigo:v.c as string};
}
export const telefonoOculto=(t:string)=>'+52 '+t.slice(2,5)+' ••• '+t.slice(-2);
/** Firma del aviso que manda el servicio de WhatsApp al Worker cuando guarda un código para envío manual. */
export function firmarAviso(key:string,ts:string){return createHmac('sha256',Buffer.from(key,'base64')).update('aviso-codigo-v1\0'+ts).digest('hex');}
export function avisoValido(key:string,ts:unknown,firma:unknown,ahora=Date.now()){
 if(typeof ts!=='string'||!/^\d{10}$/.test(ts)||Math.abs(ahora/1000-Number(ts))>60||typeof firma!=='string'||!/^[a-f0-9]{64}$/.test(firma))return false;
 return timingSafeEqual(Buffer.from(firmarAviso(key,ts),'hex'),Buffer.from(firma,'hex'));
}
