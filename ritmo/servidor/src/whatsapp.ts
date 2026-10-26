import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { ConexionSQL, Repositorio } from './repositorio.js';
import type { Objeto } from './modelo.js';
import { fechaUTC, telefono } from './integraciones.js';

export type ConfigWhatsApp = { token?: string; phoneId?: string; verifyToken?: string; appSecret?: string; version?: string; tz?: string };
const DIA = 24 * 60 * 60 * 1000;
const objeto = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
export class WhatsApp {
  private ocupado = false;
  constructor(private pool: ConexionSQL, private repo: Repositorio, private config: ConfigWhatsApp,
    private fetcher: typeof fetch = fetch, private ahora: () => number = Date.now) {}
  get configurado() { return !!(this.config.token && this.config.phoneId && this.config.verifyToken && this.config.appSecret); }
  get verificacion() { return this.config.verifyToken || ''; }
  async query(sql: string, params?: unknown[]) {
    const c = await this.pool.connect(); try { return await c.query(sql, params); } finally { c.release(); }
  }
  firmaValida(raw: Buffer, header: string) {
    if (!this.config.appSecret || !/^sha256=[a-f0-9]{64}$/.test(header)) return false;
    const expected = createHmac('sha256', this.config.appSecret).update(raw).digest();
    return timingSafeEqual(expected, Buffer.from(header.slice(7), 'hex'));
  }
  async resumen() {
    const rows = (await this.query('SELECT estado, COUNT(*)::integer AS cantidad FROM belleza_whatsapp_cola GROUP BY estado')).rows;
    return { configurado: this.configurado, modo: 'solo_mensajes_gratuitos', conteos: Object.fromEntries(rows.map(r => [r.estado, r.cantidad])),
      explicacion: this.configurado ? 'Envíos automáticos solo con consentimiento y dentro de las 24 horas desde el último mensaje de la clienta. Fuera de esa ventana usa el envío manual.' : 'Falta conectar el número oficial del salón en Meta. El envío manual sigue disponible.' };
  }
  async webhook(body: unknown) {
    if (!objeto(body) || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return;
    for (const entry of body.entry) for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      const value = change.value;
      if (!objeto(value) || String(value.metadata?.phone_number_id) !== this.config.phoneId) continue;
      for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
        const estados: Record<string, string> = { sent: 'aceptado', delivered: 'entregado', read: 'leido', failed: 'fallido' };
        const estado = estados[status.status];
        if (!estado || typeof status.id !== 'string') continue;
        // Un callback atrasado no hace retroceder una entrega ya confirmada.
        await this.query(`UPDATE belleza_whatsapp_cola SET estado = $1, actualizado_en = now()
          WHERE mensaje_id = $2 AND (estado NOT IN ('entregado','leido') OR $1 = 'leido')`, [estado, status.id]);
      }
      for (const msg of Array.isArray(value.messages) ? value.messages : []) {
        if (typeof msg.id !== 'string' || msg.id.length > 250) continue;
        const phone = telefono(msg.from), timestamp = Number(msg.timestamp) * 1000;
        // No ampliar la ventana con fechas futuras o entradas sin fecha fiable.
        if (!phone || !Number.isFinite(timestamp) || timestamp <= 0 || timestamp > this.ahora() + 60000) continue;
        const text = String(msg.text?.body || msg.button?.payload || msg.interactive?.button_reply?.id || '').trim();
        const c = await this.pool.connect();
        try {
          await c.query('BEGIN');
          await c.query('SELECT id FROM belleza_estado WHERE id = 1 FOR UPDATE');
          const inserted = (await c.query('INSERT INTO belleza_whatsapp_entradas(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id', [msg.id])).rows;
          if (!inserted.length) { await c.query('COMMIT'); continue; }
          await c.query(`INSERT INTO belleza_whatsapp_contactos(telefono, ultimo_mensaje) VALUES($1, $2)
            ON CONFLICT(telefono) DO UPDATE SET ultimo_mensaje = GREATEST(belleza_whatsapp_contactos.ultimo_mensaje, EXCLUDED.ultimo_mensaje)`, [phone, new Date(timestamp)]);
          if (text === '1' || text === '2') {
            const jobs = (await c.query(`SELECT DISTINCT cita_id FROM belleza_whatsapp_cola
              WHERE telefono = $1 AND tipo IN ('confirmacion','recordatorio') AND estado IN ('aceptado','entregado','leido')
              AND creado_en > $2 AND ($3::text IS NULL OR mensaje_id = $3)`, [phone, new Date(this.ahora() - DIA), msg.context?.id || null])).rows;
            // Sin una cita inequívoca, la respuesta queda para atención manual.
            if (jobs.length === 1) {
              const row = (await c.query('SELECT id, version, data FROM belleza_objetos WHERE id = $1', [jobs[0].cita_id])).rows[0];
              if (row?.data?.kind === 'cita' && !['cancelada', 'completada'].includes(row.data.estado)) {
                const client = (await c.query('SELECT data FROM belleza_objetos WHERE id = $1', [row.data.clienta])).rows[0]?.data;
                const start = fechaUTC(row.data.date, row.data.start, this.config.tz);
                if (client?.whatsappOptIn === true && telefono(client.telefono) === phone && start >= this.ahora()) {
                  const data = { ...row.data, estado: text === '1' ? 'confirmada' : 'pendiente', solicitaCambio: text === '2', updatedAt: new Date(this.ahora()).toISOString() };
                  const rev = (await c.query('UPDATE belleza_estado SET revision = revision + 1 WHERE id = 1 RETURNING revision')).rows[0].revision;
                  await c.query('UPDATE belleza_objetos SET version = version + 1, data = $2::jsonb, revision = $3, actualizado_en = now() WHERE id = $1', [row.id, JSON.stringify(data), rev]);
                }
              }
            }
          }
          await c.query('COMMIT');
        } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
      }
    }
  }
  async procesar() {
    if (!this.configurado || this.ocupado) return;
    this.ocupado = true;
    try {
      // Si el proceso murió después de iniciar un envío, no se reintenta a ciegas.
      await this.query("UPDATE belleza_whatsapp_cola SET estado = 'incierto', motivo = 'Revisar antes de reenviar' WHERE estado = 'procesando' AND actualizado_en < $1", [new Date(this.ahora() - 120000)]);
      const records = await this.repo.estado(); const map = new Map(records.filter(r => r.data).map(r => [r.id, r.data as Objeto]));
      const settings = map.get('__settings') || {} as Objeto;
      const contacts = (await this.query('SELECT telefono, ultimo_mensaje FROM belleza_whatsapp_contactos')).rows;
      const windows = new Map(contacts.map(r => [r.telefono, new Date(r.ultimo_mensaje).getTime()]));
      const todays = (await this.query("SELECT COUNT(*)::integer AS cantidad FROM belleza_whatsapp_cola WHERE mensaje_id IS NOT NULL AND actualizado_en >= $1", [new Date(this.ahora() - DIA)])).rows[0].cantidad;
      let enviados = 0;
      for (const cita of map.values()) {
        if (cita.kind !== 'cita' || cita.example || cita.estado === 'cancelada') continue;
        const client = map.get(String(cita.clienta)), service = map.get(String(cita.servicio));
        const phone = telefono(client?.telefono);
        if (!phone || client?.whatsappOptIn !== true || !service || service.example) continue;
        const start = fechaUTC(String(cita.date), String(cita.start), this.config.tz);
        const end = start + Number(service.duracion || 60) * 60000;
        const choices = [
          ['confirmacion', settings.waConfirm !== false && cita.estado !== 'completada' && start > this.ahora(), settings.tplConfirm],
          ['recordatorio', settings.waRecordar !== false && cita.estado !== 'completada' && start > this.ahora() && start - this.ahora() <= DIA, settings.tplRecordar],
          ['gracias', settings.waGracias === true && cita.estado === 'completada' && end <= this.ahora() && this.ahora() - end < DIA, settings.tplGracias],
        ] as const;
        for (const [tipo, due, template] of choices) {
          if (!due || enviados + todays >= 100) continue;
          const fingerprint = `${cita.id}|${cita.date}|${cita.start}|${cita.clienta}|${cita.servicio}|${phone}|${tipo}`;
          const id = createHash('sha256').update(fingerprint).digest('hex');
          const freeWindow = this.ahora() - (windows.get(phone) || 0) < DIA - 120000;
          await this.query(`INSERT INTO belleza_whatsapp_cola(id, cita_id, tipo, telefono, estado, creado_en, actualizado_en)
            VALUES($1,$2,$3,$4,$5,$6,$6) ON CONFLICT DO NOTHING`, [id, cita.id, tipo, phone, freeWindow ? 'pendiente' : 'requiere_ventana', new Date(this.ahora())]);
          if (!freeWindow) continue;
          const claimed = (await this.query(`UPDATE belleza_whatsapp_cola SET estado = 'procesando', actualizado_en = now(), motivo = NULL
            WHERE id = $1 AND estado IN ('pendiente','requiere_ventana') RETURNING id`, [id])).rows;
          if (!claimed.length) continue;
          const fallback = tipo === 'gracias' ? 'Gracias por tu visita, {nombre}.' : 'Hola {nombre}, tu cita de {servicio} es el {fecha} a las {hora}. Responde 1 para confirmar o 2 para solicitar un cambio.';
          const values: Record<string, string> = { nombre: String(client.nombre), servicio: String(service.nombre), fecha: String(cita.date), hora: String(cita.start), negocio: String(settings.negocio || 'Mi salón') };
          const text = String(template || fallback).replace(/\{(nombre|servicio|fecha|hora|negocio)\}/g, (_, k) => values[k]).slice(0, 4000);
          try {
            // Solo mensajes de servicio dentro de la ventana gratuita. No se envían plantillas facturables.
            const result = await this.fetcher(`https://graph.facebook.com/${this.config.version || 'v24.0'}/${this.config.phoneId}/messages`, {
              method: 'POST', headers: { Authorization: 'Bearer ' + this.config.token, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(12000),
              body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } }),
            });
            const answer = await result.json() as any;
            if (result.ok && typeof answer.messages?.[0]?.id === 'string') {
              await this.query("UPDATE belleza_whatsapp_cola SET estado = 'aceptado', mensaje_id = $2, actualizado_en = now() WHERE id = $1", [id, answer.messages[0].id]);
              enviados++;
            } else await this.query("UPDATE belleza_whatsapp_cola SET estado = 'fallido', motivo = $2, actualizado_en = now() WHERE id = $1", [id, 'Meta rechazó el mensaje; revisar antes de reenviar']);
          } catch {
            await this.query("UPDATE belleza_whatsapp_cola SET estado = 'incierto', motivo = 'No se confirmó la respuesta de Meta; no se reenvía automáticamente', actualizado_en = now() WHERE id = $1", [id]);
          }
        }
      }
    } finally { this.ocupado = false; }
  }
}
