/* Ritmo — interfaz. Sin dependencias.
   Guarda en tu cuenta (capacidad db de Claude) cuando está disponible y, si no, en este dispositivo. */
(() => {
  'use strict';
  const C = window.RitmoCore, P = window.RitmoParser;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const newId = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const todayKey = () => C.toKey(new Date());
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const wide = () => matchMedia('(min-width: 900px)').matches;
  const hasSide = () => matchMedia('(min-width: 1100px)').matches;
  const clone = o => JSON.parse(JSON.stringify(o));
  const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } })();

  const svg = (p, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const I = {
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    spark: svg('<path d="M12 3.5l1.9 4.7 4.6 1.8-4.6 1.9L12 16.5l-1.9-4.6-4.6-1.9 4.6-1.8z"/><path d="M18.5 15.5l.8 1.9 1.7.7-1.7.7-.8 1.9-.8-1.9-1.7-.7 1.7-.7z"/>'),
    sliders: svg('<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>'),
    left: svg('<path d="m15 18-6-6 6-6"/>'),
    right: svg('<path d="m9 18 6-6-6-6"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 22),
    plusS: svg('<path d="M12 5v14M5 12h14"/>', 18),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 16),
    repeat: svg('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>', 13),
    pin: svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>', 13),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 18),
    copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', 18),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 14),
    cal: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', 14),
    down: svg('<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>'),
    up: svg('<path d="M12 20V8M6 14l6-6 6 6M4 4h16"/>'),
    cloud: svg('<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 7.9z"/>', 15),
    device: svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>', 15),
    keys: svg('<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 15h10"/>'),
  };

  // ---------- Ajustes y estado de la vista ----------
  const H12 = (() => { try { return new Intl.DateTimeFormat('es-MX', { hour: 'numeric' }).resolvedOptions().hourCycle !== 'h23'; } catch (e) { return true; } })();
  const DEFAULTS = { weekStart: 0, h12: H12, holidays: true, hiddenCats: [], examplesOff: false, skin: 'ritmo' };
  // Temas: nombre y cuatro colores de muestra (fondo, hoja, acción, marcatextos)
  const SKINS = [
    ['ritmo', 'Ritmo', ['#F6F7F9', '#FFFFFF', '#1F3FD1', '#FFE15A']],
    ['clasico', 'Clásico iOS', ['#F2F2F7', '#FFFFFF', '#007AFF', '#FF3B30']],
    ['rosa', 'Rosa champaña', ['#FBF5F3', '#F5C6CC', '#B8606B', '#3B2422']],
    ['dorado', 'Negro y dorado', ['#000000', '#1C1C1E', '#D4AF6A', '#F5F5F7']],
    ['cristal', 'Cristal pastel', ['#EFE4FF', '#FFE6F2', '#8B5CF6', '#EC4899']],
  ];
  const applySkin = () => {
    const s = Store.settings.skin;
    if (s && s !== 'ritmo') document.documentElement.dataset.skin = s; else delete document.documentElement.dataset.skin;
  };
  const VIEWS = ['agenda', 'dia', 'semana', 'mes'];
  const S = {
    view: 'agenda', cursor: todayKey(), selected: todayKey(), miniMonth: null,
    agendaFrom: null, agendaDays: 45, examples: null, flash: new Set(), scrollTo: true,
    sample: null, downloads: null, sheetOpen: false, lastToday: todayKey(),
  };
  const ls = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* almacenamiento bloqueado: seguimos en memoria */ } },
  };

  // ---------- Almacén: cuenta (db) o este dispositivo ----------
  const Store = (() => {
    const K = { items: 'ritmo.v1.items', settings: 'ritmo.v1.settings', mode: 'ritmo.v1.mode', cache: 'ritmo.v1.cloudcache' };
    const listeners = new Set();
    let mode = 'local', ready = false, items = new Map(), settings = Object.assign({}, DEFAULTS);
    let base = null, coll = null, unsub = null;
    const pending = new Map(), inflight = new Set(), queue = [];
    let active = 0, saveTimer = null;
    const emit = () => listeners.forEach(f => f());

    function load() {
      settings = Object.assign({}, DEFAULTS, ls.get(K.settings, {}));
      const wasCloud = ls.get(K.mode, 'local') === 'cloud' && window.claude && typeof window.claude.use === 'function';
      const arr = ls.get(wasCloud ? K.cache : K.items, []);
      items = new Map((Array.isArray(arr) ? arr : []).filter(x => x && x.id).map(x => [x.id, x]));
      ready = !wasCloud || items.size > 0;
    }
    function persist() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => ls.set(mode === 'cloud' ? K.cache : K.items, [...items.values()]), 120);
    }
    function refFor(id) { return id === '__settings' ? base : coll.doc(id); }
    function schedule(id) {
      if (!queue.includes(id) && !inflight.has(id)) queue.push(id);
      pump();
    }
    function pump() {
      while (active < 4 && queue.length) {
        const id = queue.shift();
        active++; inflight.add(id);
        flush(id).finally(() => { active--; inflight.delete(id); if (pending.has(id) && mode === 'cloud') schedule(id); pump(); });
      }
    }
    async function flush(id, retried) {
      const d = pending.get(id);
      try {
        if (d === null) await refFor(id).delete(); else await refFor(id).set(id === '__settings' ? { settings: d } : d);
        if (pending.get(id) === d) pending.delete(id);
      } catch (e) {
        if (e && e.code === 'unavailable' && !retried) { await new Promise(r => setTimeout(r, 400 + Math.random() * 800)); return flush(id, true); }
        pending.delete(id);
        fallBackToLocal(e);
      }
    }
    function write(id, data) {
      if (mode !== 'cloud') { persist(); return; }
      pending.set(id, data);
      persist();
      schedule(id);
    }
    function fallBackToLocal(e) {
      if (mode !== 'cloud') return;
      mode = 'local';
      if (unsub) { unsub(); unsub = null; }
      ls.set(K.mode, 'local');
      ls.set(K.items, [...items.values()]);
      emit();
      const quota = e && e.code === 'quota_exceeded';
      toast(quota ? 'Tu cuenta llegó al límite de espacio. Ritmo guardará en este dispositivo.' : 'No se pudo guardar en tu cuenta. Ritmo guardará en este dispositivo.');
    }
    async function connect() {
      const CL = window.claude;
      if (!CL || typeof CL.use !== 'function') { if (!ready) { ready = true; emit(); } return; }
      let db = null, user = null;
      try { [db, user] = await Promise.all([CL.use('db'), CL.use('user')]); } catch (e) { /* sin capacidades */ }
      const uid = user ? await user.id() : null;
      if (!db || !uid) {
        if (mode !== 'local' || !ready) {
          mode = 'local';
          items = new Map(ls.get(K.items, []).map(x => [x.id, x]));
          ready = true; emit();
        }
        return;
      }
      base = db.doc('data/users/' + uid + '/ritmo');
      coll = base.collection('items');
      base.get().then(s => {
        const remote = s.exists && s.data() && s.data().settings;
        if (remote) { settings = Object.assign({}, DEFAULTS, remote); ls.set(K.settings, settings); emit(); }
      }).catch(() => {});
      let first = true;
      unsub = coll.onSnapshot(snap => {
        const next = new Map();
        for (const d of snap.docs) next.set(d.id, d.data());
        for (const [id, p] of pending) { if (id === '__settings') continue; if (p === null) next.delete(id); else next.set(id, p); }
        if (first) {
          first = false;
          const deviceOnly = ls.get(K.mode, 'local') !== 'cloud' ? ls.get(K.items, []) : [];
          mode = 'cloud';
          ls.set(K.mode, 'cloud');
          if (snap.empty && deviceOnly.length) {
            for (const it of deviceOnly) { next.set(it.id, it); pending.set(it.id, it); schedule(it.id); }
            setTimeout(() => toast('Lo que tenías en este dispositivo ya está en tu cuenta.'), 600);
          }
        }
        items = next; ready = true; persist(); emit();
      }, err => { if (err && err.code !== 'revoked') fallBackToLocal(err); });
    }
    return {
      get items() { return items; }, get settings() { return settings; }, get mode() { return mode; }, get ready() { return ready; },
      onChange: f => listeners.add(f),
      init() { load(); emit(); connect(); },
      put(it) { it.updatedAt = new Date().toISOString(); items.set(it.id, it); write(it.id, it); emit(); },
      putMany(list) { const now = new Date().toISOString(); for (const it of list) { it.updatedAt = now; items.set(it.id, it); write(it.id, it); } emit(); },
      remove(id) { items.delete(id); write(id, null); emit(); },
      setSettings(patch) {
        settings = Object.assign({}, settings, patch);
        ls.set(K.settings, settings);
        if (mode === 'cloud') { pending.set('__settings', settings); schedule('__settings'); }
        emit();
      },
    };
  })();

  // ---------- Ejemplos: se muestran mientras la agenda está vacía; nunca se guardan ----------
  function buildExamples(t) {
    const d = n => C.addDays(t, n);
    const wd = C.weekday(t);
    const E = (o, i) => Object.assign({ id: 'ex' + i, example: true, type: 'event', allDay: false, start: null, end: null, days: 1, repeat: null, category: 'personal', location: '', notes: '', exdates: [], doneDates: [], done: false }, o);
    return [
      { title: 'Llamada con cliente: Grupo Norte', date: t, start: '11:30', end: '12:15', category: 'trabajo', location: 'Zoom' },
      { title: 'Comida con Mariana', date: t, start: '14:00', end: '15:30', location: 'El Cardenal' },
      { title: 'Dentista', date: t, start: '17:00', end: '18:00', category: 'salud', location: 'Consultorio Dra. Ruiz' },
      { type: 'task', title: 'Enviar cotización a Grupo Norte', date: t, category: 'trabajo' },
      { type: 'task', title: 'Comprar regalo para Luis', date: t, done: true },
      { type: 'task', title: 'Llevar el coche al servicio', date: d(-2) },
      { title: 'Gym', date: d(1), start: '07:00', end: '08:00', category: 'salud', repeat: { freq: 'weekly', interval: 1, days: [1, 3, 5] }, location: 'Smart Fit' },
      { title: 'Junta semanal', date: d(1), start: '09:30', end: '10:30', category: 'trabajo', repeat: { freq: 'weekly', interval: 1, days: [(wd + 1) % 7] }, location: 'Sala 3' },
      { title: 'Clase de inglés', date: d(2), start: '19:00', end: '20:30', category: 'estudio', repeat: { freq: 'weekly', interval: 1, days: [2, 4] } },
      { title: 'Cena de cumpleaños de Luis', date: d(3), start: '20:30', end: '23:00', location: 'La Docena' },
      { title: 'Fútbol de Diego', date: d(5), start: '10:00', end: '11:30', category: 'familia', location: 'Deportivo Las Águilas' },
      { type: 'task', title: 'Pagar tarjeta', date: t, repeat: { freq: 'monthly', interval: 1, monthDays: [15, -1] } },
      { title: 'Viaje a Guadalajara', date: d(9), allDay: true, days: 3 },
      { title: 'Examen de certificación', date: d(13), allDay: true, category: 'estudio' },
    ].map(E);
  }
  function syncExamples() {
    const show = Store.ready && Store.items.size === 0 && !Store.settings.examplesOff;
    if (show && !S.examples) S.examples = buildExamples(todayKey());
    if (!show) S.examples = null;
  }
  const allItems = () => (S.examples ? S.examples : [...Store.items.values()]);
  const getItem = id => Store.items.get(id) || (S.examples || []).find(x => x.id === id) || null;
  const visible = it => !(Store.settings.hiddenCats || []).includes(it.category);
  const endMin = it => { const s = C.toMin(it.start); let e = it.end ? C.toMin(it.end) : s + 60; if (e <= s) e += 1440; return e; };
  const isTimed = it => it.type === 'event' && !it.allDay && !!it.start;

  function gather(a, b) {
    const out = [];
    for (const it of allItems()) if (visible(it)) for (const o of C.occurrences(it, a, b)) out.push(o);
    if (Store.settings.holidays) for (const h of C.holidaysBetween(a, b)) out.push({ holiday: h, date: h.date });
    return out;
  }
  function rank(o) {
    if (o.holiday) return 0;
    const it = o.item;
    if (it.type === 'task') return C.isDone(it, o.occ) ? 4 : 3;
    return isTimed(it) ? 2 : 1;
  }
  function sortOcc(a, b) {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 2) return C.toMin(a.item.start) - C.toMin(b.item.start) || endMin(a.item) - endMin(b.item);
    return 0;
  }
  function byDay(list) {
    const m = new Map();
    for (const o of list) { if (!m.has(o.date)) m.set(o.date, []); m.get(o.date).push(o); }
    for (const arr of m.values()) arr.sort(sortOcc);
    return m;
  }
  const h12 = () => Store.settings.h12;
  const dateLabel = (k, t = todayKey()) => C.relDay(k, t) || C.cap(C.fmtShort(k)) + (k.slice(0, 4) !== t.slice(0, 4) ? ' ' + k.slice(0, 4) : '');
  const whenLabel = it => dateLabel(it.date) + (isTimed(it) ? ', ' + C.fmtTime(it.start, h12()) : '');

  // ---------- Pintar ----------
  const view = $('#view');
  function render() {
    applySkin();
    syncExamples();
    renderTop();
    renderView();
    renderSide();
    if (S.flash.size) setTimeout(() => S.flash.clear(), 1700);
  }
  function renderTop() {
    const t = todayKey(), c = S.cursor, [cy, cm] = C.parts(c);
    const yr = k => (k.slice(0, 4) !== t.slice(0, 4) ? ' ' + k.slice(0, 4) : '');
    let title = 'Agenda';
    if (S.view === 'dia') {
      const rel = C.relDay(c, t);
      title = (rel ? rel + ', ' : C.cap(C.DOW_S[C.weekday(c)]) + ' ') + C.fmtDayMonth(c) + yr(c);
    } else if (S.view === 'semana') {
      const a = C.startOfWeek(c, Store.settings.weekStart), b = C.addDays(a, 6);
      title = a.slice(0, 7) === b.slice(0, 7) ? `${+a.slice(8)} – ${C.fmtDayMonth(b)}${yr(b)}` : `${C.fmtDayMonth(a)} – ${C.fmtDayMonth(b)}${yr(b)}`;
    } else if (S.view === 'mes') {
      title = `${C.cap(C.MES[cm - 1])} <small>${cy}</small>`;
    }
    $('#period').innerHTML = title;
    for (const b of $$('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.view === S.view));
    view.setAttribute('aria-labelledby', 'tab-' + S.view);
    $('#navs').hidden = S.view === 'agenda';
    const strip = $('#strip');
    strip.hidden = S.view !== 'dia';
    if (!strip.hidden) {
      const ws = C.startOfWeek(c, Store.settings.weekStart);
      const days = Array.from({ length: 7 }, (_, i) => C.addDays(ws, i));
      const by = byDay(gather(days[0], days[6]));
      strip.innerHTML = days.map(d => {
        const cats = [...new Set((by.get(d) || []).filter(o => o.item).map(o => o.item.category))].slice(0, 3);
        return `<button type="button" class="sd ${d === t ? 'today' : ''}" data-pick="${d}" ${d === c ? 'aria-current="date"' : ''} aria-label="${esc(C.fmtLong(d))}">
          ${C.DOW_S[C.weekday(d)].slice(0, 2)}<b>${+d.slice(8)}</b><span class="dots">${cats.map(k => `<i style="--c: var(--c-${k})"></i>`).join('')}</span></button>`;
      }).join('');
    }
  }
  function renderView() {
    if (!Store.ready) { view.innerHTML = '<p class="loading thinking">Cargando tu agenda</p>'; return; }
    const fn = { agenda: renderAgenda, dia: renderDay, semana: renderWeek, mes: renderMonth }[S.view];
    view.innerHTML = fn();
    for (const el of $$('[data-flash]', view)) el.classList.add('flash');
    if (S.scrollTo) { S.scrollTo = false; requestAnimationFrame(scrollInitial); }
  }
  function scrollInitial() {
    const target = $('.flash', view);
    if (target) { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (S.view === 'dia' || (S.view === 'semana' && wide())) {
      const grid = $('.grid', view);
      if (!grid) return;
      const hour = grid.getBoundingClientRect().height / 24;
      const t = todayKey();
      const showsToday = S.view === 'dia' ? S.cursor === t : !!$('.grid.today', view);
      const h = showsToday ? Math.max(0, Math.min(nowMin() / 60 - 1.5, 15)) : 7;
      const top = grid.getBoundingClientRect().top + scrollY - (topH() + 8) + hour * h;
      scrollTo({ top: Math.max(0, top) });
    } else scrollTo({ top: 0 });
  }
  const topH = () => $('#top').getBoundingClientRect().height + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('padding-top')) || 0);

  // Fila de la lista (agenda, día, mes)
  function metaHTML(it, o, t) {
    const parts = [];
    if (o.overdue) parts.push(`<span class="late">Era para ${esc(dateLabel(it.date, t).toLowerCase())}</span>`);
    if (it.type === 'event' && isTimed(it)) parts.push(`<span>${C.fmtDuration(endMin(it) - C.toMin(it.start))}</span>`);
    if (o.span > 1) parts.push(`<span>Día ${o.idx + 1} de ${o.span}</span>`);
    if (it.location) parts.push(`<span>${I.pin}${esc(it.location)}</span>`);
    if (it.repeat) parts.push(`<span>${I.repeat}${esc(C.describeRepeat(it.repeat, it.date))}</span>`);
    parts.push(`<span class="cn">${it.type === 'task' ? 'Pendiente · ' : ''}${C.catName(it.category)}</span>`);
    return parts.join('');
  }
  function rowHTML(o, t = todayKey()) {
    if (o.holiday) {
      const h = o.holiday;
      return `<div class="row hd"><span class="when"><span class="flag ${h.official ? 'off' : ''}">${h.official ? 'Festivo' : 'Fecha'}</span></span><span class="bar"></span>
        <span class="what"><span class="t">${esc(h.title)}</span><span class="m">${h.official ? 'Día de descanso obligatorio' : 'Celebración'}</span></span></div>`;
    }
    const it = o.item, st = `style="--c: var(--c-${esc(it.category)})"`;
    const data = `data-open="${esc(it.id)}" data-occ="${o.occ}"`;
    const fl = S.flash.has(it.id) ? ' data-flash' : '';
    if (it.type === 'task') {
      const done = C.isDone(it, o.occ);
      return `<div class="row tk ${done ? 'done' : ''}" ${st}${fl}>
        <span class="when"><button type="button" class="chk" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Marcar como pendiente' : 'Marcar como hecho'}: ${esc(it.title)}" data-toggle="${esc(it.id)}" data-occ="${o.occ}">${I.check}</button></span>
        <span class="bar"></span>
        <button type="button" class="what" ${data}><span class="t">${esc(it.title)}</span><span class="m">${metaHTML(it, o, t)}</span></button></div>`;
    }
    let when, cls = '';
    if (isTimed(it)) {
      when = `<span class="when"><b>${C.fmtTime(it.start, h12())}</b><small>${C.fmtTime(it.end || C.fromMin(C.toMin(it.start) + 60), h12())}</small></span>`;
      if (o.date === t) {
        const nm = nowMin(), s = C.toMin(it.start), e = endMin(it);
        if (e <= nm) cls = 'past'; else if (s <= nm) cls = 'live';
      } else if (o.date < t) cls = 'past';
    } else when = `<span class="when"><b>Todo</b><small>el día</small></span>`;
    return `<button type="button" class="row ev ${cls}" ${st} ${data}${fl}>${when}<span class="bar"></span>
      <span class="what"><span class="t">${esc(it.title)}</span><span class="m">${metaHTML(it, o, t)}</span></span></button>`;
  }
  function dayGroup(d, list, t) {
    const rel = C.relDay(d, t), n = C.diffDays(t, d);
    const label = rel || (n > 0 && n < 7 ? C.cap(C.DOW[C.weekday(d)]) : C.cap(C.fmtShort(d)));
    const abs = rel || (n > 0 && n < 7) ? C.fmtShort(d) : '';
    const empty = d === t ? 'Nada en la agenda. Escribe abajo para agregar algo.' : 'Libre';
    return `<section class="day" aria-label="${esc(C.fmtLong(d))}">
      <div class="day-h ${d === t ? 'is-today' : ''}"><span class="rel">${esc(label)}</span><span class="abs">${esc(abs)}</span>
        <button type="button" class="icon-btn sm" data-new="${d}" aria-label="Agregar el ${esc(C.fmtLong(d))}">${I.plusS}</button></div>
      <div class="rows">${list.length ? list.map(o => rowHTML(o, t)).join('') : `<div class="empty-day">${empty}</div>`}</div></section>`;
  }

  // Agenda
  function todayCard(t, list) {
    const [y, m, d] = C.parts(t);
    const evs = list.filter(o => o.item && o.item.type === 'event');
    const pend = list.filter(o => o.item && o.item.type === 'task' && !C.isDone(o.item, o.occ)).length;
    const nm = nowMin();
    let next = null, live = false;
    for (const o of evs) {
      if (!isTimed(o.item)) continue;
      const s = C.toMin(o.item.start), e = endMin(o.item);
      if (s <= nm && nm < e) { next = o; live = true; break; }
      if (s > nm && (!next || s < C.toMin(next.item.start))) next = o;
    }
    if (!next) {
      const ahead = gather(C.addDays(t, 1), C.addDays(t, 7)).filter(o => o.item && isTimed(o.item)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : C.toMin(a.item.start) - C.toMin(b.item.start)));
      next = ahead[0] || null;
    }
    let nextHTML = '';
    if (next) {
      const it = next.item, s = C.toMin(it.start);
      let k, eta;
      if (live) { k = 'Ahora'; eta = `termina ${C.fmtTime(C.fromMin(endMin(it)), h12())}`; }
      else if (next.date === t) { k = 'Lo siguiente'; eta = s - nm <= 180 ? 'en ' + C.fmtDuration(s - nm) : C.fmtTime(it.start, h12()); }
      else { k = 'Lo siguiente'; eta = `${dateLabel(next.date, t)}, ${C.fmtTime(it.start, h12())}`; }
      nextHTML = `<button type="button" class="next-up ${live ? 'live' : ''}" style="--c: var(--c-${esc(it.category)})" data-open="${esc(it.id)}" data-occ="${next.occ}">
        <span class="bar"></span><span><span class="k">${k}</span><span class="t" style="display:block">${esc(it.title)}</span>${it.location ? `<span class="m">${esc(it.location)}</span>` : ''}</span><span class="eta">${esc(eta)}</span></button>`;
    }
    return `<section class="today-card" aria-label="Resumen de hoy">
      <div class="big-num" aria-hidden="true">${d}</div>
      <div><div class="dow">${C.DOW[C.weekday(t)]}</div><div class="ym">${C.MES[m - 1]} ${y}</div>
        <div class="sum"><span class="tag"><b>${evs.length}</b>${evs.length === 1 ? 'evento' : 'eventos'}</span><span class="tag"><b>${pend}</b>${pend === 1 ? 'pendiente' : 'pendientes'}</span></div></div>
      ${nextHTML}</section>`;
  }
  function overdueHTML(t) {
    const list = allItems().filter(it => it.type === 'task' && !it.repeat && !it.done && it.date < t && visible(it)).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (!list.length) return '';
    return `<section class="overdue" aria-label="Pendientes vencidos"><div class="ov-h"><span>Vencidos</span><span class="count">${list.length}</span>
      <button type="button" class="btn sm ghost" data-act="overdue-today">Pasar a hoy</button></div>
      ${list.map(it => rowHTML({ item: it, date: it.date, occ: it.date, overdue: true }, t)).join('')}</section>`;
  }
  function renderAgenda() {
    const t = todayKey();
    const from = S.agendaFrom && S.agendaFrom < t ? S.agendaFrom : t;
    const to = C.addDays(t, S.agendaDays);
    const by = byDay(gather(from, to));
    let h = todayCard(t, by.get(t) || []);
    if (S.examples) h += `<div class="note"><p>Así se ve Ritmo con una semana normal. Son ejemplos: escribe tu primer evento abajo y desaparecen.</p><button type="button" class="btn sm" data-act="examples-off">Quitar ejemplos</button></div>`;
    h += overdueHTML(t);
    h += `<div class="more" style="padding:14px 0 0"><button type="button" class="link" data-act="past">Ver días anteriores</button></div>`;
    let lastMonth = t.slice(0, 7);
    for (let d = from; d <= to; d = C.addDays(d, 1)) {
      const list = by.get(d);
      if (!list && d !== t && d !== C.addDays(t, 1)) continue;
      if (d.slice(0, 7) !== lastMonth) {
        lastMonth = d.slice(0, 7);
        h += `<div class="month-label">${C.MES[+d.slice(5, 7) - 1]}${d.slice(0, 4) !== t.slice(0, 4) ? ' ' + d.slice(0, 4) : ''}</div>`;
      }
      h += dayGroup(d, list || [], t);
    }
    h += `<div class="more"><button type="button" class="btn" data-act="more">Ver ${S.agendaDays >= 365 ? 'más' : 'los siguientes 60 días'}</button></div>`;
    return h;
  }

  // Línea de tiempo para día y semana
  function blocksFor(d, list, t) {
    const evs = list.filter(o => o.item && isTimed(o.item)).map(o => {
      const s = C.toMin(o.item.start), real = Math.min(endMin(o.item), 1440);
      return { o, s, e: Math.max(real, s + 30), real };
    });
    C.layoutColumns(evs);
    const nm = nowMin();
    return evs.map(({ o, s, e, real, col, cols }) => {
      const it = o.item, short = real - s <= 45;
      const past = d < t || (d === t && endMin(it) <= nm);
      const style = `--c: var(--c-${esc(it.category)}); top: calc(var(--hour) * ${(s / 60).toFixed(3)}); height: calc(var(--hour) * ${((e - s) / 60).toFixed(3)} - 2px); left: calc(${(100 * col / cols).toFixed(3)}% + 2px); width: calc(${(100 / cols).toFixed(3)}% - 4px)`;
      return `<button type="button" class="blk ${short ? 'short' : ''} ${past ? 'past' : ''}" style="${style}" data-open="${esc(it.id)}" data-occ="${o.occ}"${S.flash.has(it.id) ? ' data-flash' : ''}>
        <b>${esc(it.title)}</b><span>${C.fmtRange(it.start, it.end, h12())}${!short && it.location ? ' · ' + esc(it.location) : ''}</span></button>`;
    }).join('');
  }
  function hoursHTML() {
    let h = '<div class="hours" aria-hidden="true">';
    for (let i = 1; i < 24; i++) h += `<span style="top: calc(var(--hour) * ${i})">${C.fmtHour(i, h12())}</span>`;
    return h + '</div>';
  }
  const nowLine = () => `<div class="nowline" style="top: calc(var(--hour) * ${(nowMin() / 60).toFixed(3)})"></div>`;
  function renderDay() {
    const d = S.cursor, t = todayKey();
    const list = (byDay(gather(d, d)).get(d) || []);
    const top = list.filter(o => !o.item || !isTimed(o.item));
    let h = '';
    if (S.examples) h += `<div class="note"><p>Son ejemplos. Escribe tu primer evento abajo y desaparecen.</p><button type="button" class="btn sm" data-act="examples-off">Quitar ejemplos</button></div>`;
    if (top.length) h += `<div class="allday">${top.map(o => rowHTML(o, t)).join('')}</div>`;
    h += `<div class="tl">${hoursHTML()}<div class="grid ${d === t ? 'today' : ''}" data-grid="${d}" aria-label="Horario del ${esc(C.fmtLong(d))}">${blocksFor(d, list, t)}${d === t ? nowLine() : ''}</div></div>`;
    return h;
  }
  function chipHTML(o) {
    if (o.holiday) return `<span class="chip hd" title="${esc(o.holiday.title)}">${esc(o.holiday.title)}</span>`;
    const it = o.item, done = it.type === 'task' && C.isDone(it, o.occ);
    return `<button type="button" class="chip ${it.type === 'task' ? 'tk' : ''} ${done ? 'done' : ''}" style="--c: var(--c-${esc(it.category)})" data-open="${esc(it.id)}" data-occ="${o.occ}">${isTimed(it) ? C.fmtTime(it.start, h12()).replace(/:00/, '') + ' ' : ''}${esc(it.title)}</button>`;
  }
  function renderWeek() {
    const t = todayKey(), ws = C.startOfWeek(S.cursor, Store.settings.weekStart);
    const days = Array.from({ length: 7 }, (_, i) => C.addDays(ws, i));
    const by = byDay(gather(days[0], days[6]));
    if (!wide()) {
      return `<div class="plan">${days.map(d => {
        const list = by.get(d) || [];
        const items = list.map(o => {
          if (o.holiday) return `<div class="pi hd"><time>Festivo</time><span>${esc(o.holiday.title)}</span></div>`;
          const it = o.item, done = it.type === 'task' && C.isDone(it, o.occ);
          const tm = isTimed(it) ? C.fmtTime(it.start, h12()) : it.type === 'task' ? 'Pend.' : 'Todo el día';
          return `<button type="button" class="pi ${it.type === 'task' ? 'tk' : ''} ${done ? 'done' : ''}" style="--c: var(--c-${esc(it.category)})" data-open="${esc(it.id)}" data-occ="${o.occ}"${S.flash.has(it.id) ? ' data-flash' : ''}><time>${tm}</time><span>${esc(it.title)}</span></button>`;
        }).join('');
        return `<div class="pday ${d === t ? 'today' : ''}"><button type="button" class="pd-date" data-day="${d}" aria-label="Ver ${esc(C.fmtLong(d))}">${C.DOW_S[C.weekday(d)]}<b>${+d.slice(8)}</b></button>
          <div class="pd-items">${items || `<button type="button" class="pd-empty link" data-new="${d}" style="color:var(--ink-3);font-weight:500">Libre · agregar</button>`}</div></div>`;
      }).join('')}</div>`;
    }
    const tops = days.map(d => (by.get(d) || []).filter(o => !o.item || !isTimed(o.item)));
    const anyTop = tops.some(x => x.length);
    let h = `<div class="wk-head"><div></div>${days.map(d => `<button type="button" class="wk-d ${d === t ? 'today' : ''}" data-day="${d}" aria-label="Ver ${esc(C.fmtLong(d))}">${C.DOW_S[C.weekday(d)]}<b>${+d.slice(8)}</b></button>`).join('')}
      ${anyTop ? `<div class="wk-all"><div class="lab">Todo el día</div>${tops.map(list => `<div>${list.map(chipHTML).join('')}</div>`).join('')}</div>` : ''}</div>`;
    h += `<div class="tl wk7">${hoursHTML()}${days.map(d => `<div class="grid ${d === t ? 'today' : ''}" data-grid="${d}">${blocksFor(d, by.get(d) || [], t)}${d === t ? nowLine() : ''}</div>`).join('')}</div>`;
    return h;
  }
  function renderMonth() {
    const t = todayKey(), ws = Store.settings.weekStart;
    const m0 = C.monthStart(S.cursor), mEnd = C.monthEnd(S.cursor);
    const g0 = C.startOfWeek(m0, ws);
    const weeks = Math.ceil((C.diffDays(g0, mEnd) + 1) / 7);
    const g1 = C.addDays(g0, weeks * 7 - 1);
    const by = byDay(gather(g0, g1));
    if (S.selected < m0 || S.selected > mEnd) S.selected = t >= m0 && t <= mEnd ? t : m0;
    let h = `<div class="mo"><div class="mo-head">${Array.from({ length: 7 }, (_, i) => `<span>${C.DOW_S[(ws + i) % 7]}</span>`).join('')}</div><div class="mo-grid" role="grid">`;
    for (let i = 0; i < weeks * 7; i++) {
      const d = C.addDays(g0, i), list = by.get(d) || [];
      const items = list.filter(o => o.item);
      const cats = [...new Set(items.map(o => o.item.category))].slice(0, 4);
      const hol = list.some(o => o.holiday && o.holiday.official);
      const shown = list.slice(0, 3);
      const label = `${C.fmtLong(d)}${items.length ? `, ${items.length} ${items.length === 1 ? 'elemento' : 'elementos'}` : ''}`;
      h += `<button type="button" class="mc ${d < m0 || d > mEnd ? 'out' : ''} ${d === t ? 'today' : ''} ${hol ? 'hol' : ''}" data-sel="${d}" aria-selected="${d === S.selected}" aria-label="${esc(label)}">
        <span class="mn">${+d.slice(8)}</span><span class="dots">${cats.map(k => `<i style="--c: var(--c-${k})"></i>`).join('')}</span>
        <span class="chips">${shown.map(o => o.holiday ? `<span class="chip hd">${esc(o.holiday.title)}</span>` : `<span class="chip ${o.item.type === 'task' ? 'tk' : ''}" style="--c: var(--c-${esc(o.item.category)})">${isTimed(o.item) ? C.fmtTime(o.item.start, h12()).replace(/:00/, '') + ' ' : ''}${esc(o.item.title)}</span>`).join('')}${list.length > 3 ? `<span class="more-n">+${list.length - 3} más</span>` : ''}</span></button>`;
    }
    h += `</div><div class="mo-sel">${dayGroup(S.selected, by.get(S.selected) || [], t)}</div></div>`;
    return h;
  }

  // Panel lateral (pantallas anchas)
  function renderSide() {
    const side = $('#side');
    if (!hasSide()) { side.innerHTML = ''; return; }
    const t = todayKey(), mm = S.miniMonth || C.monthStart(S.cursor), ws = Store.settings.weekStart;
    const g0 = C.startOfWeek(mm, ws), mEnd = C.monthEnd(mm);
    const weeks = Math.ceil((C.diffDays(g0, mEnd) + 1) / 7);
    const busy = new Set(gather(g0, C.addDays(g0, weeks * 7 - 1)).filter(o => o.item).map(o => o.date));
    let mini = Array.from({ length: 7 }, (_, i) => `<span>${C.DOW_1[(ws + i) % 7]}</span>`).join('');
    for (let i = 0; i < weeks * 7; i++) {
      const d = C.addDays(g0, i);
      mini += `<button type="button" class="${d.slice(0, 7) !== mm.slice(0, 7) ? 'out' : ''} ${d === t ? 'today' : ''} ${busy.has(d) ? 'has' : ''}" data-pick="${d}" ${d === S.cursor && S.view !== 'agenda' ? 'aria-current="date"' : ''} aria-label="${esc(C.fmtLong(d))}">${+d.slice(8)}</button>`;
    }
    const tasks = allItems().filter(it => it.type === 'task' && visible(it)).flatMap(it => {
      if (!it.repeat) return it.done ? [] : [{ item: it, occ: it.date }];
      const o = C.occurrenceStarts(it, t, C.addDays(t, 31)).find(k => !C.isDone(it, k));
      return o ? [{ item: it, occ: o }] : [];
    }).sort((a, b) => (a.occ < b.occ ? -1 : 1)).slice(0, 7);
    const hidden = Store.settings.hiddenCats || [];
    side.innerHTML = `<div class="brand"><b>R<i>itmo</i></b><span>tu agenda</span></div>
      <section aria-label="Calendario del mes"><div class="mini-h"><b>${C.MES[+mm.slice(5, 7) - 1]} ${mm.slice(0, 4)}</b>
        <button type="button" class="icon-btn sm" data-mini="-1" aria-label="Mes anterior">${I.left}</button><button type="button" class="icon-btn sm" data-mini="1" aria-label="Mes siguiente">${I.right}</button></div>
        <div class="mini">${mini}</div></section>
      <section><h3>Pendientes</h3><div class="side-list">${tasks.length ? tasks.map(({ item: it, occ }) => `<div class="side-task" style="--c: var(--c-${esc(it.category)})">
        <button type="button" class="chk" role="checkbox" aria-checked="false" aria-label="Marcar como hecho: ${esc(it.title)}" data-toggle="${esc(it.id)}" data-occ="${occ}">${I.check}</button>
        <button type="button" class="what" data-open="${esc(it.id)}" data-occ="${occ}"><span class="t">${esc(it.title)}</span><small class="${occ < t ? 'late' : ''}">${esc(dateLabel(occ, t))}</small></button></div>`).join('') : '<p class="muted" style="margin:0">Nada pendiente. Buen trabajo.</p>'}</div></section>
      <section><h3>Categorías</h3>${C.CATEGORIES.map(c => `<button type="button" class="catrow" role="checkbox" aria-checked="${!hidden.includes(c.id)}" data-cat="${c.id}" style="--c: var(--c-${c.id})"><span class="box">${I.check}</span>${c.name}</button>`).join('')}</section>
      <div class="side-foot">${syncHTML()}</div>`;
  }
  function syncHTML() {
    if (!Store.ready) return `<span class="sync">${I.cloud}Conectando…</span>`;
    return Store.mode === 'cloud'
      ? `<span class="sync">${I.cloud}Guardado en tu cuenta. Lo ves en todos tus dispositivos.</span>`
      : `<span class="sync">${I.device}Guardado en este dispositivo.</span>`;
  }

  // ---------- Hojas ----------
  const sheet = $('#sheet'), card = $('#sheetCard');
  let lastFocus = null;
  function openSheet(html, label, onMount) {
    lastFocus = document.activeElement;
    $('#toast').hidden = true;
    card.innerHTML = html;
    card.setAttribute('aria-label', label);
    sheet.hidden = false;
    S.sheetOpen = true;
    document.body.classList.add('locked');
    card.scrollTop = 0;
    if (onMount) onMount(card);
  }
  function closeSheet() {
    if (!S.sheetOpen) return;
    sheet.hidden = true;
    card.innerHTML = '';
    S.sheetOpen = false;
    document.body.classList.remove('locked');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  sheet.addEventListener('mousedown', e => { if (e.target === sheet) closeSheet(); });
  card.addEventListener('click', e => { if (e.target.closest('[data-act="close"]')) closeSheet(); });

  // Editor
  function blank(date) {
    return { type: 'event', title: '', date: date || todayKey(), allDay: false, start: '09:00', end: '10:00', days: 1, repeat: null, category: 'personal', location: '', notes: '', exdates: [], doneDates: [], done: false };
  }
  function repeatKey(r) {
    if (!r) return 'none';
    const one = (r.interval || 1) === 1;
    if (r.freq === 'daily') return one ? 'daily' : 'custom';
    if (r.freq === 'weekly') {
      if (one && (r.days || []).slice().sort().join() === '1,2,3,4,5') return 'weekdays';
      return one ? 'weekly' : r.interval === 2 ? 'biweekly' : 'custom';
    }
    if (r.freq === 'monthly') {
      if (!one) return 'custom';
      if (r.nth) return 'monthly-nth';
      if (r.monthDays && r.monthDays.join() === '15,-1') return 'quincena';
      return !r.monthDays || r.monthDays.length === 1 ? 'monthly' : 'custom';
    }
    if (r.freq === 'yearly') return one ? 'yearly' : 'custom';
    return 'custom';
  }
  const nthOf = date => { const n = Math.ceil(+date.slice(8) / 7); return n === 5 ? -1 : n; };
  function repeatOptions(date, r) {
    const wd = C.weekday(date), [, m, d] = C.parts(date), nth = nthOf(date);
    const cur = repeatKey(r);
    const opts = [
      ['none', 'No se repite'], ['daily', 'Cada día'], ['weekdays', 'Entre semana (lun a vie)'],
      ['weekly', `Cada semana`], ['biweekly', `Cada 2 semanas`],
      ['monthly', `Cada mes el día ${d}`], ['monthly-nth', `Cada mes el ${C.ORD[nth]} ${C.DOW[wd]}`],
      ['quincena', 'Cada quincena (15 y fin de mes)'], ['yearly', `Cada año el ${d} de ${C.MES[m - 1]}`],
    ];
    if (cur === 'custom') opts.push(['custom', C.describeRepeat(r, date)]);
    return opts.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
  }
  function buildRepeat(key, date, days, until, orig) {
    const wd = C.weekday(date);
    let r = null;
    switch (key) {
      case 'daily': r = { freq: 'daily', interval: 1 }; break;
      case 'weekdays': r = { freq: 'weekly', interval: 1, days: [1, 2, 3, 4, 5] }; break;
      case 'weekly': r = { freq: 'weekly', interval: 1, days: days.length ? days : [wd] }; break;
      case 'biweekly': r = { freq: 'weekly', interval: 2, days: days.length ? days : [wd] }; break;
      case 'monthly': r = { freq: 'monthly', interval: 1, monthDays: [+date.slice(8)] }; break;
      case 'monthly-nth': r = { freq: 'monthly', interval: 1, nth: nthOf(date), wd }; break;
      case 'quincena': r = { freq: 'monthly', interval: 1, monthDays: [15, -1] }; break;
      case 'yearly': r = { freq: 'yearly', interval: 1 }; break;
      case 'custom': r = orig ? clone(orig) : null; break;
    }
    if (r) { if (until && until >= date) r.until = until; else delete r.until; }
    return r;
  }

  function openEditor({ id, occ, draft }) {
    const orig = id ? getItem(id) : null;
    const isNew = !orig, isEx = !!(orig && orig.example);
    const it = orig ? clone(orig) : Object.assign(blank(), draft || {});
    const recurring = !!(orig && orig.repeat);
    const occDate = recurring && occ ? occ : it.date;
    const wdays = it.repeat && it.repeat.freq === 'weekly' && it.repeat.days ? it.repeat.days.slice() : [C.weekday(occDate)];
    const t = it.type;
    const html = `<div class="grab"></div>
      <form class="ed" id="ed" novalidate data-type="${t}" data-allday="${it.allDay ? 1 : 0}">
        <div class="ed-top">
          <div class="seg" role="group" aria-label="Tipo"><button type="button" data-type="event" aria-pressed="${t === 'event'}">Evento</button><button type="button" data-type="task" aria-pressed="${t === 'task'}">Pendiente</button></div>
          <button type="button" class="icon-btn" data-act="close" aria-label="Cerrar">${I.close}</button>
        </div>
        ${isEx ? '<p class="note sm">Es un ejemplo. Si lo guardas, se vuelve tuyo y los ejemplos desaparecen.</p>' : ''}
        <div class="f"><label class="sr" for="ed-title">Título</label>
          <input id="ed-title" class="title-in" value="${esc(it.title)}" placeholder="${t === 'task' ? '¿Qué tienes que hacer?' : '¿Qué vas a hacer?'}" autocomplete="off" maxlength="200"></div>
        <p class="err" id="ed-err" hidden>Escribe un título.</p>
        <div class="ed-grid">
          <div class="f"><label for="ed-date">${t === 'task' ? 'Para el día' : 'Fecha'}</label><input id="ed-date" type="date" class="in" value="${occDate}" required></div>
          <div class="f ev-only"><span class="lbl" id="lbl-allday">Todo el día</span><div class="switch-row" style="min-height:46px"><span class="hint">Sin hora</span><button type="button" class="sw" role="switch" id="ed-allday" aria-checked="${!!it.allDay}" aria-labelledby="lbl-allday"></button></div></div>
          <div class="f ev-only time-only"><label for="ed-start">Empieza</label><input id="ed-start" type="time" class="in" step="300" value="${it.start || '09:00'}"></div>
          <div class="f ev-only time-only"><label for="ed-end">Termina</label><input id="ed-end" type="time" class="in" step="300" value="${it.end || (it.start ? C.fromMin(C.toMin(it.start) + 60) : '10:00')}"></div>
          <div class="f ev-only days-only"><label for="ed-days">Cuántos días</label><input id="ed-days" type="number" inputmode="numeric" min="1" max="366" class="in" value="${it.days || 1}"></div>
        </div>
        <div class="f"><label for="ed-repeat">Repetir</label><select id="ed-repeat" class="in">${repeatOptions(occDate, it.repeat)}</select></div>
        <div class="f wk-only"><span class="lbl">Qué días</span><div class="wdays" role="group" aria-label="Días de la semana">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" data-wd="${d}" aria-pressed="${wdays.includes(d)}" aria-label="${C.DOW[d]}">${C.DOW_1[d]}</button>`).join('')}</div></div>
        <div class="f rep-only"><label for="ed-until">Deja de repetirse el</label><input id="ed-until" type="date" class="in" value="${(it.repeat && it.repeat.until) || ''}"><span class="hint">Déjalo vacío para que se repita siempre.</span></div>
        <div class="f"><span class="lbl" id="lbl-cat">Categoría</span><div class="cats" role="radiogroup" aria-labelledby="lbl-cat">${C.CATEGORIES.map(c => `<button type="button" class="cat" role="radio" data-c="${c.id}" aria-checked="${it.category === c.id}" style="--c: var(--c-${c.id})">${c.name}</button>`).join('')}</div></div>
        <div class="f"><label for="ed-loc">Lugar</label><input id="ed-loc" class="in" value="${esc(it.location)}" placeholder="Consultorio, Zoom, casa de mi mamá…" autocomplete="off"></div>
        <div class="f"><label for="ed-notes">Notas</label><textarea id="ed-notes" class="in" rows="3" placeholder="Lo que necesites recordar">${esc(it.notes)}</textarea></div>
        ${recurring && !isEx ? `<div class="f scope"><span class="lbl">Aplicar cambios a</span><div class="seg" role="group" aria-label="Aplicar cambios a"><button type="button" data-scope="all" aria-pressed="true">Toda la serie</button><button type="button" data-scope="one" aria-pressed="false">Solo el ${esc(C.fmtDayMonth(occDate))}</button></div></div>` : ''}
        <div class="confirm" id="ed-confirm" hidden></div>
        <div class="ed-actions">
          ${orig && !isEx ? `<button type="button" class="btn ghost danger" data-act="ask-del">${I.trash}Eliminar</button><button type="button" class="btn ghost" data-act="dup">${I.copy}Duplicar</button>` : ''}
          <span class="spacer"></span>
          <button type="submit" class="btn primary">${isNew || isEx ? 'Agregar' : 'Guardar'}</button>
        </div>
      </form>`;
    openSheet(html, isNew ? 'Nuevo elemento' : 'Editar ' + it.title, root => {
      const f = $('#ed', root);
      let type = t, allDay = !!it.allDay, cat = it.category, scope = 'all';
      const days = new Set(wdays);
      const sync = () => {
        f.dataset.type = type;
        const rk = $('#ed-repeat', f).value;
        $$('.ev-only', f).forEach(el => { el.hidden = type !== 'event'; });
        $$('.time-only', f).forEach(el => { el.hidden = type !== 'event' || allDay; });
        $$('.days-only', f).forEach(el => { el.hidden = type !== 'event' || !allDay; });
        $('.wk-only', f).hidden = !(rk === 'weekly' || rk === 'biweekly');
        $('.rep-only', f).hidden = rk === 'none';
        $('label[for="ed-date"]', f).textContent = type === 'task' ? 'Para el día' : 'Fecha';
      };
      sync();
      $$('[data-type]', f).forEach(b => b.addEventListener('click', () => {
        type = b.dataset.type;
        $$('[data-type]', f).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        sync();
      }));
      $('#ed-allday', f).addEventListener('click', e => { allDay = !allDay; e.currentTarget.setAttribute('aria-checked', String(allDay)); sync(); });
      $('#ed-repeat', f).addEventListener('change', sync);
      $('#ed-date', f).addEventListener('change', e => {
        const v = e.target.value;
        if (!C.isKey(v)) return;
        const sel = $('#ed-repeat', f), cur = sel.value;
        sel.innerHTML = repeatOptions(v, it.repeat);
        sel.value = [...sel.options].some(o => o.value === cur) ? cur : 'none';
        if (days.size === 1 && !it.repeat) { days.clear(); days.add(C.weekday(v)); $$('[data-wd]', f).forEach(b => b.setAttribute('aria-pressed', String(days.has(+b.dataset.wd)))); }
        sync();
      });
      let dur = isTimed(it) ? endMin(it) - C.toMin(it.start) : 60;
      $('#ed-start', f).addEventListener('change', e => {
        if (!C.isTime(e.target.value)) return;
        $('#ed-end', f).value = C.fromMin(C.toMin(e.target.value) + dur);
      });
      $('#ed-end', f).addEventListener('change', e => {
        const s = $('#ed-start', f).value;
        if (C.isTime(s) && C.isTime(e.target.value)) { let d = C.toMin(e.target.value) - C.toMin(s); if (d <= 0) d += 1440; dur = d; }
      });
      $$('[data-wd]', f).forEach(b => b.addEventListener('click', () => {
        const d = +b.dataset.wd;
        if (days.has(d) && days.size > 1) days.delete(d); else days.add(d);
        b.setAttribute('aria-pressed', String(days.has(d)));
      }));
      $$('.cat', f).forEach(b => b.addEventListener('click', () => { cat = b.dataset.c; $$('.cat', f).forEach(x => x.setAttribute('aria-checked', String(x === b))); }));
      $$('[data-scope]', f).forEach(b => b.addEventListener('click', () => {
        scope = b.dataset.scope;
        $$('[data-scope]', f).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        $('#ed-repeat', f).disabled = scope === 'one';
        $('#ed-until', f).disabled = scope === 'one';
      }));
      const read = () => {
        const date = C.isKey($('#ed-date', f).value) ? $('#ed-date', f).value : occDate;
        const start = $('#ed-start', f).value, end = $('#ed-end', f).value;
        const timed = type === 'event' && !allDay && C.isTime(start);
        return {
          type, title: $('#ed-title', f).value.trim(), date,
          allDay: type === 'event' && !timed,
          start: timed ? start : null,
          end: timed ? (C.isTime(end) && end !== start ? end : C.fromMin(C.toMin(start) + 60)) : null,
          days: type === 'event' && !timed ? Math.min(366, Math.max(1, parseInt($('#ed-days', f).value, 10) || 1)) : 1,
          repeatKey: $('#ed-repeat', f).value,
          until: C.isKey($('#ed-until', f).value) ? $('#ed-until', f).value : null,
          category: cat, location: $('#ed-loc', f).value.trim(), notes: $('#ed-notes', f).value.trim(),
        };
      };
      f.addEventListener('submit', e => {
        e.preventDefault();
        const v = read();
        if (!v.title) { $('#ed-err', f).hidden = false; $('#ed-title', f).focus(); return; }
        save(orig, isEx, occDate, v, scope, [...days]);
      });
      f.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'dup') {
          const v = read();
          const copy = Object.assign(clone(orig), { id: newId(), title: v.title || orig.title, createdAt: new Date().toISOString(), exdates: [], doneDates: [], done: false });
          Store.put(copy);
          closeSheet();
          S.flash.add(copy.id);
          render();
          toast('Duplicado: ' + copy.title, { undo: () => Store.remove(copy.id) });
        }
        if (b.dataset.act === 'ask-del') askDelete(f, orig, occDate);
      });
      if (isNew) setTimeout(() => $('#ed-title', f).focus(), 60);
    });
  }
  function askDelete(f, orig, occDate) {
    const box = $('#ed-confirm', f);
    box.hidden = false;
    box.innerHTML = orig.repeat
      ? `<p>¿Qué quieres eliminar?</p><div class="btns"><button type="button" class="btn sm" data-del="one">Solo el ${esc(C.fmtDayMonth(occDate))}</button><button type="button" class="btn sm solid-danger" data-del="all">Toda la serie</button><button type="button" class="btn sm ghost" data-del="no">Cancelar</button></div>`
      : `<p>¿Eliminar «${esc(orig.title)}»?</p><div class="btns"><button type="button" class="btn sm solid-danger" data-del="all">Eliminar</button><button type="button" class="btn sm ghost" data-del="no">Cancelar</button></div>`;
    box.scrollIntoView({ block: 'nearest' });
    box.onclick = e => {
      const b = e.target.closest('[data-del]');
      if (!b) return;
      const how = b.dataset.del;
      if (how === 'no') { box.hidden = true; return; }
      const before = clone(orig);
      if (how === 'one') {
        const upd = clone(orig);
        upd.exdates = [...new Set([...(upd.exdates || []), occDate])];
        Store.put(upd);
        toast(`Eliminado el ${C.fmtDayMonth(occDate)}`, { undo: () => Store.put(before) });
      } else {
        Store.remove(orig.id);
        toast('Eliminado: ' + orig.title, { undo: () => Store.put(before) });
      }
      closeSheet();
    };
  }
  function save(orig, isEx, occDate, v, scope, wdays) {
    const now = new Date().toISOString();
    const pick = o => ({ type: o.type, title: o.title, allDay: o.allDay, start: o.start, end: o.end, days: o.days, category: o.category, location: o.location, notes: o.notes });
    let saved;
    if (!orig || isEx) {
      saved = Object.assign(blank(), pick(v), { id: newId(), date: v.date, repeat: buildRepeat(v.repeatKey, v.date, wdays, v.until, orig && orig.repeat), createdAt: now });
      if (isEx) { saved.done = !!orig.done; dropExamples(); }
      Store.put(saved);
      toast('Agregado: ' + saved.title + ' · ' + whenLabel(saved), { undo: () => Store.remove(saved.id) });
    } else if (orig.repeat && scope === 'one') {
      const before = clone(orig);
      const series = clone(orig);
      series.exdates = [...new Set([...(series.exdates || []), occDate])];
      saved = Object.assign(blank(), pick(v), { id: newId(), date: v.date, repeat: null, done: C.isDone(orig, occDate), createdAt: now });
      Store.putMany([series, saved]);
      toast('Cambiado solo el ' + C.fmtDayMonth(occDate), { undo: () => { Store.remove(saved.id); Store.put(before); } });
    } else {
      const before = clone(orig);
      saved = Object.assign(clone(orig), pick(v));
      if (orig.repeat) {
        const rep = buildRepeat(v.repeatKey, v.date, wdays, v.until, orig.repeat);
        saved.date = rep ? (v.date !== occDate ? C.addDays(orig.date, C.diffDays(occDate, v.date)) : orig.date) : v.date;
        if (rep && rep.freq === 'monthly' && rep.monthDays && rep.monthDays.length === 1 && v.repeatKey === 'monthly') rep.monthDays = [+v.date.slice(8)];
        saved.repeat = rep;
        if (!rep) { saved.exdates = []; saved.doneDates = []; saved.done = C.isDone(orig, occDate); }
      } else {
        saved.date = v.date;
        saved.repeat = buildRepeat(v.repeatKey, v.date, wdays, v.until, null);
      }
      if (saved.type !== 'task') { saved.done = false; saved.doneDates = []; }
      Store.put(saved);
      toast('Guardado', { undo: () => Store.put(before) });
    }
    closeSheet();
    S.flash.add(saved.id);
    focusDate(saved.date);
    render();
  }
  function focusDate(d) {
    if (S.view === 'agenda') {
      const t = todayKey();
      if (d > C.addDays(t, S.agendaDays)) S.agendaDays = Math.min(730, C.diffDays(t, d) + 7);
      if (d < t && (!S.agendaFrom || d < S.agendaFrom)) S.agendaFrom = d;
    } else { S.cursor = d; S.selected = d; }
    S.scrollTo = true;
  }
  function dropExamples() {
    if (!S.examples) return;
    S.examples = null;
  }

  // Marcar pendientes
  function toggleTask(id, occ) {
    const it = getItem(id);
    if (!it) return;
    if (it.example) {
      if (it.repeat) { const s = new Set(it.doneDates || []); s.has(occ) ? s.delete(occ) : s.add(occ); it.doneDates = [...s]; } else it.done = !it.done;
      render();
      return;
    }
    const before = clone(it), upd = clone(it);
    if (upd.repeat) { const s = new Set(upd.doneDates || []); s.has(occ) ? s.delete(occ) : s.add(occ); upd.doneDates = [...s]; }
    else { upd.done = !upd.done; upd.doneAt = upd.done ? new Date().toISOString() : null; }
    Store.put(upd);
    if (C.isDone(upd, occ)) toast('Hecho: ' + upd.title, { undo: () => Store.put(before) });
  }

  // ---------- Captura rápida ----------
  const qin = $('#qinput'), qprev = $('#qprev');
  const Q = { parsed: null, ai: null, ctl: null };
  function previewItemHTML(p) {
    const chips = [`<span class="qc">${I.cal}${esc(dateLabel(p.date))}</span>`];
    if (p.type === 'event') {
      if (p.start) chips.push(`<span class="qc">${I.clock}${esc(C.fmtRange(p.start, p.end, h12()))}</span>`);
      else chips.push(`<span class="qc">Todo el día${p.days > 1 ? ` · ${p.days} días` : ''}</span>`);
    }
    if (p.repeat) chips.push(`<span class="qc">${I.repeat}${esc(C.describeRepeat(p.repeat, p.date))}</span>`);
    if (p.location) chips.push(`<span class="qc">${I.pin}${esc(p.location)}</span>`);
    chips.push(`<span class="qc cat">${C.catName(p.category)}</span>`);
    return `<div class="qp-item" style="--c: var(--c-${esc(p.category)})"><div class="qp-top"><span class="qp-type">${p.type === 'task' ? 'Pendiente' : 'Evento'}</span>
      <span class="qp-title ${p.title ? '' : 'empty'}">${esc(p.title || 'Escribe un título')}</span></div><div class="qp-chips">${chips.join('')}</div></div>`;
  }
  function renderPreview(extra) {
    const list = Q.ai || (Q.parsed ? [Q.parsed] : []);
    if (!list.length) { qprev.hidden = true; return; }
    qprev.hidden = false;
    qprev.innerHTML = list.map(previewItemHTML).join('') + (extra || '') +
      `<div class="qp-foot"><span><kbd>Enter</kbd> para guardar</span>${list.length === 1 ? '<button type="button" class="link" data-act="q-edit">Ajustar detalles</button>' : ''}${S.sample && !Q.ai ? `<button type="button" class="link" data-act="q-ai">${svg('<path d="M12 3.5l1.9 4.7 4.6 1.8-4.6 1.9L12 16.5l-1.9-4.6-4.6-1.9 4.6-1.8z"/>', 14)}Mejorar con Claude</button>` : ''}${Q.ai ? '<span>Interpretado por Claude</span>' : ''}</div>`;
  }
  function onQuickInput() {
    if (Q.ctl) { Q.ctl.abort(); Q.ctl = null; }
    Q.ai = null;
    const txt = qin.value.trim();
    Q.parsed = txt ? P.parse(txt, { today: todayKey(), nowMin: nowMin() }) : null;
    renderPreview();
  }
  qin.addEventListener('input', onQuickInput);
  qin.addEventListener('keydown', e => { if (e.key === 'Escape') { qin.value = ''; onQuickInput(); qin.blur(); } });
  $('#quick').addEventListener('submit', e => { e.preventDefault(); addFromQuick(); });
  qprev.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'q-edit') {
      const p = (Q.ai && Q.ai[0]) || Q.parsed;
      if (!p) return;
      const draft = Object.assign({}, p);
      qin.value = ''; onQuickInput();
      openEditor({ draft });
    }
    if (b.dataset.act === 'q-ai') aiParse();
    if (b.dataset.act === 'q-stop' && Q.ctl) Q.ctl.abort();
  });
  $('#qai').addEventListener('click', () => { if (qin.value.trim()) aiParse(); else qin.focus(); });
  function addFromQuick() {
    const txt = qin.value.trim();
    if (!txt) { qin.focus(); return; }
    const raws = Q.ai || [Q.parsed || P.parse(txt, { today: todayKey(), nowMin: nowMin() })];
    const t = todayKey(), now = new Date().toISOString();
    const items = raws.map(r => C.sanitizeItem(r, t)).filter(Boolean).map(it => Object.assign(it, { id: newId(), createdAt: now }));
    if (!items.length) { renderPreview('<p class="qp-msg err">Escribe qué quieres agendar, por ejemplo: «Junta el viernes a las 10».</p>'); return; }
    dropExamples();
    Store.putMany(items);
    qin.value = ''; onQuickInput();
    items.forEach(it => S.flash.add(it.id));
    focusDate(items[0].date);
    render();
    const first = items[0];
    toast(items.length === 1 ? `Agregado: ${first.title} · ${whenLabel(first)}` : `Agregados ${items.length} elementos`,
      { undo: () => items.forEach(it => Store.remove(it.id)), action: items.length === 1 ? { label: 'Editar', fn: () => openEditor({ id: first.id, occ: first.date }) } : null });
  }

  // ---------- Claude: interpretar frases y responder preguntas ----------
  function contextLine() {
    const t = todayKey(), [y] = C.parts(t);
    return `Hoy es ${C.fmtLong(t)} de ${y} (${t}), son las ${C.fromMin(nowMin())}${TZ ? ' en la zona horaria ' + TZ : ''}.`;
  }
  const SCHEMA = '{"type":"event"|"task","title":string,"date":"AAAA-MM-DD","start":"HH:MM"|null,"end":"HH:MM"|null,"days":número,"repeat":null|{"freq":"daily"|"weekly"|"monthly"|"yearly","interval":número,"days":[0-6],"monthDays":[número, -1 = último día],"nth":1-5|-1,"wd":0-6,"until":"AAAA-MM-DD"},"category":"trabajo"|"personal"|"salud"|"familia"|"estudio"|"otro","location":string,"notes":string}';
  function aiParsePrompt(txt) {
    const t = todayKey();
    const fri = C.addDays(t, (5 - C.weekday(t) + 7) % 7 || 7), first = C.addMonths(C.monthStart(t), 1);
    return `Convierte el texto de una persona en elementos de su agenda. La persona vive en México y escribe en español.
${contextLine()}

Responde SOLO con un arreglo JSON. Cada elemento tiene esta forma:
${SCHEMA}

Reglas:
- "task" es un pendiente sin hora (pagar, comprar, llamar, enviar…). "event" ocurre en una hora o en un día.
- Días de la semana: 0 = domingo, 1 = lunes … 6 = sábado.
- Si un evento no tiene hora, start y end son null (es de todo el día); "days" indica cuántos días dura (1 si es un solo día).
- Si tiene hora de inicio y no de fin, dura una hora.
- Fechas sin año: la próxima fecha futura. "a las 5" sin a.m./p.m. es 17:00 salvo que el contexto diga otra cosa.
- El título es corto, sin fecha ni hora, con mayúscula inicial. El lugar va en "location".
- Si el texto menciona varias cosas, devuelve un elemento por cada una.

Ejemplo: «dentista el viernes 4pm y pagar renta el 1 de cada mes» →
[{"type":"event","title":"Dentista","date":"${fri}","start":"16:00","end":"17:00","days":1,"repeat":null,"category":"salud","location":"","notes":""},{"type":"task","title":"Pagar renta","date":"${first}","start":null,"end":null,"days":1,"repeat":{"freq":"monthly","interval":1,"monthDays":[1]},"category":"personal","location":"","notes":""}]

Texto: """${txt.slice(0, 2000)}"""`;
  }
  function aiError(e) {
    const code = e && e.code;
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) {
      S.sample = null; $('#qai').hidden = true; $('#askBtn').hidden = true;
      return 'Claude no está disponible aquí. Ritmo sigue funcionando sin él.';
    }
    return ({
      rate_limited: 'Claude está ocupado o llegaste a tu límite de uso. Intenta más tarde.',
      session_expired: 'Tu sesión de Claude expiró. Vuelve a iniciar sesión.',
      refused: 'Claude no pudo ayudar con eso. Prueba escribirlo de otra forma.',
      invalid_json: 'No pude leer la respuesta. Intenta de nuevo.',
      empty_completion: 'Claude no devolvió nada. Intenta de nuevo con menos texto.',
      prompt_too_large: 'Es demasiado texto. Pregunta por menos días.',
    })[code] || 'No se pudo conectar con Claude. Intenta de nuevo.';
  }
  async function aiParse() {
    const txt = qin.value.trim();
    if (!txt || !S.sample) return;
    if (Q.ctl) Q.ctl.abort();
    const ctl = Q.ctl = new AbortController();
    qprev.hidden = false;
    qprev.innerHTML = `<div class="qp-msg"><span class="thinking">Claude está leyendo tu frase</span><button type="button" class="link" data-act="q-stop">Detener</button></div>`;
    try {
      const res = await S.sample.json(aiParsePrompt(txt), { modelTier: 'quick', signal: ctl.signal });
      if (Q.ctl !== ctl || qin.value.trim() !== txt) return;
      const arr = Array.isArray(res) ? res : res && Array.isArray(res.items) ? res.items : [res];
      const list = arr.map(r => C.sanitizeItem(r, todayKey())).filter(Boolean);
      if (!list.length) throw { code: 'empty_completion' };
      Q.ai = list;
      Q.ctl = null;
      renderPreview();
    } catch (e) {
      if (Q.ctl !== ctl) return;
      Q.ctl = null;
      if (e && e.code === 'cancelled') { renderPreview(); return; }
      renderPreview(`<p class="qp-msg err">${esc(aiError(e))}</p>`);
    }
  }
  function agendaForAI() {
    const t = todayKey(), a = C.addDays(t, -7), b = C.addDays(t, 35);
    const lines = gather(a, b).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : sortOcc(x, y))).slice(0, 450).map(o => {
      if (o.holiday) return `${o.date} | todo el día | ${o.holiday.title} | festivo`;
      const it = o.item;
      const hora = isTimed(it) ? `${it.start}-${it.end || ''}` : 'todo el día';
      const tipo = it.type === 'task' ? (C.isDone(it, o.occ) ? 'pendiente hecho' : 'pendiente') : 'evento';
      return `${o.date} | ${hora} | ${it.title} | ${C.catName(it.category)}${it.location ? ' | ' + it.location : ''} | ${tipo}${it.repeat ? ' | ' + C.describeRepeat(it.repeat, it.date) : ''}`;
    });
    return { a, b, text: lines.join('\n') || '(sin elementos)' };
  }
  function askPrompt(q) {
    const ag = agendaForAI();
    return `Eres el asistente de "Ritmo", la agenda personal de una persona que vive en México.
${contextLine()}

Su agenda del ${ag.a} al ${ag.b} (fecha | hora | título | categoría | lugar | tipo):
${ag.text}

Pregunta: """${q.slice(0, 1500)}"""

Instrucciones:
- Responde en español de México, claro y amable, en máximo 120 palabras. Escribe fechas como "martes 27 de octubre" y horas como "5:00 p.m.".
- Usa solo lo que está en la agenda; si algo no aparece, dilo.
- Si te pide agendar, planear o apartar tiempo, propón elementos concretos que no se encimen con lo que ya tiene, entre 7:00 y 22:00. La persona decide si los agrega.
- Responde SOLO con JSON: {"respuesta": string, "propuestas": [${SCHEMA}]}. Si no hay propuestas, usa [].`;
  }
  function openAsk(pre) {
    if (!S.sample) return;
    const sugg = ['¿Qué tengo mañana?', 'Resume mi semana', 'Busca 2 horas libres esta semana para estudiar', '¿Cuándo es mi próximo pago?'];
    openSheet(`<div class="grab"></div><div class="sh-head"><h2>Pregúntale a tu agenda</h2><button type="button" class="icon-btn" data-act="close" aria-label="Cerrar">${I.close}</button></div>
      <p class="muted">Claude lee tus próximas semanas y responde. Si le pides planear algo, te propone eventos y tú decides cuáles agregar.</p>
      <div class="sugg">${sugg.map(s => `<button type="button" class="chipbtn" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <form class="ask" id="askForm"><label class="sr" for="askIn">Tu pregunta</label><textarea id="askIn" class="in" rows="2" placeholder="Ej. ¿Tengo algo el viernes en la tarde?"></textarea>
        <div class="ask-row"><button type="button" class="btn ghost" id="askStop" hidden>Detener</button><button type="submit" class="btn primary" id="askGo">${I.spark}Preguntar</button></div></form>
      <div class="ask-out" id="askOut" aria-live="polite"></div>`, 'Pregúntale a tu agenda', root => {
      const inp = $('#askIn', root), out = $('#askOut', root), stop = $('#askStop', root), go = $('#askGo', root);
      let ctl = null, props = [];
      const run = async q => {
        q = q.trim();
        if (!q) { inp.focus(); return; }
        if (ctl) ctl.abort();
        ctl = new AbortController();
        const mine = ctl;
        out.innerHTML = '<p class="answer thinking">Pensando</p>';
        stop.hidden = false; go.disabled = true;
        try {
          const res = await S.sample.json(askPrompt(q), { signal: mine.signal, cache: false });
          const answer = String((res && (res.respuesta || res.answer)) || '').trim() || 'Listo.';
          props = (res && Array.isArray(res.propuestas) ? res.propuestas : []).map(r => C.sanitizeItem(r, todayKey())).filter(Boolean);
          out.innerHTML = `<p class="answer">${esc(answer)}</p>${props.length ? `<div class="props">${props.map((p, i) => `<div class="prop" style="--c: var(--c-${esc(p.category)})"><span class="bar"></span>
            <span><b>${esc(p.title)}</b><small>${esc(dateLabel(p.date))}${p.start ? ', ' + esc(C.fmtRange(p.start, p.end, h12())) : p.type === 'task' ? ' · pendiente' : ' · todo el día'}${p.location ? ' · ' + esc(p.location) : ''}</small></span>
            <button type="button" class="btn sm" data-prop="${i}">Agregar</button></div>`).join('')}
            ${props.length > 1 ? '<button type="button" class="btn ghost" data-prop="all">Agregar todas</button>' : ''}</div>` : ''}`;
        } catch (e) {
          if (e && e.code === 'cancelled') { out.innerHTML = ''; }
          else out.innerHTML = `${e && e.text ? `<p class="answer">${esc(e.text)}</p>` : ''}<p class="qp-msg err">${esc(aiError(e))}</p>`;
        } finally {
          if (ctl === mine) { ctl = null; stop.hidden = true; go.disabled = false; }
        }
      };
      $('#askForm', root).addEventListener('submit', e => { e.preventDefault(); run(inp.value); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(inp.value); } });
      stop.addEventListener('click', () => ctl && ctl.abort());
      root.addEventListener('click', e => {
        const s = e.target.closest('[data-q]');
        if (s) { inp.value = s.dataset.q; run(s.dataset.q); return; }
        const p = e.target.closest('[data-prop]');
        if (!p) return;
        const now = new Date().toISOString();
        const chosen = (p.dataset.prop === 'all' ? props : [props[+p.dataset.prop]]).filter(Boolean).map(x => Object.assign(clone(x), { id: newId(), createdAt: now }));
        if (!chosen.length) return;
        dropExamples();
        Store.putMany(chosen);
        chosen.forEach(x => S.flash.add(x.id));
        if (p.dataset.prop === 'all') $$('[data-prop]', root).forEach(b => { b.disabled = true; b.textContent = 'Agregado'; });
        else { p.disabled = true; p.textContent = 'Agregado'; }
        toast(chosen.length === 1 ? 'Agregado: ' + chosen[0].title : `Agregados ${chosen.length} elementos`, { undo: () => chosen.forEach(x => Store.remove(x.id)) });
      });
      if (pre) { inp.value = pre; run(pre); } else setTimeout(() => inp.focus(), 60);
    });
  }

  // ---------- Buscar ----------
  function openSearch() {
    openSheet(`<div class="grab"></div><div class="sh-head"><h2>Buscar</h2><button type="button" class="icon-btn" data-act="close" aria-label="Cerrar">${I.close}</button></div>
      <label class="sr" for="sq">Buscar en tu agenda</label><input id="sq" class="in" type="search" placeholder="Dentista, junta, Zoom…" autocomplete="off">
      <div class="results" id="sres"></div>`, 'Buscar', root => {
      const inp = $('#sq', root), res = $('#sres', root);
      const t = todayKey();
      const nextOf = it => C.occurrenceStarts(it, t, C.addDays(t, 730))[0] || (it.repeat ? null : it.date) || it.date;
      const draw = () => {
        const q = P.norm(inp.value.trim());
        if (!q) { res.innerHTML = '<p class="muted" style="margin-top:8px">Escribe para buscar por título, lugar o notas.</p>'; return; }
        const hits = allItems().filter(it => P.norm(`${it.title} ${it.location || ''} ${it.notes || ''}`).includes(q))
          .map(it => ({ it, k: nextOf(it) })).sort((a, b) => ((a.k >= t) !== (b.k >= t) ? (a.k >= t ? -1 : 1) : a.k < b.k ? (a.k >= t ? -1 : 1) : (a.k >= t ? 1 : -1))).slice(0, 40);
        res.innerHTML = hits.length ? hits.map(({ it, k }) => `<button type="button" class="res" style="--c: var(--c-${esc(it.category)})" data-open="${esc(it.id)}" data-occ="${k}"><i></i>
          <span><b>${esc(it.title)}</b><small>${it.type === 'task' ? 'Pendiente' : 'Evento'}${it.location ? ' · ' + esc(it.location) : ''}${it.repeat ? ' · ' + esc(C.describeRepeat(it.repeat, it.date)) : ''}</small></span><time>${esc(dateLabel(k, t))}</time></button>`).join('')
          : '<p class="muted" style="margin-top:8px">No encontré nada con eso.</p>';
      };
      inp.addEventListener('input', draw);
      draw();
      setTimeout(() => inp.focus(), 60);
    });
  }

  // ---------- Ajustes, exportar e importar ----------
  function openSettings() {
    const s = Store.settings;
    const canSave = !!S.downloads || !(window.claude && typeof window.claude.use === 'function');
    openSheet(`<div class="grab"></div><div class="sh-head"><h2>Ajustes</h2><button type="button" class="icon-btn" data-act="close" aria-label="Cerrar">${I.close}</button></div>
      <div class="group"><h3>Tema</h3><div class="skins" role="radiogroup" aria-label="Tema">${SKINS.map(([id, name, c]) => `<button type="button" class="skin" role="radio" data-skin="${id}" aria-checked="${(s.skin || 'ritmo') === id}"><span class="sw4">${c.map(x => `<i style="background:${x}"></i>`).join('')}</span>${name}</button>`).join('')}</div></div>
      <div class="group"><h3>Preferencias</h3>
        <div class="switch-row"><span class="lbl" id="l-ws">La semana empieza en</span><div class="seg" role="group" aria-labelledby="l-ws"><button type="button" data-set="weekStart" data-v="0" aria-pressed="${s.weekStart === 0}">Domingo</button><button type="button" data-set="weekStart" data-v="1" aria-pressed="${s.weekStart === 1}">Lunes</button></div></div>
        <div class="switch-row"><span class="lbl" id="l-h">Formato de hora</span><div class="seg" role="group" aria-labelledby="l-h"><button type="button" data-set="h12" data-v="1" aria-pressed="${s.h12}">5:00 p.m.</button><button type="button" data-set="h12" data-v="0" aria-pressed="${!s.h12}">17:00</button></div></div>
        <div class="switch-row"><span class="lbl" id="l-hol">Días festivos de México<small>Descansos obligatorios y fechas que se celebran</small></span><button type="button" class="sw" role="switch" data-toggle-set="holidays" aria-checked="${s.holidays}" aria-labelledby="l-hol"></button></div>
      </div>
      <div class="group"><h3>Categorías visibles</h3>${C.CATEGORIES.map(c => `<button type="button" class="catrow" role="checkbox" aria-checked="${!(s.hiddenCats || []).includes(c.id)}" data-cat="${c.id}" style="--c: var(--c-${c.id})"><span class="box">${I.check}</span>${c.name}</button>`).join('')}</div>
      <div class="group"><h3>Tus datos</h3>${syncHTML()}
        <div class="actions-list" style="margin-top:10px">
          ${canSave ? `<button type="button" class="act" data-exp="csv">${I.down}<span><b>Exportar para Google Calendar</b><small>Archivo .csv que Google Calendar importa</small></span></button>
          <button type="button" class="act" data-exp="ics">${I.down}<span><b>Exportar para Apple, Outlook y otros</b><small>Archivo .ics dentro de un .zip</small></span></button>
          <button type="button" class="act" data-exp="json">${I.down}<span><b>Descargar respaldo</b><small>Todo Ritmo en un archivo .json</small></span></button>` : '<p class="muted" style="margin:0">Las descargas no están disponibles en esta vista.</p>'}
          <button type="button" class="act" data-imp="1">${I.up}<span><b>Importar</b><small>Archivo .ics, el .zip que exporta Google Calendar o un respaldo .json</small></span></button>
        </div>
        <div class="confirm" id="wipe" hidden></div>
        <button type="button" class="btn ghost danger" data-act="ask-wipe" style="justify-self:start;margin-top:6px">${I.trash}Borrar toda la agenda</button>
      </div>
      <div class="group"><h3>Atajos de teclado</h3><div class="keys"><kbd>N</kbd><span>Escribir algo nuevo</span><kbd>/</kbd><span>Buscar</span><kbd>T</kbd><span>Ir a hoy</span><kbd>1–4</kbd><span>Agenda, Día, Semana, Mes</span><kbd>← →</kbd><span>Anterior y siguiente</span><kbd>Esc</kbd><span>Cerrar</span></div></div>`, 'Ajustes', root => {
      root.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.skin) { Store.setSettings({ skin: b.dataset.skin }); $$('[data-skin]', root).forEach(x => x.setAttribute('aria-checked', String(x === b))); }
        if (b.dataset.set) { Store.setSettings({ [b.dataset.set]: b.dataset.set === 'h12' ? b.dataset.v === '1' : +b.dataset.v }); $$(`[data-set="${b.dataset.set}"]`, root).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
        if (b.dataset.toggleSet) { const v = !Store.settings[b.dataset.toggleSet]; Store.setSettings({ [b.dataset.toggleSet]: v }); b.setAttribute('aria-checked', String(v)); }
        if (b.dataset.cat) { toggleCat(b.dataset.cat); b.setAttribute('aria-checked', String(!(Store.settings.hiddenCats || []).includes(b.dataset.cat))); }
        if (b.dataset.exp) exportAs(b.dataset.exp);
        if (b.dataset.imp) $('#importFile').click();
        if (b.dataset.act === 'ask-wipe') {
          const box = $('#wipe', root);
          box.hidden = false;
          box.innerHTML = `<p>¿Borrar los ${Store.items.size} elementos de tu agenda? Descarga un respaldo antes si lo quieres conservar.</p><div class="btns"><button type="button" class="btn sm solid-danger" data-wipe="yes">Borrar todo</button><button type="button" class="btn sm ghost" data-wipe="no">Cancelar</button></div>`;
        }
        if (b.dataset.wipe === 'no') $('#wipe', root).hidden = true;
        if (b.dataset.wipe === 'yes') {
          const all = [...Store.items.values()];
          all.forEach(it => Store.remove(it.id));
          closeSheet();
          toast(`Agenda borrada (${all.length})`, { undo: () => Store.putMany(all) });
        }
      });
    });
  }
  function toggleCat(id) {
    const hidden = new Set(Store.settings.hiddenCats || []);
    hidden.has(id) ? hidden.delete(id) : hidden.add(id);
    Store.setSettings({ hiddenCats: [...hidden] });
  }
  async function exportAs(kind) {
    const items = [...Store.items.values()];
    if (!items.length) { toast('Aún no hay nada que exportar.'); return; }
    const t = todayKey();
    let name, data;
    if (kind === 'csv') { name = `ritmo-google-calendar-${t}.csv`; data = C.toGoogleCSV(items, C.addDays(t, -30), C.addDays(t, 365)); }
    else if (kind === 'ics') { name = `ritmo-${t}.zip`; data = new Blob([C.zip([{ name: 'ritmo.ics', data: C.toICS(items, { tz: TZ }) }])]); }
    else { name = `ritmo-respaldo-${t}.json`; data = JSON.stringify({ app: 'Ritmo', version: 1, exportedAt: new Date().toISOString(), settings: Store.settings, items }, null, 2); }
    if (S.downloads) {
      try { await S.downloads.save({ filename: name, data }); toast('Listo: ' + name); }
      catch (e) { if (!e || e.code !== 'declined') toast(e && e.code === 'rate_limited' ? 'Espera un momento e inténtalo otra vez.' : 'No se pudo descargar el archivo.'); }
      return;
    }
    if (!(window.claude && typeof window.claude.use === 'function')) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Listo: ' + name);
    }
  }
  $('#importFile').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const name = file.name.toLowerCase(), buf = await file.arrayBuffer(), dec = new TextDecoder();
      let raws = [];
      if (name.endsWith('.zip')) { for (const f of await C.unzip(buf)) if (f.bytes && /\.ics$/i.test(f.name)) raws.push(...C.parseICS(dec.decode(f.bytes))); }
      else if (name.endsWith('.json')) { const j = JSON.parse(dec.decode(buf)); raws = Array.isArray(j) ? j : (j && j.items) || []; }
      else raws = C.parseICS(dec.decode(buf));
      const t = todayKey(), now = new Date().toISOString();
      const sig = it => `${P.norm(it.title)}|${it.date}|${it.start || ''}|${it.type}`;
      const seen = new Set([...Store.items.values()].map(sig));
      const out = [];
      let dup = 0;
      for (const r of raws) {
        const it = C.sanitizeItem(r, t);
        if (!it) continue;
        if (!r.category) it.category = P.inferCategory(it.title + ' ' + it.location) || 'personal';
        if (seen.has(sig(it))) { dup++; continue; }
        seen.add(sig(it));
        it.id = r.id && /^[A-Za-z0-9_-]{1,60}$/.test(r.id) && !Store.items.has(r.id) ? r.id : newId();
        it.createdAt = now;
        out.push(it);
      }
      if (!out.length) { toast(dup ? 'Todo lo de ese archivo ya estaba en tu agenda.' : 'No encontré eventos en ese archivo.'); return; }
      dropExamples();
      Store.putMany(out);
      closeSheet();
      toast(`Importados ${out.length}${dup ? ` (${dup} ya estaban)` : ''}`, { undo: () => out.forEach(it => Store.remove(it.id)) });
    } catch (err) {
      toast('No pude leer ese archivo. Usa un .ics, un .zip de Google Calendar o un respaldo .json de Ritmo.');
    }
  });

  // ---------- Aviso con deshacer ----------
  let toastTimer = null;
  function toast(msg, opt) {
    const o = opt || {}, el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${o.undo ? '<button type="button" data-t="undo">Deshacer</button>' : ''}${o.action ? `<button type="button" data-t="act">${esc(o.action.label)}</button>` : ''}`;
    el.hidden = false;
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      el.hidden = true;
      if (b.dataset.t === 'undo' && o.undo) o.undo();
      if (b.dataset.t === 'act' && o.action) o.action.fn();
    };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, o.undo || o.action ? 6500 : 3500);
  }

  // ---------- Navegación ----------
  function setView(v) {
    if (!VIEWS.includes(v)) return;
    S.view = v;
    if (v !== 'agenda') S.miniMonth = null;
    S.scrollTo = true;
    ls.set('ritmo.v1.view', v);
    render();
  }
  function step(n) {
    if (S.view === 'dia') S.cursor = C.addDays(S.cursor, n);
    else if (S.view === 'semana') S.cursor = C.addDays(S.cursor, 7 * n);
    else if (S.view === 'mes') { S.cursor = C.addMonths(C.monthStart(S.cursor), n); S.selected = S.cursor; }
    else return;
    S.selected = S.view === 'mes' ? S.selected : S.cursor;
    S.miniMonth = null;
    S.scrollTo = true;
    render();
  }
  function goToday() {
    S.cursor = S.selected = todayKey();
    S.miniMonth = null;
    S.agendaFrom = null;
    S.scrollTo = true;
    render();
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-open],[data-toggle],[data-new],[data-day],[data-pick],[data-sel],[data-view],[data-act],[data-cat],[data-mini],.grid');
    if (!el || (S.sheetOpen && card.contains(el) && !el.matches('[data-open]'))) return;
    if (el.closest('#sheetCard') && !el.matches('[data-open]')) return;
    const d = el.dataset;
    if (d.toggle) { toggleTask(d.toggle, d.occ); return; }
    if (d.open) { if (S.sheetOpen) closeSheet(); openEditor({ id: d.open, occ: d.occ }); return; }
    if (d.new) { openEditor({ draft: { date: d.new } }); return; }
    if (d.day) { S.cursor = S.selected = d.day; setView('dia'); return; }
    if (d.pick) { S.cursor = S.selected = d.pick; S.miniMonth = null; if (S.view === 'agenda') setView('dia'); else { S.scrollTo = true; render(); } return; }
    if (d.sel) { if (S.selected === d.sel) { S.cursor = d.sel; setView('dia'); } else { S.selected = d.sel; render(); } return; }
    if (d.view) { setView(d.view); return; }
    if (d.cat) { toggleCat(d.cat); return; }
    if (d.mini) { S.miniMonth = C.addMonths(S.miniMonth || C.monthStart(S.cursor), +d.mini); renderSide(); return; }
    if (d.act === 'more') { S.agendaDays = Math.min(730, S.agendaDays + 60); render(); return; }
    if (d.act === 'past') { S.agendaFrom = C.addDays(S.agendaFrom && S.agendaFrom < todayKey() ? S.agendaFrom : todayKey(), -30); render(); return; }
    if (d.act === 'examples-off') { Store.setSettings({ examplesOff: true }); toast('Listo. Escribe abajo tu primer evento.'); return; }
    if (d.act === 'overdue-today') {
      const t = todayKey();
      const list = [...Store.items.values()].filter(it => it.type === 'task' && !it.repeat && !it.done && it.date < t);
      if (!list.length) { if (S.examples) toast('Son ejemplos: agrega tus pendientes para usar esta opción.'); return; }
      const before = list.map(clone);
      Store.putMany(list.map(it => Object.assign(clone(it), { date: t })));
      toast(`${list.length} ${list.length === 1 ? 'pendiente pasó' : 'pendientes pasaron'} a hoy`, { undo: () => Store.putMany(before) });
      return;
    }
    if (el.classList.contains('grid') && e.target === el) {
      const r = el.getBoundingClientRect(), min = Math.max(0, Math.min(1410, Math.floor(((e.clientY - r.top) / r.height) * 1440 / 30) * 30));
      openEditor({ draft: { date: el.dataset.grid, start: C.fromMin(min), end: C.fromMin(min + 60) } });
    }
  });
  $('#todayBtn').addEventListener('click', () => { goToday(); if (S.view === 'agenda') scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#prevBtn').addEventListener('click', () => step(-1));
  $('#nextBtn').addEventListener('click', () => step(1));
  $('#searchBtn').addEventListener('click', openSearch);
  $('#askBtn').addEventListener('click', () => openAsk());
  $('#menuBtn').addEventListener('click', openSettings);
  $('#searchBtn').innerHTML = I.search;
  $('#askBtn').innerHTML = I.spark;
  $('#menuBtn').innerHTML = I.sliders;
  $('#prevBtn').innerHTML = I.left;
  $('#nextBtn').innerHTML = I.right;
  $('#qadd').innerHTML = I.plus;
  $('#qai').innerHTML = I.spark;

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && S.sheetOpen) { closeSheet(); return; }
    if (S.sheetOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const k = e.key;
    if (k === 'n' || k === 'N') { e.preventDefault(); qin.focus(); }
    else if (k === '/') { e.preventDefault(); openSearch(); }
    else if (k === 't' || k === 'T') goToday();
    else if (k >= '1' && k <= '4') setView(VIEWS[+k - 1]);
    else if (k === 'ArrowLeft') step(-1);
    else if (k === 'ArrowRight') step(1);
  });
  // Deslizar para cambiar de día, semana o mes
  let sx = 0, sy = 0, st = 0;
  const onStart = e => { const p = e.touches[0]; sx = p.clientX; sy = p.clientY; st = Date.now(); };
  const onEnd = e => {
    if (S.view === 'agenda') return;
    const p = e.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - st < 700) step(dx < 0 ? 1 : -1);
  };
  for (const el of [view, $('#strip')]) { el.addEventListener('touchstart', onStart, { passive: true }); el.addEventListener('touchend', onEnd, { passive: true }); }

  // Medidas para encabezados fijos
  const root = document.documentElement;
  const measure = () => {
    root.style.setProperty('--top-h', $('#top').getBoundingClientRect().height + 'px');
    root.style.setProperty('--quick-h', $('#quick').getBoundingClientRect().height + 'px');
  };
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(measure); ro.observe($('#top')); ro.observe($('#quick')); }
  let lastWide = wide(), lastSide = hasSide();
  addEventListener('resize', () => { measure(); if (wide() !== lastWide || hasSide() !== lastSide) { lastWide = wide(); lastSide = hasSide(); render(); } });

  // Reloj: refresca la línea de "ahora" y cambia de día a medianoche
  setInterval(() => {
    if (document.visibilityState !== 'visible' || S.sheetOpen) return;
    const t = todayKey();
    if (t !== S.lastToday) { if (S.cursor === S.lastToday) S.cursor = S.selected = t; S.lastToday = t; }
    render();
  }, 60000);

  // Capacidades de Claude (si la página está dentro de Claude)
  async function connectCaps() {
    const CL = window.claude;
    if (!CL || typeof CL.use !== 'function') return;
    const [sample, downloads] = await Promise.all([CL.use('sample').catch(() => null), CL.use('downloads').catch(() => null)]);
    S.sample = sample; S.downloads = downloads;
    $('#qai').hidden = !sample;
    $('#askBtn').hidden = !sample;
    if (qin.value.trim()) renderPreview();
  }

  function start(data) {
    const fromHash = (location.hash || '').slice(1);
    const saved = (data && data.view) || (VIEWS.includes(fromHash) ? fromHash : ls.get('ritmo.v1.view', 'agenda'));
    S.view = VIEWS.includes(saved) ? saved : 'agenda';
    if (data && C.isKey(data.cursor)) { S.cursor = data.cursor; S.selected = data.selected || data.cursor; }
    Store.onChange(render);
    Store.init();
    measure();
    connectCaps();
  }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ view: S.view, cursor: S.cursor, selected: S.selected }));
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
