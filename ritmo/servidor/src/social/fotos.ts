import {ErrorAPI} from '../modelo.js';
// Conserva imagen y tablas JPEG; retira APPn (EXIF/GPS/IPTC/XMP) y comentarios incluso si se evita el canvas.
export function fotoSinMetadatos(f:unknown):string|null{
 if(f===null||f===undefined||f==='')return null;
 if(typeof f!=='string'||f.length>48000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(f))throw new ErrorAPI(400,'Sube una foto JPEG desde cámara o galería.');
 const b=Buffer.from(f.slice(23),'base64');if(b.length<4||b[0]!==255||b[1]!==216||b.at(-2)!==255||b.at(-1)!==217)throw new ErrorAPI(400,'La foto no es un JPEG válido.');
 const partes=[b.subarray(0,2)];let i=2;
 while(i<b.length){
  if(b[i]!==255)throw new ErrorAPI(400,'JPEG inválido.');const inicio=i;while(b[i]===255)i++;const marca=b[i++];
  if(marca===0xd9){if(i!==b.length)throw new ErrorAPI(400,'JPEG con datos adicionales.');partes.push(b.subarray(inicio,i));break;}
  if(marca===0xd8||marca===0x01||marca>=0xd0&&marca<=0xd7){partes.push(b.subarray(inicio,i));continue;}
  if(i+2>b.length)throw new ErrorAPI(400,'JPEG incompleto.');const n=b.readUInt16BE(i);if(n<2||i+n>b.length)throw new ErrorAPI(400,'JPEG incompleto.');
  if(!(marca>=0xe0&&marca<=0xef)&&marca!==0xfe)partes.push(b.subarray(inicio,i+n));i+=n;
  if(marca===0xda){const desde=i;while(i<b.length){if(b[i]!==255){i++;continue;}const siguiente=b[i+1];if(siguiente===0||siguiente>=0xd0&&siguiente<=0xd7){i+=2;continue;}break;}partes.push(b.subarray(desde,i));}
 }
 return 'data:image/jpeg;base64,'+Buffer.concat(partes).toString('base64');
}
export function limpiarFotos<T>(d:T):T{if(Array.isArray(d))return d.map(limpiarFotos) as T;if(d&&typeof d==='object'){const r:any={};for(const [k,v] of Object.entries(d))r[k]=['foto','logo','portada'].includes(k)?fotoSinMetadatos(v):limpiarFotos(v);return r;}return d;}
