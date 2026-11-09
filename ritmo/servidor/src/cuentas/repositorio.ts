import {validarTurnoCita} from '../negocio/reservas.js';
import { createHash } from 'node:crypto';
import { ErrorAPI, validarCambio, type Cambio, type Registro } from '../modelo.js';
import type { ConexionSQL, Repositorio } from '../repositorio.js';
import type { IdentidadFirmada } from './jwt.js';
import { enTransaccion, miembroVigente } from './contexto.js';
import { proyectarRegistro } from './privacidad.js';

/** Repositorio de cuentas; se habilitará al integrar Auth y aprobar la migración. */
export class RepositorioConCuentas implements Repositorio {
  constructor(private pool: ConexionSQL, private identidad: IdentidadFirmada, private negocioId: string) {}
  private ejecutar<T>(fn: Parameters<typeof enTransaccion<T>>[3]) {
    return enTransaccion(this.pool, this.identidad, this.negocioId, fn);
  }
  async salud() { await this.ejecutar(async c => { await miembroVigente(c, this.negocioId, this.identidad.usuarioId); }); }
  async estado() { return (await this.snapshot()).records; }
  async snapshot(_since?: number) {
    return this.ejecutar(async c => {
      const miembro = await miembroVigente(c, this.negocioId, this.identidad.usuarioId);
      // Una sola sentencia da una vista consistente. La lista completa retira del dispositivo
      // las citas que cambiaron de especialista y los permisos que dejaron de aplicar.
      const r = (await c.query(`SELECT e.revision AS cursor,
        COALESCE(jsonb_agg(jsonb_build_object('id',o.id,'version',o.version,'data',o.data,'revision',o.revision))
          FILTER (WHERE o.id IS NOT NULL), '[]'::jsonb) AS records
        FROM ritmo.belleza_estado e LEFT JOIN ritmo.belleza_objetos o ON o.negocio_id = e.negocio_id
        WHERE e.negocio_id = $1 GROUP BY e.revision`, [this.negocioId])).rows[0];
      if (!r) throw new ErrorAPI(403, 'Salón no disponible.');
      return { cursor: r.cursor as number, full: true,
        records: (r.records as Registro[]).map(v => proyectarRegistro(v, miembro)) };
    });
  }
  async cambiar(cambio: Cambio): Promise<Registro> {
    validarCambio(cambio, cambio.id);
    return this.ejecutar(async c => {
      const miembro = await miembroVigente(c, this.negocioId, this.identidad.usuarioId);
      await c.query('SELECT negocio_id FROM ritmo.belleza_estado WHERE negocio_id = $1 FOR UPDATE', [this.negocioId]);
      const actual: Registro = (await c.query(`SELECT id, version, data FROM ritmo.belleza_objetos
        WHERE negocio_id = $1 AND id = $2`, [this.negocioId, cambio.id])).rows[0] || { id: cambio.id, version: 0, data: null };
      const huella = createHash('sha256').update(JSON.stringify({ usuario: miembro.usuarioId, cambio })).digest('hex');
      const previo = (await c.query(`SELECT huella, resultado FROM ritmo.belleza_mutaciones
        WHERE negocio_id = $1 AND id = $2`, [this.negocioId, cambio.mutationId])).rows[0];
      if (previo) {
        if (previo.huella !== huella) throw new ErrorAPI(400, 'Identificador de cambio reutilizado.');
        if (!actual.version || (miembro.rol === 'especialista' && actual.data?.kind === 'cita' && actual.data.especialista !== miembro.usuarioId)) {
          throw new ErrorAPI(403, 'El registro ya no está disponible para tu cuenta.');
        }
        return proyectarRegistro(previo.resultado, miembro);
      }
      if (actual.version !== cambio.baseVersion) throw new ErrorAPI(409,
        'Hay cambios de otro dispositivo. Elige qué versión conservar.', proyectarRegistro(actual, miembro));
      if(cambio.data?.kind==='cita'&&(!actual.data||['date','start','servicio','especialista'].some(k=>actual.data?.[k]!==cambio.data?.[k])||actual.data.estado==='solicitada'&&cambio.data.estado!=='solicitada'))await validarTurnoCita(c,this.negocioId,cambio.data,miembro);
      // Impedir que un intento con id ajeno invisible se presente como alta.
      // ON CONFLICT queda sujeto a USING y WITH CHECK de RLS.
      const revision = (await c.query(`UPDATE ritmo.belleza_estado SET revision = revision + 1
        WHERE negocio_id = $1 RETURNING revision`, [this.negocioId])).rows[0]?.revision;
      if (revision === undefined) throw new ErrorAPI(403, 'Salón no disponible.');
      // Editar el nombre o las notas no debe sustituir el teléfono real por su versión oculta.
      const data = miembro.rol === 'especialista' && cambio.data?.kind === 'clienta' && actual.data
        ? { ...cambio.data, telefono: actual.data.telefono, whatsappOptIn: actual.data.whatsappOptIn ?? false }
        : cambio.data;
      const resultado = { id: cambio.id, version: actual.version + 1, data, revision };
      await c.query(`INSERT INTO ritmo.belleza_objetos(negocio_id,id,version,data,revision)
        VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT (negocio_id,id) DO UPDATE SET
        version=EXCLUDED.version,data=EXCLUDED.data,revision=EXCLUDED.revision,actualizado_en=now()`,
      [this.negocioId, resultado.id, resultado.version, JSON.stringify(resultado.data), revision]);
      await c.query(`INSERT INTO ritmo.belleza_mutaciones(negocio_id,id,usuario_id,huella,resultado)
        VALUES ($1,$2,$3,$4,$5::jsonb)`, [this.negocioId, cambio.mutationId, miembro.usuarioId, huella, JSON.stringify(resultado)]);
      return proyectarRegistro(resultado, miembro);
    }).catch(e => {
      if (e?.code === '42501' || e?.code === '23505') throw new ErrorAPI(403, 'Tu cuenta no puede modificar ese registro.');
      throw e;
    });
  }
  async historial(citaId?: string) {
    return this.ejecutar(async c => {
      const miembro = await miembroVigente(c, this.negocioId, this.identidad.usuarioId);
      if (!citaId && miembro.rol !== 'admin') throw new ErrorAPI(403, 'Solo Admin puede consultar el historial del salón.');
      const filas = (await c.query(`SELECT id, usuario_id, accion, objeto_id, antes, despues, en
        FROM ritmo.bitacora WHERE negocio_id = $1 AND ($2::text IS NULL OR objeto_id = $2)
        ORDER BY en DESC, id DESC LIMIT 200`, [this.negocioId, citaId || null])).rows;
      return filas.map(f => ({ ...f,
        antes: proyectarRegistro({ id: f.objeto_id, version: 0, data: f.antes }, miembro).data,
        despues: proyectarRegistro({ id: f.objeto_id, version: 0, data: f.despues }, miembro).data,
      }));
    });
  }
}
