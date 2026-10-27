import { createHash } from 'node:crypto';
import { ErrorAPI } from '../modelo.js';
import { fechaUTC } from '../integraciones.js';
export const TZ='America/Mexico_City';
export type Datos=Record<string,any>;
export type Tipo='inicio'|'anticipo'|'dia'|'antes'|'cambio';
export type Ajustes={habilitado:boolean;anticipoActivo:boolean;porcentaje:number;minimo:number;banco:string;clabe:string;titular:string;direccion:string;horaDia:string;minutosAntes:number;maxHora:number;maxDia:number;maxMes:number};
export const PREDETERMINADOS:Ajustes={habilitado:false,anticipoActivo:false,porcentaje:20,minimo:300,banco:'',clabe:'',titular:'',direccion:'',horaDia:'09:00',minutosAntes:60,maxHora:30,maxDia:150,maxMes:600};
export function configuracion(input:unknown, anterior:Ajustes=PREDETERMINADOS):Ajustes {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(PREDETERMINADOS,k)))throw new ErrorAPI(400,'Configuración de WhatsApp inválida.');
  const a={...anterior,...input} as Ajustes;
  const valido=(ok:boolean,m:string)=>{if(!ok)throw new ErrorAPI(400,m);};
  valido(typeof a.habilitado==='boolean'&&typeof a.anticipoActivo==='boolean','Revisa los interruptores.');
  valido([20,30,50].includes(a.porcentaje)&&typeof a.minimo==='number'&&Number.isFinite(a.minimo)&&a.minimo>=0&&a.minimo<=1000000,'Revisa el porcentaje y precio mínimo.');
  valido(/^([01]\d|2[0-3]):[0-5]\d$/.test(a.horaDia)&&[30,60,120].includes(a.minutosAntes),'Revisa las horas de recordatorio.');
  for(const [k,max] of [['maxHora',30],['maxDia',150],['maxMes',600]] as const)valido(Number.isInteger(a[k])&&a[k]>=1&&a[k]<=max,'Los límites solo pueden reducirse.');
  for(const k of ['banco','titular','direccion','clabe'] as const)valido(typeof a[k]==='string'&&a[k].length<=(k==='direccion'?500:200)&&!/[\r\n\x00]/.test(a[k]),'Datos de transferencia o dirección inválidos.');
  a.clabe=a.clabe.replace(/\s/g,'');
  if(a.anticipoActivo)valido(!!a.banco.trim()&&!!a.titular.trim()&&clabeValida(a.clabe),'Completa banco, titular y una CLABE válida de 18 dígitos.');
  return a;
}
export function clabeValida(s:string){return /^\d{18}$/.test(s)&&Number(s[17])===(10-[...s.slice(0,17)].reduce((n,d,i)=>n+(Number(d)*[3,7,1][i%3])%10,0)%10)%10;}
export function numero(value:unknown){let s=String(value||'').replace(/\D/g,'');if(s.length===10)s='52'+s;if(/^521\d{10}$/.test(s))s='52'+s.slice(3);if(!/^52\d{10}$/.test(s))throw new ErrorAPI(400,'Escribe un número de México de diez dígitos.');return s;}
export function partes(ms:number){return Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(v=>[v.type,v.value]));}
export function dia(ms:number){const p=partes(ms);return `${p.year}-${p.month}-${p.day}`;}
export function silencioso(ms:number){const h=Number(partes(ms).hour);return h<8||h>=21;}
export function siguientePermitido(ms:number){if(!silencioso(ms))return ms;const p=partes(ms),base=new Date(dia(ms)+'T12:00:00Z');if(Number(p.hour)>=21)base.setUTCDate(base.getUTCDate()+1);return fechaUTC(base.toISOString().slice(0,10),'08:00',TZ);}
export function inicio(c:Datos){return fechaUTC(c.date,c.start,TZ);}
export function huella(c:Datos){return createHash('sha256').update(JSON.stringify([c.date,c.start,c.clienta,c.servicio,c.especialista||'',c.estado==='cancelada'?'cancelada':c.estado==='completada'?'completada':'activa'])).digest('hex');}
export function idEnvio(n:string,c:Datos,t:Tipo,h=huella(c)){return createHash('sha256').update([n,c.id,t,h].join('|')).digest('hex');}
export function anticipo(c:Datos,servicio:Datos,a:Ajustes,creada:number){const precio=Math.round(Number(servicio.precio||0)*100)/100,aplica=a.anticipoActivo&&precio>=a.minimo;return {monto:aplica?Math.round(precio*a.porcentaje/100/10)*10:0,estado:aplica?'pendiente':'no_aplica',limite:new Date(Math.max(creada,Math.min(creada+86400000,inicio(c)-7200000))).toISOString()};}
export function plan(c:Datos,a:Ajustes,creada:number,nueva:boolean,movida:boolean,ahora:number){
  const t=inicio(c),out:{tipo:Tipo;debido:number}[]=[];
  if(c.estado==='cancelada'||c.estado==='completada'||t<=ahora)return out;
  if(nueva)out.push({tipo:'inicio',debido:ahora});else if(movida)out.push({tipo:'cambio',debido:ahora});
  let aviso=fechaUTC(c.date,a.horaDia,TZ);
  if(t-aviso<7200000){const d=new Date(c.date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);aviso=fechaUTC(d.toISOString().slice(0,10),'19:00',TZ);}
  if(creada<=aviso-10800000)out.push({tipo:'dia',debido:aviso});
  const antes=t-a.minutosAntes*60000;
  if(creada<=t-5400000&&!silencioso(antes))out.push({tipo:'antes',debido:antes});
  return out;
}
export function mensaje(tipo:Tipo,c:Datos,k:Datos,s:Datos,especialista:string,salon:string,a:Ajustes,p:Datos,debido:number,variante:number){
  const nombre=String(k.nombre||'').split(' ')[0]||'Hola',fecha=new Intl.DateTimeFormat('es-MX',{timeZone:TZ,day:'numeric',month:'long'}).format(new Date(inicio(c))),hora=c.start;
  const precio=Number(s.precio||0),monto=Number(p?.monto||0),moneda=(v:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:2}).format(v);
  const cita=`${s.nombre||'tu servicio'} el ${fecha} a las ${hora}${especialista?' con '+especialista:''} en ${salon||'el salón'}`;
  const recibo=`Recibimos tu anticipo de ${moneda(monto)}. Tu cita de ${cita} está confirmada. Restan ${moneda(Math.max(0,precio-monto))}.`;
  const deposito=p&&p.estado!=='no_aplica'&&p.estado!=='recibido'?` Para confirmarla, envía ${moneda(monto)} antes del ${new Intl.DateTimeFormat('es-MX',{timeZone:TZ,dateStyle:'short',timeStyle:'short'}).format(new Date(p.limite))}. Banco: ${a.banco} · CLABE: ${a.clabe} · A nombre de: ${a.titular}. Envía tu comprobante a este chat para que lo revise el salón.`:'';
  const manana=dia(debido)!==c.date;
  const textos:Record<Tipo,string[]>={
    inicio:[`Hola ${nombre}, apartamos tu cita de ${cita}.${deposito}`,`${nombre}, tu cita de ${cita} quedó agendada.${deposito}`,`Hola ${nombre}. Te esperamos para ${cita}.${deposito}`],
    anticipo:[`¡Gracias, ${nombre}! ${recibo}`,`${nombre}, ya registramos tu pago. ${recibo}`,`Hola ${nombre}, gracias por tu anticipo. ${recibo}`],
    dia:[`Hola ${nombre}, ${manana?'mañana':'hoy'} es tu cita de ${s.nombre} a las ${hora}${especialista?' con '+especialista:''}. Si necesitas cambiarla, escríbenos aquí.`,`${nombre}, te recordamos tu cita de ${s.nombre} para ${manana?'mañana':'hoy'} a las ${hora}. Escríbenos si necesitas cambiarla.`,`Hola ${nombre}. Nos vemos ${manana?'mañana':'hoy'} a las ${hora} para ${s.nombre}. Si hay cambios, avísanos por este chat.`],
    antes:[`${nombre}, te esperamos a las ${hora} para ${s.nombre}. 📍 ${a.direccion}. Si vas con retraso, avísanos por aquí.`,`Hola ${nombre}, tu cita de ${s.nombre} comienza a las ${hora}. Nos encuentras en ${a.direccion}.`,`Ya se acerca tu cita, ${nombre}: ${s.nombre} a las ${hora}. 📍 ${a.direccion}. Escríbenos si necesitas ayuda para llegar.`],
    cambio:[`Hola ${nombre}, tu cita cambió a ${cita}. Si no te queda, responde por aquí.`,`${nombre}, actualizamos tu cita: ${cita}. Avísanos si necesitas otro horario.`,`Hola ${nombre}. El nuevo horario de tu cita es ${cita}. Si tienes dudas, escríbenos.`]
  };return textos[tipo][Math.abs(variante)%3];
}
