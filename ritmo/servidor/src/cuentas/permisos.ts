import { ErrorAPI } from '../modelo.js';

export type Rol = 'admin' | 'recepcion' | 'especialista';
// Identidad obtenida exclusivamente después de verificar la sesión de Supabase.
export type Identidad = { usuarioId: string; aal: 'aal1' | 'aal2' };
export type Miembro = {
  negocioId: string; usuarioId: string; rol: Rol; activo: boolean;
  verTodas: boolean; servicios: readonly string[];
};
export type Accion = 'agenda:leer' | 'cita:editar' | 'clientas:leer' |
  'ingresos:leer' | 'catalogo:leer' | 'catalogo:editar' | 'equipo:editar' |
  'negocio:editar' | 'conexiones:editar' | 'historial:leer' | 'cita:historial';
// Propietario y servicio leídos de la base, nunca aceptados como prueba desde el cliente.
export type Recurso = { negocioId: string; especialistaId?: string; servicioId?: string };
export interface Membresias {
  // Consultar en la transacción actual: nunca reutilizar una membresía entre peticiones.
  buscar(negocioId: string, usuarioId: string): Promise<Miembro | null>;
}

/** Defensa de servidor adicional a RLS; no sustituye los filtros SQL ni la proyección de datos. */
export async function autorizar(
  ident: Identidad, membresias: Membresias, accion: Accion, recurso: Recurso,
): Promise<Miembro> {
  const miembro = await membresias.buscar(recurso.negocioId, ident.usuarioId);
  if (!miembro || !miembro.activo || miembro.negocioId !== recurso.negocioId ||
      miembro.usuarioId !== ident.usuarioId || !['admin', 'recepcion', 'especialista'].includes(miembro.rol)) {
    throw new ErrorAPI(403, 'No tienes acceso a este salón.');
  }
  // Incluso las lecturas de administración exigen el segundo factor.
  if (miembro.rol === 'admin' && ident.aal !== 'aal2') {
    throw new ErrorAPI(403, 'Completa la verificación en dos pasos.');
  }
  const propia = recurso.especialistaId === ident.usuarioId;
  let permitido = false;
  switch (accion) {
    case 'agenda:leer':
      permitido = miembro.rol !== 'especialista' || miembro.verTodas || propia;
      break;
    case 'cita:editar':
      permitido = miembro.rol !== 'especialista' ||
        (propia && typeof recurso.servicioId === 'string' && miembro.servicios.includes(recurso.servicioId));
      break;
    case 'clientas:leer':
      // La consulta debe demostrar una cita propia; verTodas no amplía las clientas.
      permitido = miembro.rol !== 'especialista' || propia;
      break;
    case 'ingresos:leer':
      permitido = miembro.rol === 'admin' || (miembro.rol === 'especialista' && propia);
      break;
    case 'catalogo:leer': permitido = true; break;
    case 'cita:historial':
      permitido = miembro.rol !== 'especialista' || propia;
      break;
    case 'historial:leer': case 'catalogo:editar': case 'equipo:editar': case 'negocio:editar': case 'conexiones:editar':
      permitido = miembro.rol === 'admin';
      break;
  }
  if (!permitido) throw new ErrorAPI(403, 'Tu rol no permite esta acción.');
  return miembro;
}
