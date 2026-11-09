import {ErrorAPI} from '../modelo.js';

export const normalizar=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim();
const raices=(v:string)=>[v,...(v.length>3&&v.endsWith('s')?[v.slice(0,-1)]:[]),...(v.length>5&&v.endsWith('es')?[v.slice(0,-2)]:[])];
export function coincide(texto:string,consulta:string){const tokens=normalizar(texto).split(/\s+/);return normalizar(consulta).split(/\s+/).filter(Boolean).every(q=>tokens.some(t=>raices(q).some(r=>t.startsWith(r))));}
export function recomendacion(promedio:number|null,resenas:number,km:number|null){const ajustada=(resenas*(promedio??4.5)+20*4.5)/(resenas+20);return .7*(ajustada/5)+.3*(km===null?0:1/(1+km/3));}
export function validarPosicion(lat:unknown,lon:unknown){if(lat==null&&lon==null)return null;if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new ErrorAPI(400,'Ubicación inválida.');return {lat,lon};}
