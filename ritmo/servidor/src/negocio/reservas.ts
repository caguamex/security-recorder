import type {ClienteSQL} from '../repositorio.js';
import {ErrorAPI} from '../modelo.js';
import {tramosDia,disponible} from './horarios.js';
import type {Miembro} from '../cuentas/permisos.js';
export async function validarTurnoCita(c:ClienteSQL,n:string,d:any,miembro:Miembro){
 if(['cancelada','completada'].includes(d.estado))return;
 const datos=(await c.query("SELECT id,data FROM ritmo.belleza_objetos WHERE negocio_id=$1 AND data IS NOT NULL AND (tipo='servicio' OR id='__settings' OR (tipo='cita' AND data->>'date'=$2))",[n,d.date])).rows;
 const servicio=datos.find(r=>r.id===d.servicio)?.data;if(!servicio||servicio.kind!=='servicio')throw new ErrorAPI(400,'El servicio ya no está disponible.');
 const settings=datos.find(r=>r.id==='__settings')?.data||{abre:'10:00',cierra:'20:00'},duracion=Number(servicio.duracion);
 let horario={},especial;
 if(d.especialista){
  const persona=(await c.query('SELECT usuario_id,horario,servicios FROM ritmo.miembros WHERE negocio_id=$1 AND usuario_id::text=$2 AND activo',[n,d.especialista])).rows[0];
  if(!persona)throw new ErrorAPI(400,'La especialista ya no está disponible.');
  if(miembro.rol!=='admin'&&!persona.servicios.includes(d.servicio))throw new ErrorAPI(403,'Este servicio no está asignado a la especialista.');
  horario=persona.horario||{};especial=(await c.query('SELECT tipo,desde,hasta FROM ritmo.horario_especial WHERE negocio_id=$1 AND usuario_id=$2 AND fecha=$3',[n,persona.usuario_id,d.date])).rows[0];
 }
 const ocupadas=datos.filter(r=>r.data.kind==='cita'&&r.id!==d.id&&r.data.estado!=='cancelada'&&(d.especialista?r.data.especialista===d.especialista:!r.data.especialista)).map(r=>({start:r.data.start,duracion:Number(datos.find(s=>s.id===r.data.servicio)?.data.duracion||r.data.duracion||60)}));
 if(!disponible(d.start,duracion,[[0,1440]],ocupadas))throw new ErrorAPI(409,'Ese horario ya está ocupado. Elige otro.');
 const fuera=!disponible(d.start,duracion,tramosDia(d.date,horario,settings.abre,settings.cierra,especial),[]);
 if(fuera&&(miembro.rol!=='admin'||d.fueraHorario!==true))throw new ErrorAPI(400,miembro.rol==='admin'?'El horario está fuera del turno. Confirma la excepción para agendar.':'Elige un horario dentro del turno y fuera de la comida.');
 if(miembro.rol!=='admin'&&d.fueraHorario)throw new ErrorAPI(403,'Solo Admin puede confirmar una excepción de horario.');
}
