import { ErrorAPI } from '../modelo.js';
import type { ClienteSQL, ConexionSQL } from '../repositorio.js';
import type { Miembro } from './permisos.js';
import type { IdentidadFirmada } from './jwt.js';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validarIdentidad(identidad: IdentidadFirmada) {
  if (!uuid.test(identidad.usuarioId) || typeof identidad.sesionId !== 'string' || !uuid.test(identidad.sesionId) || !['aal1', 'aal2'].includes(identidad.aal)) {
    throw new ErrorAPI(401, 'Inicia sesión de nuevo.');
  }
}
// La identidad procede del verificador JWT, nunca del cuerpo o cabeceras de usuario.
export async function enTransaccion<T>(pool: ConexionSQL, identidad: IdentidadFirmada,
  negocioId: string | null, ejecutar: (cliente: ClienteSQL) => Promise<T>): Promise<T> {
  validarIdentidad(identidad);
  if (negocioId !== null && !uuid.test(negocioId)) throw new ErrorAPI(400, 'Salón inválido.');
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('ritmo.usuario', $1, true), set_config('ritmo.negocio', $2, true),
      set_config('request.jwt.claims', $3, true)`,
    [identidad.usuarioId, negocioId || '', JSON.stringify({ sub: identidad.usuarioId, aal: identidad.aal, session_id: identidad.sesionId })]);
    const sesion = (await c.query('SELECT ritmo.sesion_vigente() AS vigente')).rows[0];
    if (!sesion?.vigente) throw new ErrorAPI(401, 'Tu sesión terminó. Vuelve a iniciar sesión.');
    const resultado = await ejecutar(c);
    await c.query('COMMIT'); return resultado;
  } catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}
export async function miembroVigente(c: ClienteSQL, negocioId: string, usuarioId: string): Promise<Miembro> {
  const m = (await c.query(`SELECT negocio_id, usuario_id, rol, activo, ver_todas, servicios
    FROM ritmo.miembros WHERE negocio_id = $1 AND usuario_id = $2 AND activo`, [negocioId, usuarioId])).rows[0];
  if (!m) throw new ErrorAPI(403, 'No tienes acceso al salón o falta la verificación en dos pasos.');
  return { negocioId: m.negocio_id, usuarioId: m.usuario_id, rol: m.rol,
    activo: m.activo, verTodas: m.ver_todas, servicios: m.servicios };
}
