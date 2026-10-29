import {ErrorAPI} from '../modelo.js';
export const DIAS=['dom','lun','mar','mie','jue','vie','sab'] as const;
export type Horario=Partial<Record<typeof DIAS[number]|'comida',[string,string]|null>>;
const hora=(v:unknown):v is string=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const minutos=(h:string)=>Number(h.slice(0,2))*60+Number(h.slice(3));
export function validarHorario(d:unknown):Horario{
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>![...DIAS,'comida'].includes(k as any)))throw new ErrorAPI(400,'Horario inválido.');
 for(const v of Object.values(d))if(v!==null&&(!Array.isArray(v)||v.length!==2||!v.every(hora)||v[0]>=v[1]))throw new ErrorAPI(400,'El inicio debe ser anterior al cierre, en formato 24 h.');
 return d as Horario;
}
export function tramosDia(fecha:string,horario:Horario,abre='10:00',cierra='20:00',especial?:{tipo:string;desde:string|null;hasta:string|null}){
 const dia=DIAS[new Date(fecha+'T12:00:00Z').getUTCDay()];
 let base=Object.hasOwn(horario,dia)?horario[dia]:[abre,cierra];
 if(especial?.tipo==='libre')base=null;
 if(!base)return [];
 let a=Math.max(minutos(base[0]),minutos(abre)),b=Math.min(minutos(base[1]),minutos(cierra));
 if(especial?.tipo==='horario'&&especial.desde&&especial.hasta){a=Math.max(minutos(especial.desde),minutos(abre));b=Math.min(minutos(especial.hasta),minutos(cierra));}
 const comida=horario.comida;
 return (comida?[[a,Math.min(b,minutos(comida[0]))],[Math.max(a,minutos(comida[1])),b]]:[[a,b]]).filter(([a,b])=>a<b);
}
export function disponible(desde:string,duracion:number,tramos:number[][],ocupadas:{start:string;duracion:number}[]){const a=minutos(desde),b=a+duracion;return tramos.some(([x,y])=>a>=x&&b<=y)&&!ocupadas.some(c=>a<minutos(c.start)+c.duracion&&b>minutos(c.start));}
