/* Ritmo — intérprete de frases en español: "Dentista mañana 5pm" → evento listo para guardar.
   Funciona sin conexión. Cada regla marca el tramo de texto que entendió; lo que sobra es el título. */
(function (root, factory) {
  const core = root && root.RitmoCore ? root.RitmoCore : (typeof require === 'function' ? require('./core.js') : null);
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RitmoParser = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  // Minúsculas y sin acentos, conservando la posición de cada carácter.
  function norm(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const d = s[i].toLowerCase().normalize('NFD');
      out += d.length ? d[0] : s[i];
    }
    return out;
  }

  const WD = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const WD_RE = '(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)';
  const wdOf = w => WD[w.startsWith('sabado') ? 'sabado' : w.startsWith('domingo') ? 'domingo' : w];
  const MONTHS = {
    enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4, mayo: 5, may: 5, junio: 6, jun: 6,
    julio: 7, jul: 7, agosto: 8, ago: 8, septiembre: 9, setiembre: 9, sept: 9, sep: 9, octubre: 10, oct: 10,
    noviembre: 11, nov: 11, diciembre: 12, dic: 12,
  };
  const MON_RE = '(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept|sep|oct|nov|dic)\\.?';
  const monthNum = s => MONTHS[s.replace('.', '')];
  const NUMW = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30 };
  const NUM_RE = '(?:\\d{1,3}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta)';
  const num = s => (/^\d+$/.test(s) ? +s : NUMW[s]);
  const NTH = { primer: 1, primero: 1, '1er': 1, '1o': 1, segundo: 2, '2o': 2, tercer: 3, tercero: 3, '3er': 3, '3o': 3, cuarto: 4, '4o': 4, quinto: 5, ultimo: -1 };

  // Hora: 5 | 5:30 | 17h30 | 5 y media | 5pm | 10 hrs | 8 de la noche. Seis grupos por hora.
  const T = '(\\d{1,2})(?:[:.](\\d{2})|h(\\d{2}))?(?:\\s+(y media|y cuarto|menos cuarto))?\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?|hrs?\\.?|horas|h)?(?![a-z])(?:\\s*(de la manana|de la tarde|de la noche|de la madrugada|del dia|del mediodia))?';
  const U = '(?<u>hasta (?:el |la )?)?'; // "hasta el 15 de diciembre" → fin de la repetición

  function tok(m, i) {
    let h = +m[i], mi = +(m[i + 1] || m[i + 2] || 0);
    if (h > 24 || mi > 59) return null;
    const frac = m[i + 3], ap = (m[i + 4] || '').replace(/[\s.]/g, ''), mod = m[i + 5];
    if (frac === 'y media') mi += 30;
    else if (frac === 'y cuarto') mi += 15;
    else if (frac === 'menos cuarto') { mi += 45; h -= 1; if (h < 0) h = 23; }
    let period = null;
    if (ap === 'am') period = 'am';
    else if (ap === 'pm') period = 'pm';
    else if (ap) period = '24';
    if (mod) {
      if (/manana|madrugada/.test(mod)) period = 'am';
      else if (/tarde/.test(mod)) period = h === 12 ? '24' : 'pm';
      else if (/noche/.test(mod)) period = h === 12 ? 'am' : h >= 6 ? 'pm' : 'am';
      else period = h === 12 || h <= 7 ? 'pm' : 'am';
    }
    return { h, mi, period, hasMin: !!(m[i + 1] || m[i + 2] || frac), explicit: !!period || h >= 13 || h === 0 };
  }
  function resolveHour(t, pref) {
    let h = t.h;
    if (t.period === 'am') { if (h === 12) h = 0; }
    else if (t.period === 'pm') { if (h < 12) h += 12; }
    else if (!(t.period === '24' || h >= 13 || h === 0 || h === 12)) {
      if (pref === 'pm') h += 12;
      else if (pref !== 'am' && h <= 7) h += 12;
    }
    if (h === 24) h = 0;
    return h * 60 + t.mi;
  }
  function resolveRange(t1, t2, pref) {
    let s, e;
    if (!t1.explicit && t2.explicit) {
      e = resolveHour(t2, pref);
      s = (t1.h % 12 === 0 && t1.h === 12 ? 12 : t1.h) * 60 + t1.mi;
      if (t1.h !== 12 && s + 720 < e) s += 720;
    } else {
      s = resolveHour(t1, pref);
      if (t2.explicit) e = resolveHour(t2, pref);
      else {
        const e1 = (t2.h % 12) * 60 + t2.mi, e2 = e1 + 720;
        e = e1 > s ? e1 : e2 > s ? e2 : e1;
      }
    }
    return [s, e];
  }

  const validDate = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= C.daysInMonth(y, m);
  function mkDate(d, m, y, today) {
    if (!m || m < 1 || m > 12 || !d || d < 1 || d > 31) return null;
    if (y) return validDate(y, m, d) ? C.key(y, m, d) : null;
    let yy = C.parts(today)[0];
    const next = from => { for (let i = 0; i < 8; i++) if (validDate(from + i, m, d)) return from + i; return null; };
    yy = next(yy);
    if (yy == null) return null;
    let k = C.key(yy, m, d);
    if (C.diffDays(k, today) > 30) { const y2 = next(yy + 1); if (y2 != null) k = C.key(y2, m, d); }
    return k;
  }

  // Palabras que sugieren categoría. Las de familia pesan más: si alguien de la familia aparece, es de familia.
  const CAT_KW = {
    salud: ['dentista', 'doctor', 'doctora', 'medico', 'medica', 'cita medica', 'hospital', 'clinica', 'consulta', 'terapia', 'psicolog', 'psiquiatra', 'nutriolog', 'analisis', 'laboratorio', 'gym', 'gimnasio', 'yoga', 'pilates', 'correr', 'entrenamiento', 'entrenar', 'crossfit', 'natacion', 'vacuna', 'farmacia', 'oculista', 'oftalmolog', 'dermatolog', 'ginecolog', 'pediatra', 'fisio', 'medicina', 'spinning', 'ortodonc'],
    trabajo: ['junta', 'reunion', 'cliente', 'oficina', 'entrega', 'proyecto', 'presentacion', 'llamada con', 'zoom', 'meet', 'deadline', 'jefe', 'equipo', 'chamba', 'factura', 'facturar', 'nomina', 'cotizacion', 'propuesta', 'sprint', 'demo', 'reporte', 'informe', 'entrevista', 'webinar', 'conferencia', 'capacitacion', 'proveedor', 'ventas', 'cierre', 'auditoria', 'contrato', 'home office', 'presupuesto'],
    familia: ['mama', 'papa', 'mami', 'papi', 'abuel', 'hijo', 'hija', 'ninos', 'nino', 'nina', 'tia', 'tio', 'primo', 'prima', 'familia', 'suegr', 'esposa', 'esposo', 'bebe', 'kinder', 'junta de padres', 'reunion de padres', 'festival escolar', 'sobrin', 'herman'],
    estudio: ['clase', 'examen', 'tarea', 'estudiar', 'curso', 'universidad', 'escuela', 'maestria', 'diplomado', 'ingles', 'frances', 'tesis', 'leer', 'biblioteca', 'taller', 'certificacion', 'colegiatura', 'inscripcion', 'seminario', 'profesor', 'maestro'],
    personal: ['cumpleanos', 'cumple', 'comida', 'cena', 'desayuno', 'cafe', 'fiesta', 'cine', 'viaje', 'vuelo', 'boda', 'peli', 'concierto', 'partido', 'amigos', 'amiga', 'amigo', 'salir', 'pagar', 'banco', 'super', 'mandado', 'renta', 'luz', 'agua', 'gas', 'internet', 'tarjeta', 'comprar', 'regalo', 'corte de pelo', 'peluqueria', 'barberia', 'mascota', 'veterinari', 'perro', 'gato', 'coche', 'carro', 'verificacion', 'tenencia', 'licencia', 'pasaporte', 'tramite', 'misa', 'futbol'],
  };
  const KW_RE = {};
  for (const [cat, list] of Object.entries(CAT_KW)) KW_RE[cat] = list.map(k => ({ re: new RegExp('\\b' + k.replace(/ /g, '\\s+')), w: cat === 'familia' ? 12 : k.length }));
  function inferCategory(text) {
    const n = norm(text);
    let best = null, score = 0;
    for (const [cat, list] of Object.entries(KW_RE)) {
      let s = 0;
      for (const { re, w } of list) if (re.test(n)) s = Math.max(s, w);
      if (s > score) { score = s; best = cat; }
    }
    return best;
  }

  const TASK_START = /^(?:pagar|pago|comprar|llamar|enviar|mandar|revisar|recoger|renovar|hacer|terminar|entregar|sacar|agendar|reservar|contestar|responder|escribir|imprimir|lavar|limpiar|arreglar|cancelar|depositar|transferir|preparar|estudiar|leer|ir|llevar|traer|devolver|checar|confirmar|actualizar|subir|descargar|instalar|tramitar|solicitar|investigar|buscar|organizar|ordenar|tirar|regar|cocinar|planchar|cobrar|facturar|avisar|recordar|tarea)\b/;
  const ALLDAY_KW = /\b(?:cumpleanos|cumple|aniversario|vacaciones|viaje|boda|feriado|puente|graduacion|mudanza|congreso)\b/;
  const CAT_TAGS = { trabajo: 'trabajo', chamba: 'trabajo', oficina: 'trabajo', work: 'trabajo', personal: 'personal', casa: 'personal', salud: 'salud', familia: 'familia', estudio: 'estudio', estudios: 'estudio', escuela: 'estudio', clase: 'estudio', otro: 'otro' };
  const PLACES = { linea: 'En línea', zoom: 'Zoom', meet: 'Google Meet', 'google meet': 'Google Meet', teams: 'Teams' };
  const PART = { manana: '09:00', tarde: '16:00', noche: '20:00' };

  function parse(text, opts) {
    const o = Object.assign({ today: C.toKey(new Date()), nowMin: null }, opts);
    const T0 = o.today, todayWd = C.weekday(T0);
    const n = norm(text);
    const used = new Uint8Array(text.length);
    const free = (a, b) => { for (let i = a; i < b; i++) if (used[i]) return false; return true; };
    function scan(re, fn) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(n))) {
        const a = m.index, b = a + m[0].length;
        if (b === a) { re.lastIndex++; continue; }
        if (!free(a, b) || fn(m, a, b) === false) { re.lastIndex = a + 1; continue; }
        used.fill(1, a, b);
      }
    }
    const R = { type: null, date: null, explicitDate: false, rangeEnd: null, until: null, start: null, end: null, dur: null, part: null, weekHint: null, repeat: null, category: null, location: '', allDayExplicit: false };
    const pref = /\b(?:cena|cenar|noche|fiesta|antro|cine|concierto|comida|comer|bar|merienda|copas|chelas|teatro|obra)\b/.test(n) ? 'pm'
      : /\b(?:desayuno|desayunar|almuerzo|madrugada|correr|amanecer)\b/.test(n) ? 'am' : null;
    const setRep = rep => { R.repeat = Object.assign(R.repeat || {}, rep); };
    const dateHit = (k, m) => {
      if (m.groups && m.groups.u) { R.until = k; return; }
      if (R.date) return false;
      R.date = k; R.explicitDate = true;
    };

    // Prefijos y etiquetas
    scan(/^\s*(pendiente|tarea|por hacer|todo|recordar|recordatorio|evento|cita)\s*:\s*/g, m => { R.type = /evento|cita/.test(m[1]) ? 'event' : 'task'; });
    scan(/(^|\s)#([a-z0-9_]+)/g, m => { if (CAT_TAGS[m[2]]) R.category = CAT_TAGS[m[2]]; });
    scan(/\btodo el dia\b/g, () => { R.allDayExplicit = true; });

    // Repeticiones
    scan(/\b(?:todos los dias habiles|cada dia habil|entre semana|de lunes a viernes|dias habiles|dias laborales)\b/g, () => setRep({ freq: 'weekly', interval: 1, days: [1, 2, 3, 4, 5] }));
    scan(/\b(?:todos los|cada|los) fines? de semana\b/g, () => setRep({ freq: 'weekly', interval: 1, days: [6, 0] }));
    scan(/\b(?:todos los dias|cada dia|diario|diariamente|a diario)\b/g, () => setRep({ freq: 'daily', interval: 1 }));
    scan(new RegExp(`\\bcada (${NUM_RE}) (dias?|semanas?|mes(?:es)?|anos?)\\b`, 'g'), m => {
      const k = num(m[1]);
      if (!k) return false;
      setRep({ freq: { d: 'daily', s: 'weekly', m: 'monthly', a: 'yearly' }[m[2][0]], interval: k });
    });
    scan(/\b(?:cada |todas las )?quincenas?\b|\bquincenal(?:mente)?\b/g, () => setRep({ freq: 'monthly', interval: 1, monthDays: [15, -1] }));
    scan(new RegExp(`\\b(?:el |los )?(primer|primero|segundo|tercer|tercero|cuarto|quinto|ultimo|1er|1o|2o|3er|3o|4o)s? (${WD_RE}) de (?:cada|todos los) mes(?:es)?\\b`, 'g'), m => {
      setRep({ freq: 'monthly', interval: (R.repeat && R.repeat.interval) || 1, nth: NTH[m[1]], wd: wdOf(m[2]) });
    });
    scan(/\b(?:el )?ultimo dia de (?:cada|todos los) mes(?:es)?\b/g, () => setRep({ freq: 'monthly', interval: 1, monthDays: [-1] }));
    scan(/\b(?:(?:el |los )?(?:dia )?(\d{1,2}|primero)(?: y (?:el )?(\d{1,2}|ultimo))? de (?:cada|todos los) mes(?:es)?|(?:cada|todos los) mes(?:es)?(?: (?:el|los) (?:dia )?(\d{1,2}|primero)(?: y (?:el )?(\d{1,2}|ultimo))?)?|mensual(?:mente)?)\b/g, m => {
      const md = [m[1] || m[3], m[2] || m[4]].filter(Boolean)
        .map(x => (x === 'primero' ? 1 : x === 'ultimo' ? -1 : +x)).filter(x => x === -1 || (x >= 1 && x <= 31));
      setRep(Object.assign({ freq: 'monthly', interval: (R.repeat && R.repeat.interval) || 1 }, md.length ? { monthDays: md } : {}));
    });
    scan(/\b(?:cada|todos los) anos?\b|\banual(?:mente)?\b/g, () => setRep({ freq: 'yearly', interval: 1 }));
    scan(/\b(?:cada|todas las) semanas?\b|\bsemanal(?:mente)?\b/g, () => setRep({ freq: 'weekly', interval: 1 }));
    const daysIn = s => [...new Set([...s.matchAll(new RegExp(WD_RE, 'g'))].map(x => wdOf(x[0])))];
    scan(new RegExp(`\\b(?:todos los|cada|los)\\s+(${WD_RE}(?:\\s*(?:,|y|e)\\s*(?:los\\s+)?${WD_RE})*)\\b`, 'g'), m => {
      setRep({ freq: 'weekly', interval: (R.repeat && R.repeat.freq === 'weekly' && R.repeat.interval) || 1, days: daysIn(m[1]) });
    });
    scan(new RegExp(`\\b(${WD_RE}(?:\\s*,\\s*${WD_RE})*\\s*,?\\s*(?:y|e)\\s+${WD_RE})\\b`, 'g'), m => {
      setRep({ freq: 'weekly', interval: (R.repeat && R.repeat.freq === 'weekly' && R.repeat.interval) || 1, days: daysIn(m[1]) });
    });

    // Rangos de varios días: "del 20 al 27 de diciembre", "del lunes al viernes"
    scan(new RegExp(`\\bdel? (\\d{1,2})(?: de (${MON_RE}))? al? (\\d{1,2}) de (${MON_RE})(?:,? (?:de |del )?(\\d{4}))?\\b`, 'g'), m => {
      const y = m[5] ? +m[5] : null, m2 = monthNum(m[4]), m1 = m[2] ? monthNum(m[2]) : m2;
      const a = mkDate(+m[1], m1, y, T0);
      if (!a) return false;
      let b = validDate(C.parts(a)[0], m2, +m[3]) ? C.key(C.parts(a)[0], m2, +m[3]) : null;
      if (b && b < a && validDate(C.parts(a)[0] + 1, m2, +m[3])) b = C.key(C.parts(a)[0] + 1, m2, +m[3]);
      if (!b || b < a) return false;
      R.date = a; R.rangeEnd = b; R.explicitDate = true;
    });
    scan(new RegExp(`\\bdel (${WD_RE}) al (${WD_RE})\\b`, 'g'), m => {
      const a = C.addDays(T0, (wdOf(m[1]) - todayWd + 7) % 7);
      let b = a;
      while (C.weekday(b) !== wdOf(m[2])) b = C.addDays(b, 1);
      R.date = a; R.rangeEnd = b; R.explicitDate = true;
    });

    // Duración
    scan(/\b(?:por|durante) (?:una )?hora y media\b/g, () => { R.dur = 90; });
    scan(/\b(?:por|durante|dura)\s+(una|un|media|\d+(?:[.,]\d+)?)\s*(horas?|hrs?|h|minutos?|mins?)\b(?:\s+y\s+media)?/g, m => {
      const q = m[1] === 'una' || m[1] === 'un' ? 1 : m[1] === 'media' ? 0.5 : parseFloat(m[1].replace(',', '.'));
      if (!q) return false;
      R.dur = Math.round(/^h/.test(m[2]) ? q * 60 : q) + (/y\s+media$/.test(m[0]) ? 30 : 0);
    });
    scan(/\(\s*(\d+(?:[.,]\d+)?)\s*(h|hrs?|horas?|min|mins|minutos)\s*\)/g, m => {
      const q = parseFloat(m[1].replace(',', '.'));
      R.dur = Math.round(/^h/.test(m[2]) ? q * 60 : q);
    });
    scan(/\b(\d{1,2})\s*h\s*(\d{1,2})\s*m(?:in)?\b/g, m => { R.dur = +m[1] * 60 + +m[2]; });

    // Horas: rangos y luego horas sueltas
    scan(new RegExp(`\\b(?:de|desde)\\s+(?:las?\\s+)?${T}\\s*(?:a|-|–|hasta)\\s*(?:las?\\s+)?${T}`, 'g'), m => {
      const t1 = tok(m, 1), t2 = tok(m, 7);
      if (!t1 || !t2) return false;
      [R.start, R.end] = resolveRange(t1, t2, pref);
    });
    scan(new RegExp(`\\b(?:a\\s+las?\\s+)?${T}\\s*(-|–|a)\\s*(?:las?\\s+)?${T}`, 'g'), m => {
      const t1 = tok(m, 1), t2 = tok(m, 8);
      if (!t1 || !t2 || R.start != null) return false;
      if (m[7] === 'a' ? !(t1.hasMin || t1.period) : !(t1.hasMin || t1.period || t2.hasMin || t2.period)) return false;
      [R.start, R.end] = resolveRange(t1, t2, pref);
    });
    scan(new RegExp(`\\b(?:a\\s+las?|alas|desde\\s+las?|tipo|como\\s+a\\s+las?)\\s+${T}`, 'g'), m => {
      const t = tok(m, 1);
      if (!t || R.start != null) return false;
      R.start = resolveHour(t, pref);
    });
    scan(new RegExp(`\\b${T}`, 'g'), m => {
      const t = tok(m, 1);
      if (!t || R.start != null || !(t.hasMin || t.period)) return false;
      R.start = resolveHour(t, pref);
    });
    scan(/\b(?:al |a )?mediodia\b/g, () => { if (R.start != null) return false; R.start = 720; });
    scan(/\ba (?:la )?medianoche\b/g, () => { if (R.start != null) return false; R.start = 0; });

    // Partes del día ("en la mañana"), antes de leer "mañana" como fecha
    scan(/\b(?:hoy|esta) (?:en |por |a )?la (manana|tarde|noche)\b|\besta (manana|tarde|noche)\b/g, m => {
      R.part = m[1] || m[2];
      if (!R.date) { R.date = T0; R.explicitDate = true; }
    });
    scan(/\b(?:en|por|de) la (manana|tarde|noche)\b/g, m => { R.part = m[1]; });

    // Fechas completas
    scan(new RegExp(`\\b${U}(?:el\\s+)?(?:dia\\s+)?(\\d{1,2}|primero|1ro|1o)\\s+(?:de\\s+)?(${MON_RE})(?:,?\\s+(?:de|del)?\\s*(\\d{4}))?\\b`, 'g'), m => {
      const d = /^(?:primero|1ro|1o)$/.test(m[2]) ? 1 : +m[2];
      const k = mkDate(d, monthNum(m[3]), m[4] ? +m[4] : null, T0);
      return k ? dateHit(k, m) : false;
    });
    scan(new RegExp(`\\b${U}(${MON_RE})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\b(?!\\s*[:.]\\d)`, 'g'), m => {
      const k = mkDate(+m[3], monthNum(m[2]), m[4] ? +m[4] : null, T0);
      return k ? dateHit(k, m) : false;
    });
    scan(new RegExp(`\\b${U}(\\d{4})-(\\d{2})-(\\d{2})\\b`, 'g'), m => {
      const k = mkDate(+m[4], +m[3], +m[2], T0);
      return k ? dateHit(k, m) : false;
    });
    scan(new RegExp(`\\b${U}(?:el\\s+)?(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?\\b`, 'g'), m => {
      if (m[0].includes('-') && !m[4]) return false;
      let y = m[4] ? +m[4] : null;
      if (y && y < 100) y += 2000;
      const k = mkDate(+m[2], +m[3], y, T0);
      return k ? dateHit(k, m) : false;
    });
    scan(new RegExp(`\\b${U}(?:el\\s+)?(?:dia\\s+)?(\\d{1,2}|primero)\\s+(?:de|del)\\s+(este|el proximo|el siguiente|proximo|siguiente) mes\\b`, 'g'), m => {
      const d = m[2] === 'primero' ? 1 : +m[2];
      const base = /prox|sig/.test(m[3]) ? C.addMonths(C.monthStart(T0), 1) : C.monthStart(T0);
      const [y, mo] = C.parts(base);
      return validDate(y, mo, d) ? dateHit(C.key(y, mo, d), m) : false;
    });

    // Fechas relativas
    scan(new RegExp(`\\b${U}(pasado manana|manana|hoy|ayer|antier|anteayer)\\b`, 'g'), m => {
      const off = { 'pasado manana': 2, manana: 1, hoy: 0, ayer: -1, antier: -2, anteayer: -2 }[m[2]];
      return dateHit(C.addDays(T0, off), m);
    });
    scan(new RegExp(`\\b${U}(?:en|dentro de) (${NUM_RE}) (dias?|semanas?|mes(?:es)?|anos?)\\b`, 'g'), m => {
      const k = num(m[2]);
      if (k == null) return false;
      const u = m[3][0];
      return dateHit(u === 'd' ? C.addDays(T0, k) : u === 's' ? C.addDays(T0, 7 * k) : C.addMonths(T0, u === 'm' ? k : 12 * k), m);
    });
    const nextWeekText = /\b(?:proxima|siguiente|otra) semana\b|\bsemana que (?:viene|entra)\b/.test(n);
    scan(new RegExp(`\\b${U}(?:(el|este|esta|para el|el proximo|el siguiente|proximo|siguiente|el otro)\\s+)?(${WD_RE})(?:\\s+(que viene|que entra|de la (?:proxima|siguiente|otra) semana|de esta semana|de la semana que (?:viene|entra)))?\\b`, 'g'), m => {
      const pre = m[2] || '', w = wdOf(m[3]), suf = m[4] || '';
      let d;
      if (/proxima|siguiente|otra|viene|entra/.test(suf) || (nextWeekText && !/esta semana/.test(suf))) d = C.addDays(C.startOfWeek(T0, 1), 7 + (w + 6) % 7);
      else if (/esta semana/.test(suf)) d = C.addDays(C.startOfWeek(T0, 1), (w + 6) % 7);
      else {
        let delta = (w - todayWd + 7) % 7;
        if (delta === 0 && /proximo|siguiente|otro/.test(pre)) delta = 7;
        d = C.addDays(T0, delta);
      }
      if (m.groups && m.groups.u) { R.until = d; return; }
      if (!R.date) { R.date = d; R.explicitDate = true; }
      // Con fecha completa ya entendida ("sábado 14 de noviembre"), el día de la semana solo acompaña.
    });
    scan(/\b(?:la )?(?:proxima|siguiente|otra) semana\b|\bla semana que (?:viene|entra)\b/g, () => { R.weekHint = 'next'; });
    scan(/\b(?:este |el |para el )?fin de semana\b/g, () => {
      if (R.date) return false;
      R.date = C.addDays(T0, todayWd === 0 ? 0 : 6 - todayWd); R.explicitDate = true;
    });
    scan(/\b(?:a |para |el )?fin de mes\b/g, () => {
      if (R.date) return false;
      R.date = C.monthEnd(T0); R.explicitDate = true;
    });
    scan(new RegExp(`\\b(?:(?<u>hasta (?:el )?)|(?:para el|el dia|el|dia)\\s+)(\\d{1,2}|primero)\\b(?!\\s*(?:[:./]\\d|de\\s+${MON_RE}))`, 'g'), m => {
      const d = m[2] === 'primero' ? 1 : +m[2];
      if (d < 1 || d > 31) return false;
      let [y, mo] = C.parts(T0);
      let k = validDate(y, mo, d) ? C.key(y, mo, d) : null;
      if (!k || k < T0) {
        for (let i = 0; i < 12; i++) { if (++mo > 12) { mo = 1; y++; } if (validDate(y, mo, d)) break; }
        k = C.key(y, mo, d);
      }
      return dateHit(k, m);
    });

    // Lugar: "@ Lugar", "en Lugar Con Mayúsculas", "en la oficina"
    const at = n.indexOf('@');
    if (at >= 0 && !used[at]) {
      let j = at + 1;
      while (j < text.length && !used[j] && text[j] !== '#') j++;
      const loc = text.slice(at + 1, j).trim().replace(/[,;.]+$/, '');
      if (loc) { R.location = loc; used.fill(1, at, j); }
    }
    if (!R.location) {
      const LOC = /(^|\s)(en\s+([A-ZÁÉÍÓÚÑ0-9][\w'’.&\-ÁÉÍÓÚÑáéíóúñü]*(?:\s+(?:de|del|la|las|los|el|y|[A-ZÁÉÍÓÚÑ0-9][\w'’.&\-ÁÉÍÓÚÑáéíóúñü]*))*))/g;
      const tail = /(?:\s+(?:de|del|la|las|los|el|y)|[.,;]+)$/;
      let m;
      while ((m = LOC.exec(text))) {
        let span = m[2], place = m[3];
        while (tail.test(place)) { const cut = place.length - place.replace(tail, '').length; place = place.slice(0, -cut); span = span.slice(0, -cut); }
        const first = norm(place.split(/\s+/)[0] || '');
        if (!place || MONTHS[first.replace('.', '')] || WD[first] != null || /^(?:hoy|manana)$/.test(first) || /^\d/.test(first)) continue;
        const a = m.index + m[1].length, b = a + span.length;
        if (!free(a, b)) continue;
        R.location = place;
        used.fill(1, a, b);
        break;
      }
    }
    if (!R.location) {
      scan(/(^|\s)en (casa(?: de (?:mi |la |el |los |las )?[a-z]+)?|la oficina|el trabajo|la escuela|la uni(?:versidad)?|el gym|el gimnasio|el parque|el centro|el hospital|la clinica|el super(?:mercado)?|el banco|linea|zoom|google meet|meet|teams)\b/g, (m, a, b) => {
        const raw = text.slice(a + m[1].length + 3, b);
        R.location = PLACES[m[2]] || C.cap(raw.replace(/^(?:la|el) /i, ''));
      });
    }

    // Título: lo que no se entendió como fecha, hora, lugar o repetición
    let title = '';
    for (let i = 0; i < text.length; i++) title += used[i] ? ' ' : text[i];
    title = title.replace(/\s+/g, ' ').trim();
    const LEAD = /^(?:el|la|los|las|a|al|de|del|para|en|y|e|que|,|-|–|:|;|\.|@)\s+/i;
    const TRAIL = /\s+(?:el|la|los|las|a|al|de|del|para|en|y|e|que|con|desde|hasta|para el)$/i;
    for (let k = 0; k < 8; k++) {
      const before = title;
      title = title.replace(LEAD, '').replace(TRAIL, '').replace(/^[\s,.;:–@-]+|[\s,;:–@-]+$/g, '').trim();
      if (title === before) break;
    }
    title = title.replace(/\s+([,.;:])/g, '$1').replace(/([,;])(?=[,;])/g, '');
    title = C.cap(title);
    const tn = norm(title);

    // Tipo: con hora es evento; sin hora, un verbo de acción lo vuelve pendiente
    let type = R.type;
    if (!type) {
      if (R.start != null || R.part) type = 'event';
      else if (R.allDayExplicit || R.rangeEnd || ALLDAY_KW.test(tn)) type = 'event';
      else if (TASK_START.test(tn)) type = 'task';
      else if (R.explicitDate || R.repeat) type = 'event';
      else type = 'task';
    }

    // Horas finales
    let start = R.start, end = R.end;
    if (start == null && R.part && type === 'event') start = C.toMin(PART[R.part]);
    if (type === 'task') { start = null; end = null; }
    if (start != null && end == null) end = start + (R.dur || 60);
    const allDay = type === 'event' && start == null;

    // Fecha y repetición
    let date = R.date, days = 1, repeat = R.repeat;
    if (R.weekHint && !date) date = C.addDays(C.startOfWeek(T0, 1), 7);
    const rangeEnd = R.rangeEnd || (!repeat && R.until && R.until > (date || T0) ? R.until : null);
    if (rangeEnd) {
      if (!date) date = T0;
      if (start != null && !repeat) repeat = { freq: 'daily', interval: 1, until: rangeEnd };
      else if (type === 'event' && start == null) days = C.diffDays(date, rangeEnd) + 1;
    }
    if (repeat && R.until) repeat.until = R.until;
    if (repeat) {
      repeat = C.sanitizeRepeat(repeat);
      const first = C.occurrenceStarts({ date: date || T0, repeat }, date || T0, C.addDays(date || T0, 800))[0];
      if (first) date = first;
    }
    if (!date) {
      date = T0;
      if (start != null && o.nowMin != null && start < o.nowMin) date = C.addDays(T0, 1);
    }

    const category = R.category || inferCategory(title + ' ' + R.location) || 'personal';
    return {
      type, title, date, allDay, days,
      start: start == null ? null : C.fromMin(start),
      end: end == null ? null : C.fromMin(end),
      repeat: repeat || null,
      category, location: R.location,
      understood: { date: R.explicitDate, time: R.start != null || !!R.part, repeat: !!repeat, location: !!R.location },
    };
  }

  return { parse, inferCategory, norm };
});
