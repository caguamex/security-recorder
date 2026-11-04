/* Ritmo — núcleo sin dependencias: fechas, repeticiones, festivos, exportar e importar.
   Las fechas son claves locales 'AAAA-MM-DD' y las horas 'HH:MM' (hora local, como en una agenda de papel). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RitmoCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Fechas ----------
  const pad = n => String(n).padStart(2, '0');
  const key = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`; // m: 1-12
  const parts = k => [+k.slice(0, 4), +k.slice(5, 7), +k.slice(8, 10)];
  const isKey = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && validDate(...parts(k));
  const isTime = t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  function validDate(y, m, d) { return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m); }
  function toKey(date) { return key(date.getFullYear(), date.getMonth() + 1, date.getDate()); }
  function fromKey(k) { const [y, m, d] = parts(k); return new Date(y, m - 1, d); }
  function utc(k) { const [y, m, d] = parts(k); return Date.UTC(y, m - 1, d); }
  function addDays(k, n) {
    const [y, m, d] = parts(k);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return key(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  const diffDays = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
  const weekday = k => new Date(utc(k)).getUTCDay(); // 0 = domingo
  const startOfWeek = (k, ws) => addDays(k, -((weekday(k) - ws + 7) % 7));
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  function addMonths(k, n) {
    let [y, m, d] = parts(k);
    m += n;
    y += Math.floor((m - 1) / 12);
    m = ((m - 1) % 12 + 12) % 12 + 1;
    return key(y, m, Math.min(d, daysInMonth(y, m)));
  }
  const monthStart = k => k.slice(0, 8) + '01';
  const monthEnd = k => { const [y, m] = parts(k); return key(y, m, daysInMonth(y, m)); };
  const toMin = t => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null);
  const fromMin = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  function nthWeekday(y, m, wd, n) { // n = 1..5, o -1 para el último
    if (n === -1) { const last = key(y, m, daysInMonth(y, m)); return addDays(last, -((weekday(last) - wd + 7) % 7)); }
    const first = key(y, m, 1);
    const k = addDays(first, (wd - weekday(first) + 7) % 7 + (n - 1) * 7);
    return k.slice(0, 7) === first.slice(0, 7) ? k : null;
  }

  // ---------- Textos en español ----------
  const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DOW_S = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const DOW_1 = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const ORD = { 1: 'primer', 2: 'segundo', 3: 'tercer', 4: 'cuarto', 5: 'quinto', '-1': 'último' };
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

  const CATEGORIES = [
    { id: 'trabajo', name: 'Trabajo' },
    { id: 'personal', name: 'Personal' },
    { id: 'salud', name: 'Salud' },
    { id: 'familia', name: 'Familia' },
    { id: 'estudio', name: 'Estudio' },
    { id: 'otro', name: 'Otro' },
  ];
  const CAT_IDS = CATEGORIES.map(c => c.id);
  const catName = id => (CATEGORIES.find(c => c.id === id) || CATEGORIES[5]).name;

  function fmtLong(k) { const [, m, d] = parts(k); return `${DOW[weekday(k)]} ${d} de ${MES[m - 1]}`; }
  function fmtShort(k) { const [, m, d] = parts(k); return `${DOW_S[weekday(k)]} ${d} ${MES_S[m - 1]}`; }
  function fmtDayMonth(k) { const [, m, d] = parts(k); return `${d} ${MES_S[m - 1]}`; }
  function relDay(k, today) {
    const n = diffDays(today, k);
    if (n === 0) return 'Hoy';
    if (n === 1) return 'Mañana';
    if (n === -1) return 'Ayer';
    if (n === 2) return 'Pasado mañana';
    return null;
  }
  function fmtTime(t, h12) {
    if (!t) return '';
    if (!h12) return t;
    const h = +t.slice(0, 2), mm = t.slice(3, 5);
    return `${h % 12 || 12}:${mm} ${h < 12 ? 'a.m.' : 'p.m.'}`;
  }
  function fmtHour(h, h12) { // etiqueta de la rejilla horaria
    if (!h12) return pad(h) + ':00';
    if (h === 0) return '12 a.m.';
    if (h === 12) return '12 p.m.';
    return `${h % 12} ${h < 12 ? 'a.m.' : 'p.m.'}`;
  }
  function fmtRange(start, end, h12) {
    if (!start) return '';
    return end ? `${fmtTime(start, h12)} – ${fmtTime(end, h12)}` : fmtTime(start, h12);
  }
  function fmtDuration(min) {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  function describeRepeat(r, date) {
    if (!r) return 'No se repite';
    const n = r.interval > 1 ? r.interval : 1;
    let s;
    switch (r.freq) {
      case 'daily': s = n > 1 ? `Cada ${n} días` : 'Cada día'; break;
      case 'weekly': {
        const days = (r.days && r.days.length ? r.days : [weekday(date)]).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
        if (n === 1 && days.join() === '1,2,3,4,5') { s = 'Entre semana (lun a vie)'; break; }
        if (n === 1 && days.join() === '6,0') { s = 'Fines de semana'; break; }
        const list = days.length === 1 ? `el ${DOW[days[0]]}` : days.map(d => DOW_S[d]).join(', ');
        s = n > 1 ? `Cada ${n} semanas: ${list}` : `Cada semana: ${list}`;
        break;
      }
      case 'monthly':
        if (r.monthDays && r.monthDays.join() === '15,-1') { s = 'Cada quincena (15 y fin de mes)'; break; }
        if (r.nth) { s = `${n > 1 ? `Cada ${n} meses` : 'Cada mes'} el ${ORD[r.nth]} ${DOW[r.wd]}`; break; }
        {
          const days = r.monthDays && r.monthDays.length ? r.monthDays : [parts(date)[2]];
          const list = days.map(d => (d === -1 ? 'último día' : `día ${d}`)).join(' y ');
          s = `${n > 1 ? `Cada ${n} meses` : 'Cada mes'} el ${list}`;
        }
        break;
      case 'yearly': { const [, m, d] = parts(date); s = `Cada año el ${d} de ${MES[m - 1]}`; break; }
      default: s = 'Se repite';
    }
    if (r.until) s += `, hasta el ${fmtDayMonth(r.until)}`;
    return s;
  }

  // ---------- Repeticiones ----------
  // Inicios de ocurrencia de un elemento entre a y b (claves, inclusive).
  function occurrenceStarts(it, a, b, ignoreEx) {
    const out = [];
    const first = it.date;
    const r = it.repeat;
    if (!r) { if (first >= a && first <= b) out.push(first); return out; }
    const until = r.until && r.until < b ? r.until : b;
    const from = first > a ? first : a;
    if (from > until) return out;
    const n = Math.max(1, (r.interval | 0) || 1);
    const ex = !ignoreEx && it.exdates && it.exdates.length ? new Set(it.exdates) : null;
    const push = k => { if (!ex || !ex.has(k)) out.push(k); };
    switch (r.freq) {
      case 'daily': {
        const off = Math.ceil(diffDays(first, from) / n) * n;
        for (let k = addDays(first, off); k <= until; k = addDays(k, n)) push(k);
        break;
      }
      case 'weekly': {
        const days = r.days && r.days.length ? r.days : [weekday(first)];
        const anchor = startOfWeek(first, 0);
        for (let k = from; k <= until; k = addDays(k, 1)) {
          if (!days.includes(weekday(k))) continue;
          if (n > 1 && Math.floor(diffDays(anchor, k) / 7) % n) continue;
          push(k);
        }
        break;
      }
      case 'monthly': {
        const [fy, fm, fd] = parts(first);
        let [y, m] = parts(from);
        while (key(y, m, 1) <= until) {
          if (((y - fy) * 12 + (m - fm)) % n === 0) {
            const dim = daysInMonth(y, m);
            let ks;
            if (r.nth) ks = [nthWeekday(y, m, r.wd, r.nth)].filter(Boolean);
            else ks = (r.monthDays && r.monthDays.length ? r.monthDays : [fd])
              .map(md => (md < 0 ? dim + 1 + md : md)).filter(d => d >= 1 && d <= dim).map(d => key(y, m, d));
            for (const k of [...new Set(ks)].sort()) if (k >= from && k <= until) push(k);
          }
          if (++m > 12) { m = 1; y++; }
        }
        break;
      }
      case 'yearly': {
        const [fy, fm, fd] = parts(first);
        for (let y = parts(from)[0]; y <= parts(until)[0]; y++) {
          if ((y - fy) % n || fd > daysInMonth(y, fm)) continue;
          const k = key(y, fm, fd);
          if (k >= from && k <= until) push(k);
        }
        break;
      }
    }
    return out;
  }

  // Apariciones por día: un evento de varios días aparece en cada día que abarca.
  function occurrences(it, a, b) {
    const span = it.type !== 'task' && it.allDay && it.days > 1 ? it.days : 1;
    const out = [];
    for (const s of occurrenceStarts(it, span > 1 ? addDays(a, -(span - 1)) : a, b)) {
      for (let i = 0; i < span; i++) {
        const d = i ? addDays(s, i) : s;
        if (d >= a && d <= b) out.push({ item: it, date: d, occ: s, idx: i, span });
      }
    }
    return out;
  }

  const isDone = (it, occ) => (it.repeat ? (it.doneDates || []).includes(occ) : !!it.done);

  // Columnas para eventos que se enciman en una línea de tiempo. evs: [{s, e}] en minutos.
  function layoutColumns(evs) {
    evs.sort((x, y) => x.s - y.s || (y.e - y.s) - (x.e - x.s));
    let cluster = [], colsEnd = [], clusterEnd = -1;
    const flush = () => { cluster.forEach(o => { o.cols = colsEnd.length; }); cluster = []; colsEnd = []; clusterEnd = -1; };
    for (const ev of evs) {
      if (cluster.length && ev.s >= clusterEnd) flush();
      let c = colsEnd.findIndex(end => end <= ev.s);
      if (c === -1) { c = colsEnd.length; colsEnd.push(ev.e); } else colsEnd[c] = ev.e;
      ev.col = c;
      cluster.push(ev);
      clusterEnd = Math.max(clusterEnd, ev.e);
    }
    flush();
    return evs;
  }

  // ---------- Días festivos de México ----------
  function easter(y) { // algoritmo gregoriano anónimo
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return key(y, month, day);
  }
  // official = descanso obligatorio (art. 74 de la Ley Federal del Trabajo); el resto son fechas que se celebran.
  function holidaysMX(y) {
    const e = easter(y);
    const H = (date, title, official) => ({ date, title, official });
    return [
      H(key(y, 1, 1), 'Año Nuevo', true),
      H(nthWeekday(y, 2, 1, 1), 'Día de la Constitución', true),
      H(nthWeekday(y, 3, 1, 3), 'Natalicio de Benito Juárez', true),
      H(addDays(e, -3), 'Jueves Santo', false),
      H(addDays(e, -2), 'Viernes Santo', false),
      H(key(y, 4, 30), 'Día del Niño', false),
      H(key(y, 5, 1), 'Día del Trabajo', true),
      H(key(y, 5, 10), 'Día de las Madres', false),
      H(nthWeekday(y, 6, 0, 3), 'Día del Padre', false),
      H(key(y, 9, 16), 'Día de la Independencia', true),
      (y - 2024) % 6 === 0 ? H(key(y, 10, 1), 'Transmisión del Poder Ejecutivo', true) : null,
      H(key(y, 11, 2), 'Día de Muertos', false),
      H(nthWeekday(y, 11, 1, 3), 'Revolución Mexicana', true),
      H(key(y, 12, 12), 'Día de la Virgen de Guadalupe', false),
      H(key(y, 12, 24), 'Nochebuena', false),
      H(key(y, 12, 25), 'Navidad', true),
    ].filter(Boolean);
  }
  function holidaysBetween(a, b) {
    const out = [];
    for (let y = parts(a)[0]; y <= parts(b)[0]; y++) for (const h of holidaysMX(y)) if (h.date >= a && h.date <= b) out.push(h);
    return out;
  }

  // ---------- Validación (datos importados o propuestos por Claude) ----------
  function sanitizeRepeat(r) {
    if (!r || typeof r !== 'object' || !['daily', 'weekly', 'monthly', 'yearly'].includes(r.freq)) return null;
    const out = { freq: r.freq, interval: Math.min(99, Math.max(1, parseInt(r.interval, 10) || 1)) };
    const ints = (arr, lo, hi) => (Array.isArray(arr) ? [...new Set(arr.map(Number).filter(n => Number.isInteger(n) && n >= lo && n <= hi))] : []);
    if (r.freq === 'weekly') { const d = ints(r.days, 0, 6); if (d.length) out.days = d; }
    if (r.freq === 'monthly') {
      const nth = Number(r.nth), wd = Number(r.wd);
      if ((nth === -1 || (nth >= 1 && nth <= 5)) && wd >= 0 && wd <= 6 && Number.isInteger(wd)) { out.nth = nth; out.wd = wd; }
      else { const md = ints(r.monthDays, -1, 31).filter(n => n !== 0); if (md.length) out.monthDays = md; }
    }
    if (isKey(r.until)) out.until = r.until;
    return out;
  }
  function sanitizeItem(raw, today) {
    if (!raw || typeof raw !== 'object') return null;
    const title = String(raw.title || '').trim().slice(0, 200);
    if (!title) return null;
    const type = raw.type === 'task' ? 'task' : 'event';
    const date = isKey(raw.date) ? raw.date : today;
    const start = type === 'event' && isTime(raw.start) ? raw.start : null;
    let end = start && isTime(raw.end) ? raw.end : null;
    if (start && !end) end = fromMin(toMin(start) + 60);
    const allDay = type === 'event' && !start;
    const days = allDay ? Math.min(366, Math.max(1, parseInt(raw.days, 10) || 1)) : 1;
    return {
      type, title, date, allDay, start, end, days,
      repeat: sanitizeRepeat(raw.repeat),
      category: CAT_IDS.includes(raw.category) ? raw.category : 'personal',
      location: String(raw.location || '').trim().slice(0, 200),
      notes: String(raw.notes || '').trim().slice(0, 4000),
      exdates: Array.isArray(raw.exdates) ? raw.exdates.filter(isKey) : [],
      doneDates: Array.isArray(raw.doneDates) ? raw.doneDates.filter(isKey) : [],
      done: !!raw.done,
    };
  }

  // ---------- Exportar ----------
  const DAYCODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function fold(line) { // líneas de máximo 75 bytes (RFC 5545)
    const enc = new TextEncoder();
    let out = '', cur = '', bytes = 0;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (bytes + b > 75) { out += cur + '\r\n '; cur = ''; bytes = 1; }
      cur += ch; bytes += b;
    }
    return out + cur;
  }
  function toICS(items, opts) {
    const o = opts || {};
    const stamp = (o.now || new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const d8 = k => k.replace(/-/g, '');
    const dt = (k, t) => d8(k) + 'T' + t.replace(':', '') + '00';
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ritmo//Agenda//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Ritmo'];
    if (o.tz) L.push('X-WR-TIMEZONE:' + o.tz);
    for (const it of items) {
      const task = it.type === 'task';
      const dateOnly = task || it.allDay || !it.start;
      L.push(task ? 'BEGIN:VTODO' : 'BEGIN:VEVENT', 'UID:' + it.id + '@ritmo', 'DTSTAMP:' + stamp, 'SUMMARY:' + icsEsc(it.title));
      if (task) {
        L.push('DTSTART;VALUE=DATE:' + d8(it.date), 'DUE;VALUE=DATE:' + d8(it.date), 'STATUS:' + (it.done ? 'COMPLETED' : 'NEEDS-ACTION'));
      } else if (dateOnly) {
        L.push('DTSTART;VALUE=DATE:' + d8(it.date), 'DTEND;VALUE=DATE:' + d8(addDays(it.date, Math.max(1, it.days || 1))));
      } else {
        const end = it.end || fromMin(toMin(it.start) + 60);
        L.push('DTSTART:' + dt(it.date, it.start), 'DTEND:' + dt(toMin(end) <= toMin(it.start) ? addDays(it.date, 1) : it.date, end));
      }
      if (it.repeat) {
        const r = it.repeat, p = ['FREQ=' + r.freq.toUpperCase()];
        if (r.interval > 1) p.push('INTERVAL=' + r.interval);
        if (r.freq === 'weekly' && r.days && r.days.length) p.push('BYDAY=' + r.days.map(d => DAYCODES[d]).join(','));
        if (r.freq === 'monthly' && r.nth) p.push('BYDAY=' + r.nth + DAYCODES[r.wd]);
        else if (r.freq === 'monthly' && r.monthDays && r.monthDays.length) p.push('BYMONTHDAY=' + r.monthDays.join(','));
        if (r.until) p.push('UNTIL=' + (dateOnly ? d8(r.until) : d8(r.until) + 'T235959'));
        L.push('RRULE:' + p.join(';'));
        if (it.exdates && it.exdates.length) {
          L.push(dateOnly ? 'EXDATE;VALUE=DATE:' + it.exdates.map(d8).join(',') : 'EXDATE:' + it.exdates.map(k => dt(k, it.start)).join(','));
        }
      }
      if (it.location) L.push('LOCATION:' + icsEsc(it.location));
      if (it.notes) L.push('DESCRIPTION:' + icsEsc(it.notes));
      if (it.category) L.push('CATEGORIES:' + icsEsc(catName(it.category)));
      L.push(task ? 'END:VTODO' : 'END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  // CSV con las columnas que acepta Google Calendar (las repeticiones se expanden en fechas sueltas).
  const csvCell = v => (/[",\r\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  function toGoogleCSV(items, a, b) {
    const us = k => { const [y, m, d] = parts(k); return `${pad(m)}/${pad(d)}/${y}`; };
    const t12 = t => { const h = +t.slice(0, 2); return `${h % 12 || 12}:${t.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`; };
    const rows = [['Subject', 'Start Date', 'Start Time', 'End Date', 'End Time', 'All Day Event', 'Description', 'Location', 'Private']];
    for (const it of items) {
      for (const o of occurrences(it, a, b)) {
        if (o.idx > 0) continue;
        const task = it.type === 'task';
        const allDay = task || it.allDay || !it.start;
        const end = it.end || (it.start ? fromMin(toMin(it.start) + 60) : null);
        const endK = allDay ? addDays(o.occ, Math.max(1, it.days || 1) - 1) : (toMin(end) <= toMin(it.start) ? addDays(o.occ, 1) : o.occ);
        rows.push([(task ? 'Pendiente: ' : '') + it.title, us(o.occ), allDay ? '' : t12(it.start), us(endK), allDay ? '' : t12(end),
          allDay ? 'True' : 'False', it.notes || '', it.location || '', 'True']);
      }
    }
    return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  // ---------- ZIP (escribir sin compresión; leer con o sin compresión) ----------
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files, date) {
    const enc = new TextEncoder(), t = date || new Date();
    const dosTime = (t.getHours() << 11) | (t.getMinutes() << 5) | (t.getSeconds() >> 1);
    const dosDate = ((t.getFullYear() - 1980) << 9) | ((t.getMonth() + 1) << 5) | t.getDate();
    const chunks = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
      chunks.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, c) => s + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = [...chunks, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
    let p = 0;
    for (const c of all) { out.set(c, p); p += c.length; }
    return out;
  }
  async function unzip(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('El archivo no es un .zip válido.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = [];
    for (let i = 0; i < count && dv.getUint32(p, true) === 0x02014b50; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const data = u8.subarray(start, start + csize);
      let bytes = null;
      if (method === 0) bytes = data;
      else if (method === 8 && typeof DecompressionStream === 'function') {
        bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      }
      out.push({ name, bytes });
      p += 46 + nlen + elen + clen;
    }
    return out;
  }

  // ---------- Importar .ics ----------
  function zonedToDate(y, mo, d, h, mi, s, tz) {
    const target = Date.UTC(y, mo - 1, d, h, mi, s);
    try {
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      let guess = target;
      for (let i = 0; i < 2; i++) {
        const p = {};
        for (const x of fmt.formatToParts(new Date(guess))) p[x.type] = x.value;
        guess += target - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
      }
      return new Date(guess);
    } catch (e) { return new Date(y, mo - 1, d, h, mi, s); } // zona desconocida: hora local
  }
  function icsValueToLocal(value, params) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    if (h === undefined || params.VALUE === 'DATE') return { date: `${y}-${mo}-${d}`, time: null };
    let dt;
    if (z) dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)));
    else if (params.TZID) dt = zonedToDate(+y, +mo, +d, +h, +mi, +(s || 0), params.TZID.replace(/^"|"$/g, ''));
    else return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
    return { date: toKey(dt), time: pad(dt.getHours()) + ':' + pad(dt.getMinutes()) };
  }
  const icsUnesc = s => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  function parseDuration(v) {
    const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v || '');
    if (!m) return null;
    return ((+m[2] || 0) * 7 * 1440 + (+m[3] || 0) * 1440 + (+m[4] || 0) * 60 + (+m[5] || 0)) * (m[1] === '-' ? -1 : 1);
  }
  function parseICS(text) {
    const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    const out = [];
    let cur = null, nested = 0;
    for (const line of lines) {
      if (/^BEGIN:(VEVENT|VTODO)$/i.test(line)) { cur = { kind: line.slice(6).toUpperCase(), p: {}, ex: [] }; nested = 0; continue; }
      if (!cur) continue;
      if (/^BEGIN:/i.test(line)) { nested++; continue; }
      if (/^END:(VEVENT|VTODO)$/i.test(line)) { const it = icsToItem(cur); if (it) out.push(it); cur = null; continue; }
      if (/^END:/i.test(line)) { nested = Math.max(0, nested - 1); continue; }
      if (nested) continue;
      const m = /^([A-Za-z0-9-]+)((?:;[^:]*)*):(.*)$/.exec(line);
      if (!m) continue;
      const name = m[1].toUpperCase(), params = {};
      for (const kv of m[2].split(';').slice(1)) { const i = kv.indexOf('='); if (i > 0) params[kv.slice(0, i).toUpperCase()] = kv.slice(i + 1); }
      if (name === 'EXDATE') { for (const v of m[3].split(',')) { const x = icsValueToLocal(v, params); if (x) cur.ex.push(x.date); } }
      else cur.p[name] = { value: m[3], params };
    }
    return out;
  }
  function icsToItem(c) {
    const P = c.p, task = c.kind === 'VTODO';
    const title = P.SUMMARY ? icsUnesc(P.SUMMARY.value).trim() : '';
    const startP = P.DTSTART || P.DUE;
    if (!title || !startP) return null;
    const s = icsValueToLocal(startP.value, startP.params);
    if (!s) return null;
    const it = { type: task ? 'task' : 'event', title, date: s.date, allDay: !task && !s.time, start: task ? null : s.time, end: null, days: 1 };
    if (!task) {
      let e = P.DTEND ? icsValueToLocal(P.DTEND.value, P.DTEND.params) : null;
      if (!e && P.DURATION) {
        const dur = parseDuration(P.DURATION.value);
        if (dur != null) {
          if (s.time) { const tot = toMin(s.time) + dur; e = { date: addDays(s.date, Math.floor(tot / 1440)), time: fromMin(tot) }; }
          else e = { date: addDays(s.date, Math.max(1, Math.round(dur / 1440))), time: null };
        }
      }
      if (s.time) {
        if (e && e.time) {
          const spanDays = diffDays(s.date, e.date);
          if (spanDays >= 2) { it.allDay = true; it.start = null; it.days = spanDays + 1; }
          else it.end = e.time;
        }
        if (it.start && !it.end) it.end = fromMin(toMin(it.start) + 60);
      } else if (e) it.days = Math.max(1, diffDays(s.date, e.date));
    } else it.done = P.STATUS ? /COMPLETED/i.test(P.STATUS.value) : false;
    if (P.LOCATION) it.location = icsUnesc(P.LOCATION.value).trim();
    if (P.DESCRIPTION) it.notes = icsUnesc(P.DESCRIPTION.value).trim();
    if (P.CATEGORIES) {
      const cat = P.CATEGORIES.value.toLowerCase();
      const hit = CATEGORIES.find(x => cat.includes(x.id) || cat.includes(x.name.toLowerCase()));
      if (hit) it.category = hit.id;
    }
    if (P.RRULE) {
      const R = {};
      for (const kv of P.RRULE.value.split(';')) { const i = kv.indexOf('='); if (i > 0) R[kv.slice(0, i).toUpperCase()] = kv.slice(i + 1); }
      const freq = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' }[R.FREQ];
      if (freq) {
        const rep = { freq, interval: parseInt(R.INTERVAL, 10) || 1 };
        const byday = R.BYDAY ? R.BYDAY.split(',') : [];
        if (freq === 'weekly' && byday.length) rep.days = byday.map(x => DAYCODES.indexOf(x.slice(-2))).filter(n => n >= 0);
        if (freq === 'monthly') {
          const nthM = byday.length === 1 && /^([+-]?\d)(SU|MO|TU|WE|TH|FR|SA)$/.exec(byday[0]);
          if (nthM) { rep.nth = +nthM[1] < 0 ? -1 : +nthM[1]; rep.wd = DAYCODES.indexOf(nthM[2]); }
          else if (R.BYMONTHDAY) rep.monthDays = R.BYMONTHDAY.split(',').map(Number).filter(n => n && n >= -1 && n <= 31);
        }
        if (R.UNTIL) { const u = icsValueToLocal(R.UNTIL, {}); if (u) rep.until = u.date; }
        it.repeat = rep;
        it.exdates = c.ex;
        if (R.COUNT && !rep.until) {
          const n = parseInt(R.COUNT, 10);
          const starts = occurrenceStarts({ date: it.date, repeat: rep }, it.date, addDays(it.date, 3660), true);
          if (n > 0 && starts.length >= n) rep.until = starts[n - 1];
        }
      }
    }
    return it;
  }

  return {
    pad, key, parts, isKey, isTime, toKey, fromKey, addDays, diffDays, weekday, startOfWeek, daysInMonth, addMonths,
    monthStart, monthEnd, toMin, fromMin, nthWeekday,
    DOW, DOW_S, DOW_1, MES, MES_S, ORD, cap, CATEGORIES, CAT_IDS, catName,
    fmtLong, fmtShort, fmtDayMonth, relDay, fmtTime, fmtHour, fmtRange, fmtDuration, describeRepeat,
    occurrenceStarts, occurrences, isDone, layoutColumns,
    easter, holidaysMX, holidaysBetween,
    sanitizeItem, sanitizeRepeat,
    toICS, toGoogleCSV, zip, unzip, crc32, parseICS,
  };
});
