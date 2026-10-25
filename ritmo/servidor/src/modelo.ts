export type Objeto = Record<string, unknown> & { id: string; kind: string };
export type Registro = { id: string; version: number; data: Objeto | Record<string, unknown> | null };
export type Cambio = { id: string; baseVersion: number; mutationId: string; data: Registro['data'] };
export class ErrorAPI extends Error {
  constructor(public status: number, message: string, public current?: Registro) { super(message); }
}
const valido = (condicion: unknown, mensaje: string) => { if (!condicion) throw new ErrorAPI(400, mensaje); };
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const texto = (v: unknown, max = 500) => typeof v === 'string' && v.length <= max;
const hora = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
function fecha(v: unknown) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T12:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
export function validarCambio(body: unknown, id: string): Cambio {
  valido(/^[a-zA-Z0-9_-]{1,120}$/.test(id), 'Identificador inválido.');
  valido(esObjeto(body), 'Se esperaba un objeto JSON.');
  const b = body as Record<string, unknown>;
  valido(Number.isSafeInteger(b.baseVersion) && Number(b.baseVersion) >= 0, 'Versión inválida.');
  valido(typeof b.mutationId === 'string' && /^[a-zA-Z0-9_-]{16,100}$/.test(b.mutationId), 'Identificador de cambio inválido.');
  const data = b.data;
  valido(data === null || esObjeto(data), 'Datos inválidos.');
  if (id === '__settings') {
    valido(esObjeto(data), 'Los ajustes no se pueden eliminar.');
    const settings = data as Record<string, unknown>;
    const keys = ['skin', 'negocio', 'abre', 'cierra', 'examplesOff', 'waConfirm', 'waRecordar', 'waGracias', 'tplConfirm', 'tplRecordar', 'tplGracias'];
    valido(Object.keys(settings).every(k => keys.includes(k)), 'Ajuste desconocido.');
    for (const [k, v] of Object.entries(settings)) {
      if (['examplesOff', 'waConfirm', 'waRecordar', 'waGracias'].includes(k)) valido(typeof v === 'boolean', 'Valor de ajuste inválido.');
      else if (['abre', 'cierra'].includes(k)) valido(hora(v), 'Horario inválido.');
      else if (k === 'skin') valido(['clasico', 'rosa', 'dorado', 'ritmo', 'cristal'].includes(String(v)), 'Tema inválido.');
      else valido(texto(v, 4000), 'Texto de ajuste inválido.');
    }
  } else if (data !== null) {
    const it = data as Objeto;
    valido(it.id === id && ['servicio', 'clienta', 'cita', 'promo', 'grupo'].includes(it.kind), 'Tipo o identificador inválido.');
    for (const value of Object.values(it)) if (typeof value === 'string') valido(texto(value, 10000), 'Texto demasiado largo.');
    if (['servicio', 'clienta', 'grupo'].includes(it.kind)) valido(texto(it.nombre, 200) && !!String(it.nombre).trim(), 'Falta el nombre.');
    if (it.kind === 'servicio') {
      valido(typeof it.precio === 'number' && Number.isFinite(it.precio) && it.precio >= 0 && it.precio <= 1000000, 'Precio inválido.');
      valido(Number.isInteger(it.duracion) && Number(it.duracion) > 0 && Number(it.duracion) <= 1440, 'Duración inválida.');
    }
    if (it.kind === 'cita') {
      valido(fecha(it.date) && hora(it.start), 'Fecha u hora inválida.');
      valido(['pendiente', 'confirmada', 'cancelada', 'completada'].includes(String(it.estado)), 'Estado de cita inválido.');
      valido(typeof it.clienta === 'string' && /^[\w-]{1,120}$/.test(it.clienta) && typeof it.servicio === 'string' && /^[\w-]{1,120}$/.test(it.servicio), 'Falta la clienta o el servicio.');
    }
    if (it.kind === 'promo') valido(texto(it.titulo, 200) && !!String(it.titulo).trim() && texto(it.texto, 10000), 'Promoción inválida.');
    if (it.kind === 'grupo') {
      let url: URL | undefined;
      try { url = new URL(String(it.url)); } catch { /* se valida abajo */ }
      valido(url?.protocol === 'https:' && /(^|\.)facebook\.com$/.test(url.hostname), 'Usa un enlace HTTPS de Facebook.');
    }
  }
  return { id, baseVersion: b.baseVersion as number, mutationId: b.mutationId as string, data: data as Registro['data'] };
}
