import { createHmac } from 'node:crypto';
import { ErrorAPI } from '../modelo.js';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function instanciaDelSalon(negocioId: string) {
  if (!uuid.test(negocioId)) throw new ErrorAPI(400, 'Salón inválido.');
  return 'agendappx_' + negocioId.toLowerCase().replaceAll('-', '');
}
export function numeroVinculacion(valor: unknown) {
  if (typeof valor !== 'string' || !/^[+\d ()-]{10,25}$/.test(valor)) throw new ErrorAPI(400, 'Revisa tu número con código de país.');
  let d = valor.replace(/\D/g, '');
  if (d.length === 10) d = '52' + d;
  if (d.startsWith('521') && d.length === 13) d = '52' + d.slice(3);
  if (!/^[1-9]\d{10,14}$/.test(d)) throw new ErrorAPI(400, 'Revisa tu número con código de país.');
  return d;
}
export type EstadoEvolution = { estado: 'open' | 'close' | 'connecting' | 'ausente'; numero?: string };
export class ProveedorEvolution {
  private base: string; private publico: string;
  constructor(private config: { url: string; apiKey: string; webhookKey: string; publicURL: string },
    private fetcher: typeof fetch = fetch) {
    const u = new URL(config.url), pub = new URL(config.publicURL);
    if ([u,pub].some(v => v.protocol !== 'https:' || v.username || v.password || v.search || v.hash || v.pathname !== '/') ||
      config.apiKey.length < 32 || config.webhookKey.length < 32) throw new Error('Configura un servidor Evolution dedicado y secretos de al menos 32 caracteres.');
    this.base = u.origin; this.publico = pub.origin;
  }
  claveWebhook(negocioId: string) {
    return createHmac('sha256', this.config.webhookKey).update(instanciaDelSalon(negocioId)).digest('hex');
  }
  private async pedir(ruta: string, metodo = 'GET', datos?: unknown, admite404 = false) {
    let r: Response;
    try {
      r = await this.fetcher(this.base + ruta, { method: metodo,
        headers: { apikey: this.config.apiKey, 'Content-Type': 'application/json' },
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
        ...(datos !== undefined ? { body: JSON.stringify(datos) } : {}) });
    } catch { throw new ErrorAPI(503, 'WhatsApp no respondió. Conservamos tu conexión; intenta de nuevo.'); }
    if (admite404 && r.status === 404) {
      let b: any;
      try { b = await r.json(); } catch { throw new ErrorAPI(503, 'El proveedor todavía no está disponible. Conservamos tu conexión.'); }
      if (b?.status === 404 && b?.error === 'Not Found' && Array.isArray(b?.response?.message)) return null;
      throw new ErrorAPI(503, 'No se pudo verificar si existe la sesión. Conservamos tu conexión.');
    }
    if (r.status===204) return {};
    if (!r.ok) throw new ErrorAPI(503, 'No pudimos comprobar WhatsApp. Conservamos tu conexión.');
    try { return await r.json() as any; }
    catch { throw new ErrorAPI(503, 'WhatsApp devolvió una respuesta incompleta. Conservamos tu conexión.'); }
  }
  async estado(negocioId: string): Promise<EstadoEvolution> {
    const nombre = instanciaDelSalon(negocioId);
    const r = await this.pedir('/instance/connectionState/' + nombre, 'GET', undefined, true);
    if (r === null) return { estado: 'ausente' };
    if (r.instance?.instanceName && r.instance.instanceName !== nombre) throw new ErrorAPI(503, 'No se pudo verificar la conexión del salón.');
    const estado = r.instance?.state;
    if (!['open','close','connecting'].includes(estado)) throw new ErrorAPI(503, 'No se pudo verificar el estado de WhatsApp.');
    if (estado !== 'open') return { estado };
    // No consultar inventarios generales: filtrar y comprobar la instancia exacta.
    const datos = await this.pedir('/instance/fetchInstances?instanceName=' + nombre);
    if (!Array.isArray(datos)) throw new ErrorAPI(503, 'No se pudo verificar el número vinculado.');
    const fila = datos.map(v => v.instance || v).find(v => (v.instanceName || v.name) === nombre);
    const jid = fila?.ownerJid || fila?.owner;
    if (typeof jid !== 'string' || !/^\d+(?::\d+)?@s\.whatsapp\.net$/.test(jid)) throw new ErrorAPI(503, 'Todavía no se pudo confirmar el número vinculado.');
    return { estado: 'open', numero: numeroVinculacion(jid.split('@')[0].split(':')[0]) };
  }
  async crear(negocioId: string) {
    await this.pedir('/instance/create', 'POST', { instanceName: instanciaDelSalon(negocioId),
      integration: 'WHATSAPP-BAILEYS', qrcode: false, groupsIgnore: true, alwaysOnline: false,
      readMessages: false, readStatus: false, syncFullHistory: false, rejectCall: false });
  }
  async configurarWebhook(negocioId: string) {
    await this.pedir('/webhook/set/' + instanciaDelSalon(negocioId), 'POST', { webhook: {
      enabled: true, url: this.publico + '/webhooks/evolution/' + negocioId.toLowerCase(),
      byEvents: false, base64: false,
      headers: { authorization: 'Bearer ' + this.claveWebhook(negocioId) }, events: ['CONNECTION_UPDATE'],
    } });
  }
  async codigo(negocioId: string, numero: string) {
    const r = await this.pedir('/instance/connect/' + instanciaDelSalon(negocioId) + '?number=' + numero);
    let codigo = r.pairingCode;
    if (codigo && typeof codigo === 'object') codigo = codigo.pairingCode || codigo.code;
    if (typeof codigo !== 'string' || !/^[a-zA-Z0-9]{8}$/.test(codigo.replace(/[-\s]/g, ''))) {
      throw new ErrorAPI(503, 'WhatsApp está preparando la vinculación. Espera unos segundos y vuelve a solicitar el código.');
    }
    return codigo.replace(/[-\s]/g, '').toUpperCase();
  }
  async recuperar(negocioId: string) { await this.pedir('/instance/restart/' + instanciaDelSalon(negocioId), 'PUT'); }
  // Solo por una solicitud explícita del Admin. Nunca borrar ni recrear por errores de red.
  async desvincular(negocioId: string) { await this.pedir('/instance/logout/' + instanciaDelSalon(negocioId), 'DELETE', undefined, true); }
}
