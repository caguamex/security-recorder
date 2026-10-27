import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
export class CifradoSesion {
  private llave:Buffer;
  constructor(key:string){this.llave=Buffer.from(key||'','base64');if(!/^[A-Za-z0-9+/]{43}=$/.test(key||'')||this.llave.length!==32)throw new Error('WA_SESSION_KEY debe contener 32 bytes en base64.');}
  id(negocio:string,tipo:string,id:string){return createHmac('sha256',this.llave).update(JSON.stringify([negocio,tipo,id])).digest('hex');}
  sellar(negocio:string,id:string,texto:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',this.llave,iv);c.setAAD(Buffer.from(JSON.stringify([negocio,id,1])));const datos=Buffer.concat([c.update(texto,'utf8'),c.final()]);return {v:1,iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),datos:datos.toString('base64')};}
  abrir(negocio:string,id:string,valor:any){if(valor?.v!==1)throw new Error('Sesión cifrada no compatible.');try{const d=createDecipheriv('aes-256-gcm',this.llave,Buffer.from(valor.iv,'base64'));d.setAAD(Buffer.from(JSON.stringify([negocio,id,1])));d.setAuthTag(Buffer.from(valor.tag,'base64'));return Buffer.concat([d.update(Buffer.from(valor.datos,'base64')),d.final()]).toString('utf8');}catch{throw new Error('No se pudo descifrar la sesión. Conserva la llave y los datos existentes.');}}
}
