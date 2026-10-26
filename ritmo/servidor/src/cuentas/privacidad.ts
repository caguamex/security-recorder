import type { Registro } from '../modelo.js';
import type { Miembro } from './permisos.js';

export function ocultarTelefono(valor: unknown): string {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) return '';
  return digitos.length < 8 ? '••••' : `${digitos.slice(0, 2)} •••• ${digitos.slice(-4)}`;
}
const notasSinTelefonos = (s: unknown) => typeof s === 'string'
  ? s.replace(/\+?\d[\d ()+.-]{5,}\d/g, v => v.replace(/\D/g, '').length >= 8 ? ocultarTelefono(v) : v) : '';
const campos: Record<string, readonly string[]> = {
  servicio: ['id','kind','nombre','categoria','precio','duracion','descripcion','foto','activo'],
  promo: ['id','kind','titulo','texto','categoria','foto','activo'],
  clienta: ['id','kind','nombre','telefono','notas','whatsappOptIn'],
  cita: ['id','kind','clienta','servicio','especialista','date','start','duracion','estado','notas'],
  ajustes: ['negocio','abre','cierra','skin','modo','examplesOff'],
};

/** Lista de campos permitidos: los campos nuevos son privados hasta revisarlos expresamente. */
export function proyectarRegistro(registro: Registro, miembro: Miembro): Registro {
  if (miembro.rol === 'admin' || !registro.data) return structuredClone(registro);
  const data = registro.data;
  const tipo = registro.id === '__settings' ? 'ajustes' : String(data.kind);
  const limpio: Record<string, unknown> = {};
  for (const campo of campos[tipo] || []) if (Object.hasOwn(data, campo)) limpio[campo] = structuredClone(data[campo]);
  if (miembro.rol === 'especialista') {
    if (tipo === 'clienta') limpio.telefono = ocultarTelefono(data.telefono);
    if (Object.hasOwn(limpio, 'notas')) limpio.notas = notasSinTelefonos(limpio.notas);
    if (tipo === 'cita' && data.especialista !== miembro.usuarioId) {
      delete limpio.clienta; delete limpio.notas;
    }
  }
  return { ...registro, data: limpio };
}
