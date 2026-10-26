import { randomBytes, createHash } from 'node:crypto';
import { ErrorAPI } from '../modelo.js';
import type { ConexionSQL } from '../repositorio.js';
import type { Rol } from './permisos.js';
import type { IdentidadFirmada } from './jwt.js';
import { enTransaccion, miembroVigente } from './contexto.js';
export type InvitacionNueva = { nombre: string; rol: Rol; servicios: string[]; horario: Record<string, [string,string]> };
const id = /^[a-zA-Z0-9_-]{1,120}$/;
const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
function hashCodigo(codigo: string) {
  if (!/^[a-zA-Z0-9_-]{22}$/.test(codigo)) throw new ErrorAPI(404, 'La invitación no está disponible.');
  return createHash('sha256').update(codigo).digest('hex');
}
function validar(datos: InvitacionNueva) {
  if (!datos || typeof datos.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.length > 200 ||
      !['admin','recepcion','especialista'].includes(datos.rol) || !Array.isArray(datos.servicios) ||
      datos.servicios.length > 100 || !datos.servicios.every(v => typeof v === 'string' && id.test(v)) ||
      !datos.horario || typeof datos.horario !== 'object' || Array.isArray(datos.horario) ||
      !Object.entries(datos.horario).every(([dia,tramo]) => ['lun','mar','mie','jue','vie','sab','dom'].includes(dia) &&
        Array.isArray(tramo) && tramo.length === 2 && tramo.every(h => typeof h === 'string' && hora.test(h)) && tramo[0] < tramo[1])) {
    throw new ErrorAPI(400, 'Revisa el nombre, rol, servicios y horario.');
  }
}
export class Invitaciones {
  constructor(private pool: ConexionSQL) {}
  async crear(identidad: IdentidadFirmada, negocioId: string, datos: InvitacionNueva) {
    validar(datos);
    return enTransaccion(this.pool, identidad, negocioId, async c => {
      const miembro = await miembroVigente(c, negocioId, identidad.usuarioId);
      if (miembro.rol !== 'admin') throw new ErrorAPI(403, 'Solo Admin puede invitar al equipo.');
      if (datos.servicios.length) {
        const existentes = (await c.query(`SELECT id FROM ritmo.belleza_objetos
          WHERE negocio_id=$1 AND tipo='servicio' AND data IS NOT NULL AND id=ANY($2::text[])`,[negocioId,datos.servicios])).rows;
        if (existentes.length !== new Set(datos.servicios).size) throw new ErrorAPI(400, 'Algún servicio no está disponible en tu salón.');
      }
      const codigo = randomBytes(16).toString('base64url');
      const r = (await c.query(`INSERT INTO ritmo.invitaciones(negocio_id,codigo_hash,nombre,rol,servicios,horario,creada_por)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING id, vence_en`,
      [negocioId,hashCodigo(codigo),datos.nombre.trim(),datos.rol,[...new Set(datos.servicios)],JSON.stringify(datos.horario),identidad.usuarioId])).rows[0];
      // El código solo se entrega aquí: ni listados, ni registros, ni base lo conservan.
      return { id: r.id as string, codigo, venceEn: r.vence_en };
    });
  }
  private async limitar(ipHash: string) {
    if (!/^[a-f0-9]{64}$/.test(ipHash)) throw new ErrorAPI(400, 'Falta el origen de la solicitud.');
    const c = await this.pool.connect();
    // Autocommit independiente: una invitación inválida no revierte el contador.
    try {
      const r = (await c.query('SELECT ritmo.limitar_invitacion($1) AS permitido',[ipHash])).rows[0];
      if (!r.permitido) throw new ErrorAPI(429, 'Demasiados intentos. Vuelve a intentar en la siguiente hora.');
    } finally { c.release(); }
  }
  // ipHash lo calcula la API con una clave del servidor y la IP de Cloudflare, nunca desde el formulario.
  async ver(codigo: string, ipHash: string) {
    await this.limitar(ipHash);
    const hash = hashCodigo(codigo), c = await this.pool.connect();
    try {
      const r = (await c.query('SELECT ritmo.ver_invitacion($1) AS invitacion',[hash])).rows[0]?.invitacion;
      if (!r) throw new ErrorAPI(404, 'La invitación no está disponible.');
      return r;
    } finally { c.release(); }
  }
  async aceptar(identidad: IdentidadFirmada, codigo: string, perfil: { nombre: string; resumenCorreo: boolean }, ipHash: string) {
    await this.limitar(ipHash);
    const hash = hashCodigo(codigo);
    if (!perfil || typeof perfil.nombre !== 'string' || typeof perfil.resumenCorreo !== 'boolean') throw new ErrorAPI(400, 'Perfil inválido.');
    return enTransaccion(this.pool, identidad, null, async c => {
      try {
        return (await c.query('SELECT ritmo.aceptar_invitacion($1,$2,$3) AS negocio_id',
          [hash,perfil.nombre,perfil.resumenCorreo])).rows[0].negocio_id as string;
      } catch (e: any) {
        if (e?.code === '22023') throw new ErrorAPI(400, e.message === 'Perfil inválido' ? 'Revisa tu nombre.' : 'La invitación no está disponible.');
        throw e;
      }
    });
  }
  async pendientes(identidad: IdentidadFirmada, negocioId: string) {
    return enTransaccion(this.pool, identidad, negocioId, async c => {
      const m = await miembroVigente(c, negocioId, identidad.usuarioId);
      if (m.rol !== 'admin') throw new ErrorAPI(403, 'Solo Admin puede ver invitaciones.');
      return (await c.query(`SELECT id,nombre,rol,servicios,horario,vence_en FROM ritmo.invitaciones
        WHERE negocio_id=$1 AND usada_en IS NULL AND revocada_en IS NULL AND vence_en>now() ORDER BY creada_en DESC`,[negocioId])).rows;
    });
  }
}
