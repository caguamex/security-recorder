import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import type { ConexionSQL, Repositorio } from './repositorio.js';
import type { Objeto } from './modelo.js';

export const igualSecreto = (a: string, b: string) => !!a && !!b && timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
export const telefono = (value: unknown) => {
  let n = String(value || '').replace(/\D/g, '');
  if (n.length === 10) n = '52' + n;
  return /^\d{10,15}$/.test(n) ? n : '';
};
export function fechaUTC(date: string, time: string, tz = 'America/Mexico_City') {
  const wanted = Date.parse(`${date}T${time}:00Z`);
  let guess = wanted;
  const format = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(format.formatToParts(new Date(guess)).map(p => [p.type, p.value]));
    const seen = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    guess += wanted - seen;
  }
  return guess;
}
const escapeICS = (value: unknown) => String(value ?? '').replace(/\\/g, '\\\\').replace(/[\r\n]+/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function fold(line: string) {
  const lines: string[] = []; let current = '', size = 0;
  for (const ch of line) {
    const bytes = Buffer.byteLength(ch);
    if (size + bytes > 75) { lines.push(current); current = ' '; size = 1; }
    current += ch; size += bytes;
  }
  return [...lines, current].join('\r\n');
}
export async function calendario(repo: Repositorio, tz: string) {
  const records = await repo.estado(); const map = new Map(records.filter(r => r.data).map(r => [r.id, r]));
  const settings = map.get('__settings')?.data || {};
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ritmo Belleza//Agenda//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Ritmo Belleza', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  for (const record of map.values()) {
    const c = record.data as Objeto;
    if (c.kind !== 'cita' || c.estado === 'cancelada' || c.example) continue;
    const service = map.get(String(c.servicio))?.data || {}, client = map.get(String(c.clienta))?.data || {};
    const start = fechaUTC(String(c.date), String(c.start), tz), end = start + Number(service.duracion || 60) * 60000;
    lines.push('BEGIN:VEVENT', `UID:${escapeICS(c.id)}@ritmo-belleza`, `SEQUENCE:${record.version}`,
      `DTSTAMP:${stamp(Date.parse(String(c.updatedAt)) || start)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      `SUMMARY:${escapeICS(service.nombre || 'Servicio')} · ${escapeICS(client.nombre || 'Clienta')}`,
      `LOCATION:${escapeICS(settings.negocio || 'Mi salón')}`, 'CLASS:PRIVATE',
      'STATUS:' + (c.estado === 'confirmada' || c.estado === 'completada' ? 'CONFIRMED' : 'TENTATIVE'), 'END:VEVENT');
  }
  return lines.map(fold).concat('END:VCALENDAR', '').join('\r\n');
}
export class ConfigIntegraciones {
  constructor(private pool: ConexionSQL) {}
  async tokenCalendario(renovar = false) {
    const c = await this.pool.connect();
    try {
      const token = randomBytes(32).toString('hex');
      if (renovar) await c.query(`INSERT INTO belleza_integraciones(id, data) VALUES ('calendario', $1::jsonb)
        ON CONFLICT(id) DO UPDATE SET data = EXCLUDED.data`, [JSON.stringify({ token })]);
      else await c.query(`INSERT INTO belleza_integraciones(id, data) VALUES ('calendario', $1::jsonb) ON CONFLICT DO NOTHING`, [JSON.stringify({ token })]);
      return (await c.query("SELECT data FROM belleza_integraciones WHERE id = 'calendario'")).rows[0].data.token as string;
    } finally { c.release(); }
  }
}
