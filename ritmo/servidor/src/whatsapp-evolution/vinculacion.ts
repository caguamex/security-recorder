import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { ErrorAPI } from '../modelo.js';
import type { ConexionSQL, ClienteSQL } from '../repositorio.js';
import type { IdentidadFirmada } from '../cuentas/jwt.js';
import { enTransaccion, miembroVigente } from '../cuentas/contexto.js';
import { ProveedorEvolution, instanciaDelSalon, numeroVinculacion } from './proveedor.js';
export class VinculacionWhatsApp {
  constructor(private pool: ConexionSQL, private proveedor: ProveedorEvolution,
    private salonesHabilitados: ReadonlySet<string> = new Set()) {}
  private admin<T>(identidad: IdentidadFirmada, negocio: string, fn: (c: ClienteSQL) => Promise<T>) {
    if (!this.salonesHabilitados.has(negocio.toLowerCase())) throw new ErrorAPI(403, 'Este salón todavía no tiene habilitada la vinculación de WhatsApp.');
    return enTransaccion(this.pool, identidad, negocio, async c => {
      const m = await miembroVigente(c, negocio, identidad.usuarioId);
      if (m.rol !== 'admin' || identidad.aal !== 'aal2') throw new ErrorAPI(403, 'Solo Admin con dos pasos puede administrar el WhatsApp del salón.');
      return fn(c);
    });
  }
  private async fila(c: ClienteSQL, negocio: string) {
    const f = (await c.query('SELECT * FROM ritmo.whatsapp_vinculaciones WHERE negocio_id=$1',[negocio])).rows[0];
    if (f && f.instancia !== instanciaDelSalon(negocio)) throw new ErrorAPI(503, 'Revisa la conexión del salón.');
    return f;
  }
  private vista(f: any, verificado = false) {
    return { estado: f?.estado || 'sin_vincular', numero: f?.telefono_vinculado || f?.telefono_esperado || '',
      ultimaConexion: f?.ultima_conexion || null, ultimaRevision: f?.ultima_revision || null,
      detalle: f?.detalle || '', verificado, cerradaManualmente: !!f?.cerrada_manualmente,
      // Vincular no activa envíos. La cola y la aprobación del primer mensaje son etapas aparte.
      enviosActivados: false };
  }
  private async tomar(ident: IdentidadFirmada, negocio: string, tipo: 'codigo'|'recuperar'|'salir', numero?: string) {
    return this.admin(ident, negocio, async c => {
      if (tipo === 'codigo') await c.query(`INSERT INTO ritmo.whatsapp_vinculaciones(negocio_id,instancia,clave_webhook_hash)
        VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [negocio,instanciaDelSalon(negocio),
        createHash('sha256').update(this.proveedor.claveWebhook(negocio)).digest('hex')]);
      await c.query('SELECT negocio_id FROM ritmo.whatsapp_vinculaciones WHERE negocio_id=$1 FOR UPDATE',[negocio]);
      const f = await this.fila(c,negocio);
      if (!f) throw new ErrorAPI(409, 'Primero vincula tu WhatsApp.');
      const ahora = Number((await c.query('SELECT extract(epoch FROM clock_timestamp())*1000 AS ms')).rows[0].ms);
      if (f.operacion_hasta && new Date(f.operacion_hasta).getTime()>ahora) throw new ErrorAPI(409, 'Ya hay una operación de WhatsApp en curso.');
      const mismaVentana = new Date(f.ventana_codigos).getTime()>ahora-300000;
      if (tipo==='codigo' && mismaVentana && f.cantidad_codigos>=3) throw new ErrorAPI(429, 'Espera cinco minutos antes de pedir otro código.');
      if (tipo==='recuperar' && (f.cerrada_manualmente || f.estado==='requiere_vincular' || !f.ultima_conexion)) throw new ErrorAPI(409, 'Esta conexión necesita que Admin la vincule de nuevo.');
      if (tipo==='recuperar' && f.recuperar_despues && new Date(f.recuperar_despues).getTime()>ahora) throw new ErrorAPI(429, 'La recuperación ya está en espera. Conservamos la sesión.');
      if (tipo==='codigo' && f.telefono_vinculado && f.telefono_vinculado!==numero && !f.cerrada_manualmente) throw new ErrorAPI(409, 'Desvincula el número actual antes de elegir otro.');
      const operacion = randomUUID();
      await c.query(`UPDATE ritmo.whatsapp_vinculaciones SET operacion_id=$2,operacion_hasta=now()+interval '90 seconds',
        generacion=generacion+1,actualizado_en=now(),
        telefono_esperado=CASE WHEN $3='codigo' THEN $4 ELSE telefono_esperado END,
        cerrada_manualmente=CASE WHEN $3='salir' THEN true WHEN $3='codigo' THEN false ELSE cerrada_manualmente END,
        ventana_codigos=CASE WHEN $3='codigo' AND NOT $5 THEN now() ELSE ventana_codigos END,
        cantidad_codigos=CASE WHEN $3='codigo' THEN CASE WHEN $5 THEN cantidad_codigos+1 ELSE 1 END ELSE cantidad_codigos END
        WHERE negocio_id=$1`,[negocio,operacion,tipo,numero||null,mismaVentana]);
      return { ...f, operacion, generacion:f.generacion+1 };
    });
  }
  private async terminar(ident: IdentidadFirmada, negocio: string, op: string, estado: string,
    numero: string|null = null, detalle = '', fallo = false) {
    return this.admin(ident, negocio, async c => {
      const r = (await c.query(`UPDATE ritmo.whatsapp_vinculaciones SET estado=$3,
        telefono_vinculado=coalesce($4,telefono_vinculado),detalle=$5,operacion_id=NULL,operacion_hasta=NULL,
        ultima_revision=now(),ultima_conexion=CASE WHEN $3='conectado' THEN now() ELSE ultima_conexion END,
        fallos=CASE WHEN $3='conectado' THEN 0 WHEN $6 THEN fallos+1 ELSE fallos END,
        recuperar_despues=CASE WHEN $6 THEN now()+make_interval(secs=>least(300,30*(2^least(fallos,4)))::integer)
          WHEN $3='conectado' THEN NULL ELSE recuperar_despues END,actualizado_en=now()
        WHERE negocio_id=$1 AND operacion_id=$2 RETURNING *`,[negocio,op,estado,numero,detalle,fallo])).rows[0];
      if (!r) throw new ErrorAPI(409, 'La conexión cambió. Comprueba su estado.');
      return this.vista(r,estado==='conectado');
    });
  }
  async solicitarCodigo(ident: IdentidadFirmada, negocio: string, telefono: unknown) {
    const numero = numeroVinculacion(telefono), f = await this.tomar(ident,negocio,'codigo',numero);
    try {
      const actual = await this.proveedor.estado(negocio);
      if (actual.estado==='open') {
        if (actual.numero!==numero) throw new ErrorAPI(409, 'WhatsApp tiene otro número conectado. Revisa antes de desvincularlo.');
        return { ...await this.terminar(ident,negocio,f.operacion,'conectado',actual.numero), yaConectado:true };
      }
      // Crear solo ante 404 comprobado y petición explícita; nunca por timeout ni por cron.
      if (actual.estado==='ausente') {
        if (f.ultima_conexion && !f.cerrada_manualmente) throw new ErrorAPI(409, 'No encontramos la sesión guardada en el servidor. Revisa su recuperación; no crearemos otra conexión encima.');
        await this.proveedor.crear(negocio);
      }
      await this.proveedor.configurarWebhook(negocio);
      const codigo = await this.proveedor.codigo(negocio,numero);
      return { ...await this.terminar(ident,negocio,f.operacion,'vinculando'), codigo,
        mostrarHasta: new Date(Date.now()+120000).toISOString() };
    } catch (e) {
      await this.terminar(ident,negocio,f.operacion,f.estado,
        null,'No se pudo completar la operación. Conservamos la conexión.',true).catch(()=>{});
      throw e;
    }
  }
  async estado(ident: IdentidadFirmada, negocio: string) {
    const f = await this.admin(ident,negocio,c=>this.fila(c,negocio));
    if (!f || (f.cerrada_manualmente && f.estado==='sin_vincular')) return this.vista(f);
    const r = await this.proveedor.estado(negocio);
    const coincide = r.estado==='open' && r.numero===f.telefono_esperado;
    const estado = coincide ? 'conectado' : r.estado==='open' ? 'revisar' : r.estado==='ausente' ? 'revisar'
      : f.estado==='requiere_vincular' ? f.estado : f.cerrada_manualmente ? 'sin_vincular'
      : f.ultima_conexion ? 'reconectando' : 'vinculando';
    return this.admin(ident,negocio,async c=> {
      // Una respuesta vieja nunca deshace una desvinculación o nueva operación explícita.
      const row = (await c.query(`UPDATE ritmo.whatsapp_vinculaciones SET estado=$3,ultima_revision=now(),
        telefono_vinculado=CASE WHEN $4 THEN $5 ELSE telefono_vinculado END,
        ultima_conexion=CASE WHEN $4 THEN now() ELSE ultima_conexion END,
        fallos=CASE WHEN $4 THEN 0 ELSE fallos END,
        operacion_id=CASE WHEN operacion_hasta<=now() THEN NULL ELSE operacion_id END,
        operacion_hasta=CASE WHEN operacion_hasta<=now() THEN NULL ELSE operacion_hasta END,
        detalle=CASE WHEN $3='revisar' THEN 'No se pudo verificar el número. Conservamos la conexión.' ELSE '' END
        WHERE negocio_id=$1 AND generacion=$2 AND (operacion_id IS NULL OR operacion_hasta<=now()) RETURNING *`,
      [negocio,f.generacion,estado,coincide,r.numero||null])).rows[0];
      return this.vista(row||await this.fila(c,negocio),!!row && coincide);
    });
  }
  async recuperar(ident: IdentidadFirmada, negocio: string) {
    const f = await this.tomar(ident,negocio,'recuperar');
    try {
      const r = await this.proveedor.estado(negocio);
      if (r.estado==='open' && r.numero===f.telefono_esperado) return this.terminar(ident,negocio,f.operacion,'conectado',r.numero);
      if (r.estado==='ausente' || (r.estado==='open' && r.numero!==f.telefono_esperado)) {
        return this.terminar(ident,negocio,f.operacion,'revisar',null,'Revisa el número. No borramos ni creamos otra conexión.');
      }
      if (r.estado==='close') await this.proveedor.recuperar(negocio);
      return this.terminar(ident,negocio,f.operacion,'reconectando',null,'Recuperando la sesión guardada.',true);
    } catch(e) {
      await this.terminar(ident,negocio,f.operacion,f.estado,null,'El servidor no respondió. Conservamos la sesión.',true).catch(()=>{});
      throw e;
    }
  }
  async desvincular(ident: IdentidadFirmada, negocio: string, confirmar: unknown) {
    if (confirmar!==true) throw new ErrorAPI(400, 'Confirma que quieres desvincular este WhatsApp.');
    const f = await this.tomar(ident,negocio,'salir');
    try { await this.proveedor.desvincular(negocio); return await this.terminar(ident,negocio,f.operacion,'sin_vincular'); }
    catch(e) { await this.terminar(ident,negocio,f.operacion,'revisar',null,'Verifica si se cerró la conexión; la recuperación automática está pausada.').catch(()=>{}); throw e; }
  }
  async webhook(negocio: string, authorization: string, body: any) {
    if (!this.salonesHabilitados.has(negocio.toLowerCase())) throw new ErrorAPI(403,'Verificación inválida.');
    const recibido = authorization.startsWith('Bearer ')?authorization.slice(7):'';
    const esperado = this.proveedor.claveWebhook(negocio);
    if (!/^[a-f0-9]{64}$/.test(recibido) || !timingSafeEqual(Buffer.from(recibido),Buffer.from(esperado))) throw new ErrorAPI(403,'Verificación inválida.');
    if (body?.instance!==instanciaDelSalon(negocio) || !['connection.update','CONNECTION_UPDATE'].includes(body?.event)) throw new ErrorAPI(400,'Evento inválido.');
    const cuando = new Date(body.date_time);
    const estado = body.data?.state, motivo = Number(body.data?.statusReason)||0;
    if (!['open','close','connecting'].includes(estado) || !Number.isFinite(cuando.getTime()) || cuando.getTime()>Date.now()+60000 || cuando.getTime()<Date.now()-86400000) throw new ErrorAPI(400,'Evento inválido.');
    const c = await this.pool.connect();
    try { await c.query('SELECT ritmo.evento_vinculacion_whatsapp($1,$2,$3,$4,$5)',[negocio,recibido,estado,motivo,cuando]); }
    finally { c.release(); }
    return { recibido:true };
  }
}
