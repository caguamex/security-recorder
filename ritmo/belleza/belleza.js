/* Agendappx — agenda de salón con aspecto de iPhone.
   Guarda en tu cuenta (capacidad db de Claude) cuando está disponible y, si no, en este dispositivo. */
(() => {
  'use strict';
  // El secreto de un solo uso no llega al servidor en la URL ni permanece en el historial.
  function tomarEnlaceActivacion() {
    if (!location.hash.startsWith('#activar-dispositivo=')) return '';
    const enlace = location.hash.slice('#activar-dispositivo='.length);
    history.replaceState(null, '', location.pathname + location.search);
    return enlace;
  }
  let enlaceActivacion = tomarEnlaceActivacion();
  const C = window.RitmoCore;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const newId = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const today = () => C.toKey(new Date());
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const money = n => '$' + Math.round(+n || 0).toLocaleString('es-MX');
  const clone = o => JSON.parse(JSON.stringify(o));
  const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } })();
  const svg = (p, s = 24, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const I = {
    agenda: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', 26, 1.8),
    clientas: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>', 26, 1.8),
    servicios: svg('<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z"/>', 26, 1.8),
    promos: svg('<path d="M3 11l15-6v14L3 13z"/><path d="M7 13v5"/>', 26, 1.8),
    mas: svg('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>', 26, 1.8),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 26, 2.2),
    left: svg('<path d="m15 18-6-6 6-6"/>', 22, 2.4),
    chev: svg('<path d="m9 6 6 6-6 6"/>', 18, 2.2),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 18),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 20, 2.6),
  };

  // ---------- Catálogos ----------
  const CATS = [['Uñas', '#E0457B'], ['Cabello', '#8B5CF6'], ['Pestañas', '#0EA5A4'], ['Cejas', '#F08A24'], ['Facial', '#22A45D'], ['Otro', '#8E8E93']];
  const catColor = c => (CATS.find(x => x[0] === c) || CATS[5])[1];
  // Referencias visuales de demostración; no se escriben en los datos del salón.
  const FOTOS_TRABAJOS = {
    extensiones: ['./trabajos/extensiones-1.jpg', './trabajos/extensiones-2.jpg', './trabajos/extensiones-3.jpg'],
    lifting: ['./trabajos/lifting-cejas.jpg'],
  };
  const fotoValida = foto => typeof foto === 'string' && foto.length <= 48000 && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(foto);
  async function prepararFoto(archivo) {
    if (!archivo || archivo.size > 20 * 1024 * 1024) throw new Error('Elige una foto de hasta 20 MB.');
    if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/i.test(archivo.type)) throw new Error('Elige una foto JPG, PNG o WebP.');
    const url = URL.createObjectURL(archivo), imagen = new Image();
    try {
      await new Promise((resolve, reject) => {
        imagen.onload = resolve;
        imagen.onerror = () => reject(new Error('No se pudo abrir la foto. Intenta con una imagen JPG, PNG o WebP.'));
        imagen.src = url;
      });
      if (!imagen.naturalWidth || !imagen.naturalHeight) throw new Error('La foto no tiene un tamaño válido.');
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Este navegador no pudo preparar la foto.');
      for (let lado = 800; lado >= 200; lado = Math.floor(lado * .75)) {
        const escala = Math.min(1, lado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
        canvas.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
        canvas.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
        for (const calidad of [.82, .68, .52, .38]) {
          const foto = canvas.toDataURL('image/jpeg', calidad);
          if (fotoValida(foto)) return foto;
        }
      }
      throw new Error('No se pudo reducir esta foto. Prueba con otra imagen.');
    } finally { URL.revokeObjectURL(url); }
  }
  function fotosServicio(s) {
    if (s.foto === null) return [];
    if (fotoValida(s.foto)) return [s.foto];
    const nombre = String(s.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (s.categoria === 'Cejas') return FOTOS_TRABAJOS.lifting;
    if (s.categoria !== 'Pestañas') return [];
    if (/lifting|laminado|rizado/.test(nombre)) return FOTOS_TRABAJOS.lifting;
    if (/extension|volumen|clasica|hibrid|efecto/.test(nombre)) return FOTOS_TRABAJOS.extensiones;
    return [];
  }
  function miniaturaServicio(s) {
    const foto = fotosServicio(s)[0];
    return foto ? `<img class="sq trabajo-mini" src="${esc(foto)}" alt="" loading="lazy" decoding="async" style="--foco:${s.categoria === 'Cejas' ? '45%' : '64%'}">`
      : `<span class="sq" style="--c:${catColor(s.categoria)}"></span>`;
  }
  const PROMO_COLORS = ['#E0457B', '#8B5CF6', '#0EA5A4', '#F08A24', '#1F3FD1'];
  const ESTADOS = [['confirmada', 'Confirmada'], ['pendiente', 'Por confirmar'], ['completada', 'Completada'], ['cancelada', 'Cancelada']];
  const estadoTxt = e => (ESTADOS.find(x => x[0] === e) || ESTADOS[1])[1];
  const SKINS = [
    ['clasico', 'Clásico iOS', ['#F2F2F7', '#FFFFFF', '#007AFF', '#FF3B30']],
    ['rosa', 'Rosa champaña', ['#FBF5F3', '#F6E1E2', '#B8606B', '#3B2422']],
    ['dorado', 'Negro y dorado', ['#000000', '#1C1C1E', '#D4AF6A', '#F5F5F7']],
    ['ritmo', 'Ritmo', ['#F6F7F9', '#FFFFFF', '#1F3FD1', '#FFE15A']],
    ['cristal', 'Cristal pastel', ['#EFE4FF', '#FFE6F2', '#8B5CF6', '#EC4899']],
  ];
  const DEFAULTS = {
    skin: 'clasico', modo: 'white', negocio: 'Mi salón', abre: '10:00', cierra: '20:00', examplesOff: true,
    waConfirm: true, waRecordar: true, waGracias: false,
    tplConfirm: 'Hola {nombre} 💅 Tu cita de {servicio} quedó agendada para el {fecha} a las {hora}. Te esperamos en {negocio}.',
    tplRecordar: 'Hola {nombre} 💅 Te esperamos mañana a las {hora} para tu {servicio}. Responde 1 para confirmar o 2 para cambiar.',
    tplGracias: 'Gracias por tu visita, {nombre} ✨ ¿Nos dejas tu opinión? Nos ayuda muchísimo.',
  };

  // ---------- Almacén ----------
  const ls = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  };
  const ClaudeStore = (() => {
    const K = { items: 'belleza.v1.items', settings: 'belleza.v1.settings', mode: 'belleza.v1.mode', cache: 'belleza.v1.cloudcache' };
    const listeners = new Set();
    let mode = 'local', ready = false, items = new Map(), settings = Object.assign({}, DEFAULTS);
    let base = null, coll = null, unsub = null, saveTimer = null, active = 0;
    const pending = new Map(), inflight = new Set(), queue = [];
    const emit = () => listeners.forEach(f => f());
    const inClaude = () => !!(window.claude && typeof window.claude.use === 'function');
    function load() {
      settings = Object.assign({}, DEFAULTS, ls.get(K.settings, {}));
      const wasCloud = ls.get(K.mode, 'local') === 'cloud' && inClaude();
      items = new Map(ls.get(wasCloud ? K.cache : K.items, []).filter(x => x && x.id).map(x => [x.id, x]));
      ready = !wasCloud || items.size > 0;
    }
    function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => ls.set(mode === 'cloud' ? K.cache : K.items, [...items.values()]), 120); }
    const refFor = id => (id === '__settings' ? base : coll.doc(id));
    function schedule(id) { if (!queue.includes(id) && !inflight.has(id)) queue.push(id); pump(); }
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
        toLocal();
      }
    }
    function write(id, data) { persist(); if (mode !== 'cloud') return; pending.set(id, data); schedule(id); }
    function toLocal() {
      if (mode !== 'cloud') return;
      mode = 'local';
      if (unsub) { unsub(); unsub = null; }
      ls.set(K.mode, 'local'); ls.set(K.items, [...items.values()]);
      emit();
      toast('No se pudo guardar en tu cuenta. Se guardará en este dispositivo.');
    }
    async function connect() {
      if (!inClaude()) { if (!ready) { ready = true; emit(); } return; }
      let db = null, user = null;
      try { [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch (e) { /* sin capacidades */ }
      const uid = user ? await user.id() : null;
      if (!db || !uid) { if (!ready) { items = new Map(ls.get(K.items, []).map(x => [x.id, x])); ready = true; emit(); } return; }
      base = db.doc('data/users/' + uid + '/belleza');
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
          const device = ls.get(K.mode, 'local') !== 'cloud' ? ls.get(K.items, []) : [];
          mode = 'cloud'; ls.set(K.mode, 'cloud');
          if (snap.empty && device.length) for (const it of device) { next.set(it.id, it); pending.set(it.id, it); schedule(it.id); }
        }
        items = next; ready = true; persist(); emit();
      }, err => { if (err && err.code !== 'revoked') toLocal(); });
    }
    return {
      get items() { return items; }, get settings() { return settings; }, get mode() { return mode; }, get ready() { return ready; },
      onChange: f => listeners.add(f),
      init() { load(); emit(); connect(); },
      put(it) { it.updatedAt = new Date().toISOString(); items.set(it.id, it); write(it.id, it); emit(); },
      putMany(list) { const t = new Date().toISOString(); for (const it of list) { it.updatedAt = t; items.set(it.id, it); write(it.id, it); } emit(); },
      remove(id) { items.delete(id); write(id, null); emit(); },
      setSettings(p) { settings = Object.assign({}, settings, p); ls.set(K.settings, settings); if (mode === 'cloud') { pending.set('__settings', settings); schedule('__settings'); } emit(); },
    };
  })();

  // Conserva la integración original de Claude; fuera de ella usa caché y API propia.
  const Store = (() => {
    if (window.claude && typeof window.claude.use === 'function') return ClaudeStore;
    const listeners = new Set();
    let sync;
    const emit = () => listeners.forEach(f => f());
    const seguro = fn => { try { fn(); return true; } catch { toast('No se pudo guardar. Libera espacio en este dispositivo y vuelve a intentar.'); return false; } };
    return {
      get items() { return sync ? sync.items : new Map(); }, get settings() { return sync ? sync.settings : DEFAULTS; },
      get ready() { return !!sync; }, get mode() { return sync?.connected ? 'servidor' : 'local'; },
      get sync() { return sync; }, onChange: f => listeners.add(f),
      init() {
        try { sync = window.BellezaSync.crear({ storage: localStorage, fetcher: (...args) => fetch(...args), defaults: DEFAULTS, onChange: emit }); }
        catch { toast('No se pudo abrir el almacenamiento. Revisa el espacio disponible y vuelve a abrir la app.'); return; }
        emit(); void sync.restaurarSesion();
        window.addEventListener('online', () => void sync.sync());
        window.addEventListener('storage', () => sync.actualizar());
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void sync.sync(); });
        setInterval(() => { if (document.visibilityState === 'visible') void sync.sync(); }, 30000);
      },
      put(it) { return seguro(() => sync.put({ ...it, updatedAt: new Date().toISOString() })); },
      putMany(items) { return seguro(() => { for (const it of items) sync.put({ ...it, updatedAt: new Date().toISOString() }); }); },
      remove(id) { return seguro(() => sync.remove(id)); }, setSettings(patch) { return seguro(() => sync.setSettings(patch)); },
    };
  })();

  // La agenda inicia vacía: los registros aparecen únicamente cuando los captura el salón.
  const all = () => [...Store.items.values()];
  const list = kind => all().filter(x => x.kind === kind);
  const byId = id => all().find(x => x.id === id) || null;
  const save = it => Store.put(it) !== false;
  const remove = id => Store.remove(id) !== false;

  // ---------- Utilidades de citas ----------
  const svcOf = c => byId(c.servicio) || { nombre: 'Servicio', categoria: 'Otro', duracion: 60, precio: 0 };
  const cliOf = c => byId(c.clienta) || { nombre: 'Clienta', telefono: '' };
  const endOf = c => C.toMin(c.start) + (+svcOf(c).duracion || 60);
  const initials = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const citasDe = d => list('cita').filter(c => c.date === d).sort((a, b) => C.toMin(a.start) - C.toMin(b.start));
  const fechaLarga = d => `${C.DOW[C.weekday(d)]} ${+d.slice(8)} de ${C.MES[+d.slice(5, 7) - 1]}`;
  function relDay(d) { const n = C.diffDays(today(), d); return n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === -1 ? 'ayer' : null; }
  function fill(tpl, c) {
    const s = svcOf(c), k = cliOf(c);
    return String(tpl).replace(/\{nombre\}/g, (k.nombre || '').split(' ')[0]).replace(/\{servicio\}/g, s.nombre.toLowerCase())
      .replace(/\{fecha\}/g, fechaLarga(c.date)).replace(/\{hora\}/g, c.start).replace(/\{negocio\}/g, Store.settings.negocio);
  }
  function phone(p) { let d = String(p || '').replace(/\D/g, ''); if (d.length === 10) d = '52' + d; return d; }
  const waLink = (tel, msg) => `https://wa.me/${phone(tel)}?text=${encodeURIComponent(msg)}`;
  function gcalLink(c) {
    const s = svcOf(c), k = cliOf(c), e = C.fromMin(endOf(c));
    const dt = (d, t) => d.replace(/-/g, '') + 'T' + t.replace(':', '') + '00';
    const q = new URLSearchParams({ action: 'TEMPLATE', text: `${s.nombre} · ${k.nombre}`, dates: `${dt(c.date, c.start)}/${dt(endOf(c) >= 1440 ? C.addDays(c.date, 1) : c.date, e)}`, details: `${money(s.precio)} · ${k.telefono || ''}`, location: Store.settings.negocio });
    if (TZ) q.set('ctz', TZ);
    return 'https://calendar.google.com/calendar/render?' + q;
  }
  function freeSlots(date, dur, ignoreId) {
    const s = Store.settings, open = C.toMin(s.abre), close = C.toMin(s.cierra);
    const busy = citasDe(date).filter(c => c.id !== ignoreId && c.estado !== 'cancelada').map(c => [C.toMin(c.start), endOf(c)]);
    const out = [], nm = date === today() ? nowMin() : -1;
    for (let m = open; m + dur <= close; m += 30) {
      if (m <= nm) continue;
      if (busy.some(([a, b]) => m < b && m + dur > a)) continue;
      out.push(C.fromMin(m));
    }
    return out;
  }

  // ---------- Estado de la vista ----------
  const S = { tab: 'agenda', day: today(), seg: 'servicios', cat: 'Todas', q: '', sheetOpen: false };
  const screen = $('#screen');
  function applySkin() {
    const k = Store.settings.skin || 'clasico';
    if (Store.settings.modo === 'dark') document.documentElement.dataset.modo = 'dark'; else delete document.documentElement.dataset.modo;
    if (k === 'clasico') delete document.documentElement.dataset.skin; else document.documentElement.dataset.skin = k;
  }
  function render() {
    applySkin();
    const tabs = [['agenda', 'Agenda'], ['clientas', 'Clientas'], ['servicios', 'Servicios'], ['promos', 'Promos'], ['mas', 'Ajustes']];
    $('#tabbar').innerHTML = tabs.map(([k, n]) => `<button type="button" class="tab" role="tab" aria-label="${n}" data-tab="${k}" aria-selected="${S.tab === k || (k === 'servicios' && S.tab === 'promos')}">${I[k]}${n}</button>`).join('');
    $('#fab').hidden = false;
    if (!Store.ready) { screen.innerHTML = '<p class="empty">Cargando…</p>'; return; }
    screen.innerHTML = ({ agenda: viewAgenda, clientas: viewClientas, servicios: viewServicios, promos: viewServicios, mas: viewMas })[S.tab]();
  }
  // Permite retirar ejemplos guardados por versiones anteriores sin borrar registros propios.
  const banner = () => all().some(x => x.example) ? `<div class="banner"><p>Todavía tienes datos de ejemplo.</p><button type="button" class="btn" data-act="borrar-ejemplos">Borrar ejemplos</button></div>` : '';

  // Agenda
  let lastScrollDay = null;
  function viewAgenda() {
    const t = today(), d = S.day, s = Store.settings;
    const ws = C.startOfWeek(d, 0), days = Array.from({ length: 7 }, (_, i) => C.addDays(ws, i));
    const citas = citasDe(d), activas = citas.filter(c => c.estado !== 'cancelada');
    const total = activas.reduce((a, c) => a + (+svcOf(c).precio || 0), 0);
    const huecos = freeSlots(d, 60).filter(x => x.endsWith(':00')).length;
    const open = Math.floor(C.toMin(s.abre) / 60), close = Math.ceil(C.toMin(s.cierra) / 60), H = 72;
    const blocks = activas.concat(citas.filter(c => c.estado === 'cancelada')).map(c => ({ c, s: C.toMin(c.start), e: Math.max(endOf(c), C.toMin(c.start) + 30) }));
    C.layoutColumns(blocks);
    const evs = blocks.map(({ c, s: st, e, col, cols }) => {
      const sv = svcOf(c), k = cliOf(c), color = catColor(sv.categoria), dur = e - st;
      const top = ((st - open * 60) / 60) * H, h = (dur / 60) * H - 3;
      const sent = c.enviados && c.enviados.confirmacion;
      return `<button type="button" class="ev ${dur <= 45 ? 'short' : ''} ${c.estado === 'cancelada' ? 'cancel' : ''}" data-cita="${esc(c.id)}" style="--c:${color};top:${top}px;height:${h}px;left:calc(60px + (100% - 60px) * ${col / cols} + 2px);width:calc((100% - 60px) / ${cols} - 4px)">
        <b>${dur <= 45 ? esc(c.start) + ' ' : ''}${esc(sv.nombre)}${dur <= 45 ? ' · ' + esc(k.nombre.split(' ')[0]) : ''}</b><span class="t">${esc(c.start)} – ${C.fromMin(endOf(c))} · ${money(sv.precio)}</span>
        <span class="who"><span class="av" style="--c:${color}">${esc(initials(k.nombre))}</span><span class="n">${esc(k.nombre)}</span><span class="st ${c.estado}">${c.solicitaCambio ? 'Cambiar cita' : sent && c.estado === 'confirmada' ? '✓ WhatsApp' : esc(estadoTxt(c.estado))}</span></span></button>`;
    }).join('');
    let hours = '';
    for (let h = open; h < close; h++) hours += `<div class="hr" style="--h:${H}px"><span>${C.pad(h)}:00</span><i data-newat="${C.pad(h)}:00" aria-hidden="true"></i></div>`;
    const nm = nowMin();
    const now = d === t && nm >= open * 60 && nm <= close * 60 ? `<div class="nowline" style="top:${((nm - open * 60) / 60) * H}px"></div>` : '';
    return `<div class="nav"><button type="button" data-act="mes">${I.left}${C.cap(C.MES[+d.slice(5, 7) - 1])}</button><button type="button" data-act="hoy" style="font-weight:600">Hoy</button></div>
      <h1 class="big"><span>${C.cap(C.DOW[C.weekday(d)])} ${+d.slice(8)}</span></h1>
      <div class="week" id="week">${days.map(x => { const n = citasDe(x).filter(c => c.estado !== 'cancelada').length; return `<button type="button" class="wd ${x === t ? 'today' : ''}" data-day="${x}" ${x === d ? 'aria-current="date"' : ''} aria-label="${esc(fechaLarga(x))}, ${n} citas">${C.DOW_1[C.weekday(x)]}<b>${+x.slice(8)}</b><span class="dots">${'<i></i>'.repeat(Math.min(3, n))}</span></button>`; }).join('')}</div>
      ${banner()}
      <div class="daysum"><b>${activas.length} ${activas.length === 1 ? 'cita' : 'citas'} · ${money(total)}</b><span>${huecos ? huecos + ' horarios libres' : 'Día lleno'}</span></div>
      <div class="tl" id="tl">${hours}${evs}${now}</div>`;
  }
  function scrollToHour() {
    if (lastScrollDay === S.day) return;
    lastScrollDay = S.day;
    const tl = $('#tl');
    if (!tl) return;
    const first = citasDe(S.day)[0], open = C.toMin(Store.settings.abre);
    const target = S.day === today() ? nowMin() - 60 : first ? C.toMin(first.start) - 30 : open;
    const y = tl.getBoundingClientRect().top + scrollY + Math.max(0, (target - Math.floor(open / 60) * 60) / 60 * 72) - 160;
    scrollTo({ top: Math.max(0, y) });
  }

  // Clientas
  function viewClientas() {
    const q = S.q.trim().toLowerCase();
    const items = list('clienta').filter(k => !q || (k.nombre + ' ' + k.telefono).toLowerCase().includes(q)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const t = today();
    return `<div class="nav"><span></span><button type="button" class="icon" data-act="nueva-clienta" aria-label="Nueva clienta">${I.plus}</button></div>
      <h1 class="big"><span>Clientas</span></h1>
      <label class="search">${I.search}<span class="sr">Buscar clienta</span><input id="q" type="search" placeholder="Buscar" value="${esc(S.q)}" autocomplete="off"></label>
      ${banner()}
      ${items.length ? `<div class="group">${items.map(k => {
        const citas = list('cita').filter(c => c.clienta === k.id && c.estado !== 'cancelada');
        const prox = citas.filter(c => c.date >= t).sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1))[0];
        return `<button type="button" class="cell" data-clienta="${esc(k.id)}"><span class="av lg" style="--c:${catColor(prox ? svcOf(prox).categoria : 'Otro')}">${esc(initials(k.nombre))}</span>
          <span class="l">${esc(k.nombre)}<small>${prox ? `Próxima: ${esc(relDay(prox.date) || C.fmtShort(prox.date))}, ${prox.start}` : `${citas.length} ${citas.length === 1 ? 'visita' : 'visitas'}`}</small></span><span class="chev">${I.chev}</span></button>`;
      }).join('')}</div>` : `<p class="empty">${q ? 'No encontré a nadie con ese nombre.' : 'Agrega a tu primera clienta con el +.'}</p>`}`;
  }

  // Servicios y promociones
  function viewServicios() {
    const promos = S.tab === 'promos' || S.seg === 'promos';
    const head = `<div class="nav"><span></span><button type="button" class="icon" data-act="${promos ? 'nueva-promo' : 'nuevo-servicio'}" aria-label="${promos ? 'Nueva promoción' : 'Nuevo servicio'}">${I.plus}</button></div>
      <h1 class="big"><span>${promos ? 'Promociones' : 'Servicios'}</span></h1>
      <div class="seg" role="tablist"><button type="button" role="tab" data-seg="servicios" aria-selected="${!promos}">Servicios</button><button type="button" role="tab" data-seg="promos" aria-selected="${promos}">Promociones</button></div>${banner()}`;
    if (promos) {
      const ps = list('promo');
      return head + `<div class="cards" id="cards">${ps.map(p => `<button type="button" class="promo" data-promo="${esc(p.id)}" style="--c:${esc(p.color)}"><small>${esc(p.etiqueta || 'Promoción')}</small><h3>${esc(p.titulo)}</h3><p>${esc(p.texto)}</p><span class="badge">Publicar ›</span></button>`).join('')}
        <button type="button" class="promo add" data-act="nueva-promo">${I.plus}<span>Nueva promoción</span></button></div>
        <div class="pdots" id="pdots">${ps.concat([0]).map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
        <p class="gh">Desliza para ver todas · toca una para publicarla en tus grupos</p>
        ${ps.length ? `<div class="group">${ps.map(p => { const n = Object.keys(p.publicado || {}).length; return `<button type="button" class="cell" data-promo="${esc(p.id)}"><span class="ico" style="background:${esc(p.color)}">%</span><span class="l">${esc(p.titulo)}<small>${n ? `Publicada en ${n} ${n === 1 ? 'grupo' : 'grupos'}` : 'Sin publicar'}</small></span><span class="chev">${I.chev}</span></button>`; }).join('')}</div>` : ''}`;
    }
    const svcs = list('servicio');
    const cats = ['Todas', ...CATS.map(c => c[0]).filter(c => svcs.some(s => s.categoria === c))];
    const shown = svcs.filter(s => S.cat === 'Todas' || s.categoria === S.cat);
    return head + `<div class="hscroll" role="group" aria-label="Categorías">${cats.map(c => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${S.cat === c}">${esc(c)}</button>`).join('')}</div>
      <div class="cards" id="cards" style="margin-top:12px">${shown.map(s => { const fotos = fotosServicio(s); return `<div class="promo${fotos.length ? ' trabajo' : ''}" style="--c:${catColor(s.categoria)};--foco:${s.categoria === 'Cejas' ? '45%' : '64%'};min-height:200px">${fotos.length ? `<img class="trabajo-fondo" src="${esc(fotos[0])}" alt="" decoding="async"><button type="button" class="trabajo-ver" data-fotos="${esc(s.id)}" aria-label="Ver fotos de ${esc(s.nombre)}">Ver fotos</button>` : ''}<small>${esc(s.categoria)}</small><h3>${esc(s.nombre)}</h3><p style="margin-bottom:46px">${esc(s.descripcion || '')}</p>
        <span class="badge" style="left:14px;right:auto">${s.duracion} min · ${money(s.precio)}</span><button type="button" class="badge" data-agendar="${esc(s.id)}" style="border:0">Agendar ›</button></div>`; }).join('') || '<p class="empty">Agrega tu primer servicio con el +.</p>'}</div>
      <div class="pdots" id="pdots">${shown.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
      <p class="gh">Todos los servicios · toca para editar</p>
      ${svcs.length ? `<div class="group">${svcs.slice().sort((a, b) => CATS.findIndex(c => c[0] === a.categoria) - CATS.findIndex(c => c[0] === b.categoria) || a.nombre.localeCompare(b.nombre, 'es')).map(s => `<button type="button" class="cell" data-servicio="${esc(s.id)}">${miniaturaServicio(s)}<span class="l">${esc(s.nombre)}<small>${esc(s.categoria)} · ${s.duracion} min</small></span><span class="p">${money(s.precio)}</span></button>`).join('')}</div>` : ''}`;
  }

  // Conexiones y ajustes
  const sw = (k, on, label) => `<button type="button" class="sw" role="switch" data-setsw="${k}" aria-checked="${!!on}" aria-label="${esc(label)}"></button>`;
  function viewMas() {
    const s = Store.settings, man = C.addDays(today(), 1);
    const recordar = citasDe(man).filter(c => c.estado !== 'cancelada');
    const grupos = list('grupo');
    return `<div class="nav"></div><h1 class="big"><span>Ajustes</span></h1>${banner()}
      <p class="gh">Calendarios</p>
      <div class="group">
        <div class="cell"><span class="ico" style="background:#4285F4">G</span><span class="l">Google Calendar<small>Cada cita tiene su botón «Agregar a Google Calendar»</small></span></div>
        <button type="button" class="cell" data-act="suscripcion"><span class="ico" style="background:#FF3B30">31</span><span class="l">Apple Calendar<small>Abre tu calendario o agrega una copia de tus citas</small></span><span class="chev">${I.chev}</span></button>
      </div>
      <p class="foot">Activa tu dispositivo una sola vez para suscribirte. Apple decide cuándo refrescar los cambios.</p>
      <p class="gh">WhatsApp</p>
      <div class="group">
        <div class="cell"><span class="ico" style="background:#25D366">✓</span><span class="l">Confirmar al agendar</span>${sw('waConfirm', s.waConfirm, 'Confirmar al agendar')}</div>
        <div class="cell"><span class="ico" style="background:#25D366">⏰</span><span class="l">Recordar un día antes</span>${sw('waRecordar', s.waRecordar, 'Recordar un día antes')}</div>
        <div class="cell"><span class="ico" style="background:#25D366">♡</span><span class="l">Gracias y pedir reseña</span>${sw('waGracias', s.waGracias, 'Gracias y pedir reseña')}</div>
        <button type="button" class="cell" data-act="recordatorios"><span class="l">Recordatorios de mañana</span><span class="v">${recordar.length}</span><span class="chev">${I.chev}</span></button>
        <button type="button" class="cell" data-act="mensajes"><span class="l">Editar mensajes</span><span class="chev">${I.chev}</span></button>
        ${Store.sync ? `<button type="button" class="cell" data-act="estado-whatsapp"><span class="l">Automatización de WhatsApp<small>Vincular tu número por código y revisar la conexión</small></span><span class="chev">${I.chev}</span></button>` : ''}
      </div>
      <div class="bubble">${esc(fill(s.tplRecordar, recordar[0] || { date: man, start: '10:00', servicio: (list('servicio')[0] || {}).id, clienta: (list('clienta')[0] || {}).id }))}</div>
      <p class="foot">Vincula el WhatsApp del salón desde Automatización de WhatsApp. Los envíos automáticos requieren consentimiento y su configuración previa.</p>
      <p class="gh">Grupos de Facebook</p>
      <div class="group">${grupos.map(g => `<button type="button" class="cell" data-grupo="${esc(g.id)}"><span class="ico" style="background:#1877F2">f</span><span class="l">${esc(g.nombre)}</span><span class="chev">${I.chev}</span></button>`).join('')}
        <button type="button" class="cell" data-act="nuevo-grupo" style="color:var(--acc)"><span class="l">Agregar grupo</span></button></div>
      <p class="foot">Para publicar, abre una promoción y toca «Publicar» en cada grupo.</p>
      <p class="gh">Apariencia</p>
      <div class="seg modo" role="tablist" aria-label="Apariencia"><button type="button" role="tab" data-modo="white" aria-selected="${s.modo !== 'dark'}">☀️ White</button><button type="button" role="tab" data-modo="dark" aria-selected="${s.modo === 'dark'}">🌙 Dark</button></div>
      <p class="gh">Tema</p>
      <div class="skins" role="radiogroup" aria-label="Tema">${SKINS.map(([k, n, c]) => `<button type="button" class="skin" role="radio" data-skin="${k}" aria-checked="${(s.skin || 'clasico') === k}"><span class="s4">${c.map(x => `<i style="background:${x}"></i>`).join('')}</span>${n}</button>`).join('')}</div>
      <p class="gh">Tu negocio</p>
      <div class="group">
        <label class="cell"><span class="l">Nombre</span><input class="in" data-setin="negocio" value="${esc(s.negocio)}" autocomplete="off"></label>
        <label class="cell"><span class="l">Abre</span><input class="in" type="time" data-setin="abre" value="${esc(s.abre)}" style="max-width:120px"></label>
        <label class="cell"><span class="l">Cierra</span><input class="in" type="time" data-setin="cierra" value="${esc(s.cierra)}" style="max-width:120px"></label>
      </div>
      <p class="foot">${Store.mode === 'cloud' ? 'Guardado en tu cuenta: lo ves igual en todos tus dispositivos.' : esc(Store.sync?.status || 'Guardado en este dispositivo.')}</p>
      ${Store.sync ? `<div class="group" style="margin-top:12px"><button type="button" class="cell" data-act="servidor"><span class="l">Sincronización<small>${Store.sync.connected ? 'Servidor conectado' : 'Conecta tu agenda con tu servidor'}</small></span><span class="chev">${I.chev}</span></button></div>` : ''}`;
  }

  // ---------- Hojas ----------
  async function sheetConexion(tipo) {
    if (tipo === 'whatsapp' && window.AgendappxWhatsApp) {
      openSheet(navSheet('Vincular WhatsApp', 'Listo') + '<div id="wa-vinculacion"></div>', 'Vincular WhatsApp', root => {
        window.AgendappxWhatsApp.montar($('#wa-vinculacion', root), {
          obtenerSesion: () => window.AgendappxCuentas?.sesion(),
        });
        root.addEventListener('click', e => { if (e.target.closest('[data-close],[data-done]')) closeSheet(); });
      });
      return;
    }
    const sync = Store.sync;
    if (tipo === 'calendario' && !sync?.connected) {
      openSheet(`${navSheet('Apple Calendar', 'Listo')}<p class="foot">Para que tus citas se actualicen, activa este dispositivo con tu enlace privado. Solo se hace una vez y no necesitas pegar claves.</p>
        <p class="foot">Si aún no tienes el enlace, solicita la activación de este celular. Mientras tanto puedes agregar una copia de las citas guardadas aquí.</p>
        <button class="cta" type="button" id="calendar-activate">Activar sincronización</button>
        <button class="cell" type="button" id="calendar-local">Agregar mis citas (.ics)</button>
        <p class="foot">La copia no recibe cambios posteriores. La suscripción privada sí refleja las citas que sincronices.</p>`, 'Apple Calendar', root => {
          root.addEventListener('click', e => {
            if (e.target.closest('[data-close],[data-done]')) closeSheet();
            if (e.target.closest('#calendar-local')) void exportarICS();
            if (e.target.closest('#calendar-activate')) sheetActivacion();
          });
        });
      return;
    }
    if (!sync?.connected) { sheetServidor(); return; }
    const titulo = tipo === 'calendario' ? 'Apple Calendar' : 'WhatsApp automático';
    const done = root => root.addEventListener('click', e => { if (e.target.closest('[data-close],[data-done]')) closeSheet(); });
    openSheet(navSheet(titulo, 'Listo') + '<p class="foot">Consultando tu servidor…</p>', titulo, done);
    const panel = card;
    try {
      if (tipo === 'calendario') {
        await sync.sync();
        if (!sync.connected) { await sheetConexion('calendario'); return; }
      }
      const data = await sync.conexiones();
      if (card !== panel || !S.sheetOpen) return;
      const mostrar = value => {
        if (tipo === 'calendario') {
          const pendientes = sync.pending.length;
          const aviso = pendientes || sync.conflicts.length ? `<p class="foot" role="status">Hay cambios pendientes de sincronizar. Apple mostrará las citas ya guardadas en el servidor. Tus cambios de este dispositivo se conservan.</p><button type="button" class="cell" id="calendar-review">Revisar cambios pendientes</button>` : '';
          openSheet(`${navSheet(titulo, 'Listo')}<p class="foot">Confirma «Suscribirse» en Apple para ver tus citas. También puedes suscribirte si la agenda está vacía.</p>${aviso}
            <a class="cta" style="text-decoration:none" href="${esc(value.calendarioUrl.replace(/^https?:/, 'webcal:'))}">Abrir Apple Calendar</a>
            <p class="foot">Los cambios se hacen en Agendappx y Apple los refresca periódicamente. La suscripción es de lectura.</p>
            <button type="button" class="cell" id="calendar-local">Agregar una copia de mis citas (.ics)</button>
            <details><summary class="cell">Google y opciones del calendario</summary>
            <p class="foot">Este enlace es privado. Quien lo tenga podrá consultar las citas.</p>
            <div class="group" style="margin-top:14px"><label class="cell"><textarea class="in" readonly aria-label="Enlace privado del calendario">${esc(value.calendarioUrl)}</textarea></label></div>
            <button class="cta" type="button" id="calendar-copy">Copiar enlace</button>
            <p class="foot">En Google Calendar, desde su sitio web: Otros calendarios → Desde URL. Pega el enlace copiado. Google decide cuándo actualizarlo.</p>
            <button class="cell danger" type="button" id="calendar-rotate">Renovar enlace privado</button>
            <p class="foot" id="calendar-status">Renovar invalida las suscripciones anteriores.</p></details>`, titulo, root => {
              done(root);
              root.addEventListener('click', async e => {
                const b = e.target.closest('button'); if (!b) return;
                if (b.id === 'calendar-review') sheetServidor();
                if (b.id === 'calendar-local') void exportarICS();
                if (b.id === 'calendar-copy') {
                  try { await navigator.clipboard.writeText(value.calendarioUrl); $('#calendar-status', root).textContent = 'Enlace copiado.'; }
                  catch { $('#calendar-status', root).textContent = 'Selecciona el enlace y cópialo manualmente.'; }
                }
                if (b.id === 'calendar-rotate') {
                  if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Toca otra vez para invalidar el enlace anterior'; return; }
                  b.disabled = true;
                  try { mostrar(await sync.renovarCalendario()); }
                  catch { $('#calendar-status', root).textContent = 'No se pudo renovar. Revisa tu conexión.'; b.disabled = false; }
                }
              });
            });
        } else {
          const wa = value.whatsapp;
          const estados = { pendiente: 'Pendientes', requiere_ventana: 'Requieren mensaje previo de la clienta', procesando: 'Procesando', aceptado: 'Aceptados por Meta', entregado: 'Entregados', leido: 'Leídos', fallido: 'Rechazados', incierto: 'Por revisar antes de reenviar' };
          openSheet(`${navSheet(titulo, 'Listo')}<p class="gh">${wa.configurado ? 'Número oficial conectado' : 'Conexión pendiente'}</p>
            <p class="foot">${esc(wa.explicacion)}</p><div class="group" style="margin-top:14px">${Object.entries(wa.conteos || {}).map(([key, count]) => `<div class="cell"><span class="l">${esc(estados[key] || key)}</span><span class="v">${esc(count)}</span></div>`).join('') || '<div class="cell">Todavía no hay envíos automáticos.</div>'}</div>
            <p class="foot">Modo sin cargos de Meta: solo mensajes de servicio dentro de las 24 horas desde el último mensaje recibido. No se envían plantillas de pago. Autoriza cada clienta desde su ficha.</p>`, titulo, done);
        }
      };
      mostrar(data);
    } catch {
      if (card === panel && S.sheetOpen) {
        if (tipo !== 'calendario') { openSheet(navSheet(titulo, 'Listo') + '<p class="foot">No se pudo consultar el servidor. Intenta de nuevo cuando tengas conexión.</p>', titulo, done); return; }
        openSheet(`${navSheet(titulo, 'Listo')}<p class="foot" role="status">No se pudo consultar el calendario en este momento. Tus citas siguen guardadas en este dispositivo.</p>
          <button type="button" class="cta" id="calendar-retry">Reintentar conexión</button>
          <button type="button" class="cell" id="calendar-review">Revisar sincronización</button>
          <button type="button" class="cell" id="calendar-local">Agregar una copia de mis citas (.ics)</button>`, titulo, root => {
            done(root);
            root.addEventListener('click', e => {
              if (e.target.closest('#calendar-retry')) void sheetConexion('calendario');
              if (e.target.closest('#calendar-review')) sheetServidor();
              if (e.target.closest('#calendar-local')) void exportarICS();
            });
          });
      }
    }
  }
  function sheetActivacion(invitacion = '') {
    const entrada = invitacion ? '' : `<label class="cell"><span class="l">Enlace privado de activación<input class="in" id="device-link" type="url" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Enlace privado de activación" placeholder="Pega tu enlace de activación"></span></label>`;
    openSheet(`${navSheet('Activar este dispositivo', 'Cancelar')}<p class="foot">Este enlace permite ver y editar la agenda del salón. Actívalo en el dispositivo donde ya usas Agendappx.</p>
      <p class="foot">Tus citas guardadas aquí se conservarán. Si hay diferencias, podrás elegir qué versión conservar.</p>${entrada}
      <button type="button" class="cta" id="device-activate">Activar y abrir Apple Calendar</button>
      <p class="foot" id="device-status" role="status"></p>`, 'Activar este dispositivo', root => {
        root.addEventListener('click', async e => {
          if (e.target.closest('[data-close],[data-done]')) { invitacion = ''; closeSheet(); return; }
          const b = e.target.closest('#device-activate'); if (!b) return;
          let enlace = invitacion;
          if (!enlace) {
            try {
              const url = new URL($('#device-link', root).value.trim());
              if (url.origin !== location.origin || !url.hash.startsWith('#activar-dispositivo=')) throw new Error('otro origen');
              enlace = url.hash.slice('#activar-dispositivo='.length);
            } catch { $('#device-status', root).textContent = 'Pega el enlace privado de activación de esta página.'; return; }
          }
          b.disabled = true;
          try {
            await Store.sync.activarDispositivo(enlace); invitacion = '';
            if (card !== root || !S.sheetOpen) return;
            closeSheet(); await sheetConexion('calendario');
          } catch (error) {
            if (card !== root || !S.sheetOpen) return;
            $('#device-status', root).textContent = error.status === 410 ? 'El enlace venció o ya se utilizó. Solicita otro enlace privado.' : 'No se pudo activar. Revisa tu conexión e intenta de nuevo.'; b.disabled = false;
          }
        });
      });
  }

  function sheetServidor() {
    const sync = Store.sync;
    const resumen = data => {
      if (data === null) return 'Registro eliminado';
      const labels = { nombre: 'Nombre', telefono: 'WhatsApp', notas: 'Notas', titulo: 'Título', texto: 'Texto', etiqueta: 'Etiqueta',
        foto: 'Foto', precio: 'Precio', duracion: 'Duración en minutos', categoria: 'Categoría', descripcion: 'Descripción', url: 'Enlace',
        date: 'Fecha', start: 'Hora', estado: 'Estado', clienta: 'Clienta', servicio: 'Servicio', negocio: 'Negocio',
        abre: 'Abre', cierra: 'Cierra', modo: 'Apariencia', skin: 'Tema', examplesOff: 'Ocultar ejemplos', waConfirm: 'Confirmar por WhatsApp',
        waRecordar: 'Recordar por WhatsApp', waGracias: 'Agradecer por WhatsApp', tplConfirm: 'Mensaje de confirmación',
        tplRecordar: 'Mensaje de recordatorio', tplGracias: 'Mensaje de agradecimiento', enviados: 'Mensajes enviados', publicado: 'Grupos publicados' };
      return Object.entries(data).filter(([key]) => labels[key]).map(([key, value]) => {
        if (['clienta', 'servicio'].includes(key)) value = byId(value)?.nombre || 'Sin registro asociado';
        else if (key === 'foto') value = fotoValida(value) ? 'Foto personalizada' : 'Sin foto';
        else if (key === 'precio') value = money(value);
        else if (key === 'modo') value = value === 'dark' ? 'Dark' : 'White';
        else if (key === 'skin') value = SKINS.find(s => s[0] === value)?.[1] || value;
        else if (typeof value === 'boolean') value = value ? 'Sí' : 'No';
        else if (value && typeof value === 'object') value = Object.keys(value).map(id => byId(id)?.nombre || ({ confirmacion: 'Confirmación', recordatorio: 'Recordatorio', gracias: 'Agradecimiento' }[id] || 'Enviado')).join(', ');
        return `${labels[key]}: ${value || 'Sin datos'}`;
      }).join('\n');
    };
    const conflicto = sync.conflicts.map(c => {
      const local = sync.pending.find(p => p.id === c.id);
      return `<p class="gh">${esc(local?.data?.nombre || local?.data?.titulo || c.data?.nombre || c.id)}</p><div class="group"><div class="cell"><span class="l">En este dispositivo<small style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(resumen(local?.data ?? null))}</small></span></div><div class="cell"><span class="l">En el servidor<small style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(resumen(c.data))}</small></span></div><button type="button" class="cell" data-conflicto="${esc(c.id)}" data-local="1">Conservar este dispositivo</button><button type="button" class="cell" data-conflicto="${esc(c.id)}">Conservar el servidor</button></div>`;
    }).join('');
    openSheet(`${navSheet('Sincronización', 'Listo')}<p class="foot" role="status" id="sync-status">${esc(sync.status)} · ${sync.pending.length} cambios pendientes.</p>
      <p class="foot">Activa este celular abriendo tu enlace privado de Agendappx. Después la sincronización se mantiene automáticamente.</p>
      ${!sync.connected ? '<button type="button" class="cta" id="sync-activate">Activar este dispositivo</button>' : ''}
      <details><summary class="cell">Configuración avanzada</summary><div class="group"><label class="cell"><span style="flex:none;white-space:nowrap">Token de acceso</span><input class="in" style="flex:1" type="password" id="sync-token" placeholder="Pega tu token" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Token de acceso"></label></div>
      <p class="foot">Usa el APP_TOKEN de tu servidor. Se guarda en este dispositivo y se envía únicamente a esta misma dirección.</p>
      <button type="button" class="cta" id="sync-connect">Conectar</button></details>
      ${sync.connected ? '<button type="button" class="cell" id="sync-now">Sincronizar ahora</button><button type="button" class="cell" id="sync-disconnect">Desconectar este dispositivo</button>' : ''}${conflicto}`,
    'Sincronización', root => {
      const feedback = message => { $('#sync-status', root).textContent = message; };
      root.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.id === 'sync-activate') { sheetActivacion(); }
        else if (b.id === 'sync-connect') {
          b.disabled = true;
          try { await sync.conectar($('#sync-token', root).value); sheetServidor(); }
          catch (error) { feedback(error.status === 401 ? 'El token no es válido.' : 'No se pudo conectar. Revisa el token y tu conexión.'); }
          finally { b.disabled = false; }
        } else if (b.id === 'sync-now') { await sync.sync(); sheetServidor(); }
        else if (b.id === 'sync-disconnect') {
          b.disabled = true;
          try { await sync.desconectar(); sheetServidor(); }
          catch { feedback('No se pudo desconectar. Revisa tu conexión e intenta otra vez.'); b.disabled = false; }
        }
        else if (b.dataset.conflicto) { sync.resolver(b.dataset.conflicto, !!b.dataset.local); sheetServidor(); }
        else if (b.hasAttribute('data-done') || b.hasAttribute('data-close')) closeSheet();
      });
    });
  }
  const sheet = $('#sheet');
  let card = $('#sheetCard');
  function openSheet(html, label, mount) {
    // Cada hoja tiene sus propios manejadores; reabrirla no repite escrituras.
    const fresh = card.cloneNode(false);
    card.replaceWith(fresh); card = fresh;
    $('#toast').hidden = true;
    card.innerHTML = '<div class="grab"></div>' + html;
    card.setAttribute('aria-label', label);
    sheet.hidden = false; S.sheetOpen = true; document.body.style.overflow = 'hidden';
    card.scrollTop = 0;
    if (mount) mount(card);
    document.dispatchEvent(new Event('ritmo:hoja'));
  }
  function closeSheet() { sheet.hidden = true; card.innerHTML = ''; S.sheetOpen = false; document.body.style.overflow = ''; document.dispatchEvent(new Event('ritmo:hoja')); }
  sheet.addEventListener('mousedown', e => { if (e.target === sheet) closeSheet(); });
  const navSheet = (title, right) => `<div class="sh-nav"><button type="button" data-close>Cancelar</button><b>${esc(title)}</b>${right ? `<button type="button" class="done" data-done>${esc(right)}</button>` : '<span style="width:64px"></span>'}</div>`;

  function sheetFotos(id) {
    const servicio = byId(id), fotos = servicio && fotosServicio(servicio);
    if (!fotos?.length) return;
    openSheet(`${navSheet('Fotos de trabajos', 'Listo')}<p class="foot">${esc(servicio.nombre)}${fotoValida(servicio.foto) ? '' : ' · Fotografías de referencia'}.</p>
      <div class="trabajo-galeria">${fotos.map((src, i) => {
        const [ancho, alto] = src === FOTOS_TRABAJOS.lifting[0] ? [720, 1280]
          : src === FOTOS_TRABAJOS.extensiones[0] ? [1280, 1113] : [1022, 1280];
        return `<img src="${esc(src)}" ${fotoValida(servicio.foto) ? '' : `width="${ancho}" height="${alto}"`} alt="${esc(servicio.nombre)}: referencia ${i + 1}" decoding="async">`;
      }).join('')}</div>
      <img class="trabajo-marca" src="./trabajos/logo-ab-beauty.jpg" alt="AB BEAUTY ROOM">`, 'Fotos de trabajos', root => {
      root.addEventListener('click', e => { if (e.target.closest('[data-close],[data-done]')) closeSheet(); });
    });
  }

  function sheetCita(opts) {
    const o = opts || {}, edit = o.id ? byId(o.id) : null;
    const svcs = list('servicio'), clis = list('clienta').slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const st = { clienta: edit ? edit.clienta : o.clienta || '', servicio: edit ? edit.servicio : o.servicio || (svcs[0] || {}).id, date: edit ? edit.date : o.date || S.day, start: edit ? edit.start : o.start || '', nueva: false };
    openSheet(`${navSheet(edit ? 'Editar cita' : 'Nueva cita', 'Guardar')}
      <p class="gh">Clienta</p>
      <div class="group"><label class="cell"><span class="sr">Clienta</span><select class="in left" id="c-cli"><option value="">Elige una clienta</option>${clis.map(k => `<option value="${esc(k.id)}" ${k.id === st.clienta ? 'selected' : ''}>${esc(k.nombre)}</option>`).join('')}<option value="__nueva">＋ Nueva clienta</option></select></label>
        <label class="cell" id="c-new1" hidden><span class="l">Nombre</span><input class="in" id="c-nombre" placeholder="Nombre y apellido" autocomplete="off"></label>
        <label class="cell" id="c-new2" hidden><span class="l">WhatsApp</span><input class="in" id="c-tel" type="tel" inputmode="tel" placeholder="55 1234 5678"></label></div>
      <p class="gh">Servicio</p>
      <div class="hscroll" id="c-svcs">${svcs.map(s => `<button type="button" class="svc" data-svc="${esc(s.id)}" aria-pressed="${s.id === st.servicio}"><b>${esc(s.nombre)}</b><span>${s.duracion} min · ${money(s.precio)}</span></button>`).join('') || '<p class="foot">Primero agrega un servicio en la pestaña Servicios.</p>'}</div>
      <p class="gh">Fecha</p>
      <div class="group"><label class="cell"><span class="l">Día</span><input class="in" type="date" id="c-date" value="${st.date}" style="max-width:170px"></label></div>
      <p class="gh" id="c-slot-h">Horarios libres</p>
      <div class="slots" id="c-slots"></div>
      <p class="gh">Notas</p>
      <div class="group"><label class="cell"><span class="sr">Notas</span><textarea class="in" id="c-notas" placeholder="Diseño, color, alergias…">${esc(edit ? edit.notas : '')}</textarea></label></div>
      ${edit ? '' : `<p class="gh">Al guardar</p><div class="group"><div class="cell"><span class="ico" style="background:#25D366">W</span><span class="l">Enviar confirmación por WhatsApp</span><button type="button" class="sw" role="switch" id="c-wa" aria-checked="${!!Store.settings.waConfirm}" aria-label="Enviar confirmación por WhatsApp"></button></div></div>`}
      <button type="button" class="cta" id="c-go" data-done></button>`, 'Nueva cita', root => {
      const slotsEl = $('#c-slots', root), go = $('#c-go', root);
      const drawSlots = () => {
        const s = byId(st.servicio), dur = s ? +s.duracion : 60;
        const free = freeSlots(st.date, dur, edit && edit.id);
        if (st.start && !free.includes(st.start)) free.unshift(st.start), free.sort();
        $('#c-slot-h', root).textContent = `${C.cap(fechaLarga(st.date))} · horarios libres`;
        slotsEl.innerHTML = free.length ? free.map(h => `<button type="button" class="slot" data-slot="${h}" aria-pressed="${h === st.start}">${h}</button>`).join('') : '<p class="foot" style="grid-column:1/-1">No hay horarios libres ese día con este servicio.</p>';
        go.textContent = `${edit ? 'Guardar cita' : 'Agendar cita'}${s ? ' · ' + money(s.precio) : ''}`;
      };
      drawSlots();
      $('#c-cli', root).addEventListener('change', e => {
        st.nueva = e.target.value === '__nueva'; st.clienta = st.nueva ? '' : e.target.value;
        $('#c-new1', root).hidden = $('#c-new2', root).hidden = !st.nueva;
        if (st.nueva) $('#c-nombre', root).focus();
      });
      $('#c-date', root).addEventListener('change', e => { if (C.isKey(e.target.value)) { st.date = e.target.value; st.start = ''; drawSlots(); } });
      root.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.svc) { st.servicio = b.dataset.svc; $$('[data-svc]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawSlots(); }
        if (b.dataset.slot) { st.start = b.dataset.slot; $$('[data-slot]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
        if (b.id === 'c-wa') b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true'));
        if (b.hasAttribute('data-close')) closeSheet();
        if (b.hasAttribute('data-done')) {
          let cliId = st.clienta;
          if (st.nueva) {
            const nombre = $('#c-nombre', root).value.trim();
            if (!nombre) { toast('Escribe el nombre de la clienta.'); $('#c-nombre', root).focus(); return; }
            cliId = newId();
            if (!save({ id: cliId, kind: 'clienta', nombre, telefono: $('#c-tel', root).value.trim(), notas: '' })) return;
          }
          if (!cliId) { toast('Elige una clienta.'); return; }
          if (!st.servicio) { toast('Elige un servicio.'); return; }
          if (!st.start) { toast('Elige un horario.'); return; }
          const cita = Object.assign(edit ? clone(edit) : { id: newId(), kind: 'cita', estado: 'pendiente', enviados: {} }, { clienta: cliId, servicio: st.servicio, date: st.date, start: st.start, notas: $('#c-notas', root).value.trim() });
          if (edit && (edit.date !== cita.date || edit.start !== cita.start)) delete cita.solicitaCambio;
          delete cita.example;
          const wa = !edit && $('#c-wa', root) && $('#c-wa', root).getAttribute('aria-checked') === 'true';
          if (!save(cita)) return;
          S.day = cita.date; S.tab = 'agenda'; lastScrollDay = null;
          closeSheet(); render();
          if (wa) sheetListo(cita.id); else toast(edit ? 'Cita guardada' : 'Cita agendada');
        }
      });
    });
  }
  function sheetListo(id) {
    const c = byId(id), k = cliOf(c), s = svcOf(c);
    openSheet(`<div class="sh-nav"><span style="width:64px"></span><b>Cita agendada</b><button type="button" class="done" data-close>Listo</button></div>
      <div class="banner" style="margin-top:4px"><p><b>${esc(s.nombre)}</b> con ${esc(k.nombre)}<br>${esc(C.cap(fechaLarga(c.date)))}, ${c.start}</p></div>
      <div class="bubble">${esc(fill(Store.settings.tplConfirm, c))}</div>
      <div style="display:grid;gap:10px;padding:16px">
        ${k.telefono ? `<a class="btn wa" style="min-height:48px" href="${esc(waLink(k.telefono, fill(Store.settings.tplConfirm, c)))}" target="_blank" rel="noopener" data-sent="${esc(c.id)}:confirmacion">Enviar confirmación por WhatsApp</a>` : '<p class="foot" style="margin:0">Agrega el WhatsApp de la clienta para enviarle la confirmación.</p>'}
        <a class="btn" style="min-height:48px" href="${esc(gcalLink(c))}" target="_blank" rel="noopener">Agregar a Google Calendar</a>
      </div>`, 'Cita agendada', root => {
      root.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
    });
  }
  function sheetDetalle(id) {
    const c = byId(id);
    if (!c) return;
    const k = cliOf(c), s = svcOf(c), tpl = Store.settings;
    const msg = (key, tplStr, label) => k.telefono ? `<a class="cell" href="${esc(waLink(k.telefono, fill(tplStr, c)))}" target="_blank" rel="noopener" data-sent="${esc(c.id)}:${key}"><span class="ico" style="background:#25D366">W</span><span class="l">${label}<small>${c.enviados && c.enviados[key] ? 'Enviado ' + esc(new Date(c.enviados[key]).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })) : 'Abre WhatsApp con el mensaje listo'}</small></span><span class="chev">${I.chev}</span></a>` : '';
    openSheet(`<div class="sh-nav"><button type="button" data-close>Cerrar</button><b>Cita</b><button type="button" class="done" data-edit>Editar</button></div>
      <div class="group" style="margin-top:6px"><div class="cell"><span class="sq" style="--c:${catColor(s.categoria)}"></span><span class="l"><b style="font-size:18px">${esc(s.nombre)}</b><small>${esc(C.cap(fechaLarga(c.date)))} · ${c.start} – ${C.fromMin(endOf(c))}</small></span><span class="p">${money(s.precio)}</span></div>
        <button type="button" class="cell" data-clienta="${esc(k.id || '')}"><span class="av lg" style="--c:${catColor(s.categoria)}">${esc(initials(k.nombre))}</span><span class="l">${esc(k.nombre)}<small>${esc(k.telefono || 'Sin teléfono')}</small></span><span class="chev">${I.chev}</span></button>
        ${c.notas ? `<div class="cell"><span class="l" style="white-space:pre-wrap">${esc(c.notas)}</span></div>` : ''}</div>
      <p class="gh">Estado</p>
      <div class="group">${ESTADOS.map(([v, n]) => `<button type="button" class="cell" data-estado="${v}"><span class="l">${n}</span>${c.estado === v ? `<span style="color:var(--acc)">${I.check}</span>` : ''}</button>`).join('')}</div>
      <p class="gh">Mensajes</p>
      <div class="group">${msg('confirmacion', tpl.tplConfirm, 'Confirmación')}${msg('recordatorio', tpl.tplRecordar, 'Recordatorio')}${msg('gracias', tpl.tplGracias, 'Gracias y reseña')}
        <a class="cell" href="${esc(gcalLink(c))}" target="_blank" rel="noopener"><span class="ico" style="background:#4285F4">G</span><span class="l">Agregar a Google Calendar</span><span class="chev">${I.chev}</span></a></div>
      <div class="group" style="margin-top:22px"><button type="button" class="cell danger" data-del style="justify-content:center">Eliminar cita</button></div>`, 'Cita', root => {
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-close],[data-edit],[data-estado],[data-del]');
        if (!b) return;
        if (b.hasAttribute('data-close')) closeSheet();
        if (b.hasAttribute('data-edit')) { closeSheet(); sheetCita({ id }); }
        if (b.dataset.estado) { const u = clone(byId(id)); u.estado = b.dataset.estado; delete u.example; if (!save(u)) return; closeSheet(); toast('Cita: ' + estadoTxt(u.estado).toLowerCase()); }
        if (b.hasAttribute('data-del')) {
          if (b.dataset.sure) { const before = clone(byId(id)); if (!remove(id)) return; closeSheet(); toast('Cita eliminada', () => save(before)); }
          else { b.dataset.sure = '1'; b.textContent = 'Toca otra vez para eliminar'; }
        }
      });
    });
  }
  function sheetClienta(id) {
    const k = id ? byId(id) : null;
    const citas = k ? list('cita').filter(c => c.clienta === k.id).sort((a, b) => (a.date + a.start < b.date + b.start ? 1 : -1)) : [];
    openSheet(`${navSheet(k ? 'Clienta' : 'Nueva clienta', 'Guardar')}
      <div class="group" style="margin-top:6px"><label class="cell"><span class="l">Nombre</span><input class="in" id="k-nombre" value="${esc(k ? k.nombre : '')}" placeholder="Nombre y apellido" autocomplete="off"></label>
        <label class="cell"><span class="l">WhatsApp</span><input class="in" id="k-tel" type="tel" inputmode="tel" value="${esc(k ? k.telefono : '')}" placeholder="55 1234 5678"></label>
        <label class="cell"><span class="sr">Notas</span><textarea class="in" id="k-notas" placeholder="Notas: tono favorito, alergias…">${esc(k ? k.notas : '')}</textarea></label>
        <div class="cell"><span class="l">Autoriza WhatsApp automático<small>La clienta aceptó recibir avisos de sus citas</small></span><button class="sw" type="button" role="switch" id="k-consent" aria-label="Autoriza WhatsApp automático" aria-checked="${k?.whatsappOptIn === true}"></button></div></div>
      ${k && k.telefono ? `<div style="padding:14px 16px 0;display:flex;gap:8px;flex-wrap:wrap"><a class="btn wa" href="${esc(waLink(k.telefono, `Hola ${k.nombre.split(' ')[0]} 💅`))}" target="_blank" rel="noopener">Escribir por WhatsApp</a><button type="button" class="btn fill" data-agendar-cli="${esc(k.id)}">Agendar cita</button></div>` : ''}
      ${citas.length ? `<p class="gh">Visitas</p><div class="group">${citas.slice(0, 20).map(c => `<button type="button" class="cell" data-cita="${esc(c.id)}"><span class="l">${esc(svcOf(c).nombre)}<small>${esc(C.fmtShort(c.date))}, ${c.start} · ${esc(estadoTxt(c.estado))}</small></span><span class="p">${money(svcOf(c).precio)}</span></button>`).join('')}</div>` : ''}
      ${k ? '<div class="group" style="margin-top:22px"><button type="button" class="cell danger" data-del style="justify-content:center">Eliminar clienta</button></div>' : ''}`, 'Clienta', root => {
      root.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.id === 'k-consent') b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true'));
        if (b.hasAttribute('data-close')) closeSheet();
        if (b.dataset.agendarCli) { closeSheet(); sheetCita({ clienta: b.dataset.agendarCli }); }
        if (b.hasAttribute('data-done')) {
          const nombre = $('#k-nombre', root).value.trim();
          if (!nombre) { toast('Escribe el nombre.'); return; }
          const it = Object.assign(k ? clone(k) : { id: newId(), kind: 'clienta' }, { nombre, telefono: $('#k-tel', root).value.trim(), notas: $('#k-notas', root).value.trim(), whatsappOptIn: $('#k-consent', root).getAttribute('aria-checked') === 'true' });
          delete it.example; if (!save(it)) return; closeSheet(); toast('Clienta guardada');
        }
        if (b.hasAttribute('data-del')) {
          if (b.dataset.sure) { const before = clone(k); if (!remove(k.id)) return; closeSheet(); toast('Clienta eliminada', () => save(before)); }
          else { b.dataset.sure = '1'; b.textContent = 'Toca otra vez para eliminar'; }
        }
      });
    });
  }
  function sheetServicio(id) {
    const s = id ? byId(id) : null;
    let foto = s?.foto, preparando = false;
    const durs = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240];
    openSheet(`${navSheet(s ? 'Servicio' : 'Nuevo servicio', 'Guardar')}
      <div class="servicio-foto">
        <img id="s-foto-preview" alt="Foto del servicio" hidden>
        <input type="file" id="s-foto" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif" aria-label="Seleccionar foto del servicio" hidden>
        <div class="servicio-foto-acciones"><button type="button" class="btn" data-subir-foto>Subir foto</button><button type="button" class="btn danger" data-quitar-foto hidden>Quitar foto</button></div>
        <p class="foot" id="s-foto-estado" role="status">Elige una foto para mostrarla en la tarjeta. Se guardará una copia optimizada.</p>
      </div>
      <div class="group" style="margin-top:6px"><label class="cell"><span class="l">Nombre</span><input class="in" id="s-nombre" value="${esc(s ? s.nombre : '')}" placeholder="Ej. Uñas acrílicas" autocomplete="off"></label>
        <label class="cell"><span class="l">Categoría</span><select class="in" id="s-cat" style="max-width:160px">${CATS.map(c => `<option ${s && s.categoria === c[0] ? 'selected' : ''}>${c[0]}</option>`).join('')}</select></label>
        <label class="cell"><span class="l">Duración</span><select class="in" id="s-dur" style="max-width:160px">${durs.map(d => `<option value="${d}" ${(s ? +s.duracion : 60) === d ? 'selected' : ''}>${d < 60 ? d + ' min' : Math.floor(d / 60) + ' h' + (d % 60 ? ' ' + (d % 60) + ' min' : '')}</option>`).join('')}</select></label>
        <label class="cell"><span class="l">Precio</span><input class="in" id="s-precio" type="number" inputmode="decimal" min="0" step="10" value="${s ? +s.precio : ''}" placeholder="$0" style="max-width:140px"></label>
        <label class="cell"><span class="sr">Descripción</span><textarea class="in" id="s-desc" placeholder="Descripción para tus clientas">${esc(s ? s.descripcion : '')}</textarea></label></div>
      ${s ? '<div class="group" style="margin-top:22px"><button type="button" class="cell danger" data-del style="justify-content:center">Eliminar servicio</button></div>' : ''}`, 'Servicio', root => {
      const archivo = $('#s-foto', root), preview = $('#s-foto-preview', root), subir = $('[data-subir-foto]', root), quitar = $('[data-quitar-foto]', root), guardar = $('[data-done]', root), estado = $('#s-foto-estado', root);
      function mostrarFoto() {
        const src = fotosServicio({ ...s, foto, nombre: $('#s-nombre', root).value, categoria: $('#s-cat', root).value })[0];
        preview.hidden = !src;
        if (src) preview.src = src; else preview.removeAttribute('src');
        subir.textContent = preparando ? 'Preparando foto…' : src ? 'Cambiar foto' : 'Subir foto';
        quitar.hidden = !src; subir.disabled = quitar.disabled = guardar.disabled = preparando;
      }
      mostrarFoto();
      $('#s-cat', root).addEventListener('change', mostrarFoto);
      archivo.addEventListener('change', async () => {
        const elegido = archivo.files?.[0]; if (!elegido) return;
        preparando = true; mostrarFoto(); estado.textContent = 'Preparando foto…';
        try {
          const lista = await prepararFoto(elegido);
          if (!root.isConnected) return;
          foto = lista; estado.textContent = 'Foto lista. Toca Guardar para conservarla.';
        } catch (e) { if (root.isConnected) estado.textContent = e.message || 'No se pudo preparar la foto.'; }
        finally { preparando = false; archivo.value = ''; if (root.isConnected) mostrarFoto(); }
      });
      root.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-close')) closeSheet();
        if (b.hasAttribute('data-subir-foto')) archivo.click();
        if (b.hasAttribute('data-quitar-foto') && !preparando) { foto = null; mostrarFoto(); estado.textContent = 'Foto quitada. Toca Guardar para conservar el cambio.'; }
        if (b.hasAttribute('data-done')) {
          if (preparando) return;
          const nombre = $('#s-nombre', root).value.trim();
          if (!nombre) { toast('Escribe el nombre del servicio.'); return; }
          const it = Object.assign(s ? clone(s) : { id: newId(), kind: 'servicio' }, { nombre, categoria: $('#s-cat', root).value, duracion: +$('#s-dur', root).value, precio: Math.max(0, +$('#s-precio', root).value || 0), descripcion: $('#s-desc', root).value.trim() });
          if (foto !== undefined) it.foto = foto;
          delete it.example; if (!save(it)) return; closeSheet(); toast('Servicio guardado');
        }
        if (b.hasAttribute('data-del')) {
          if (b.dataset.sure) { const before = clone(s); if (!remove(s.id)) return; closeSheet(); toast('Servicio eliminado', () => save(before)); }
          else { b.dataset.sure = '1'; b.textContent = 'Toca otra vez para eliminar'; }
        }
      });
    });
  }
  function promoText(p) { return `${p.titulo}\n${p.texto}\n\n📍 ${Store.settings.negocio}`; }
  function sheetPromo(id) {
    const p = id ? byId(id) : null;
    const grupos = list('grupo');
    let color = p ? p.color : PROMO_COLORS[0];
    const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); };
    openSheet(`${navSheet(p ? 'Promoción' : 'Nueva promoción', 'Guardar')}
      <div class="group" style="margin-top:6px"><label class="cell"><span class="l">Título</span><input class="in" id="p-tit" value="${esc(p ? p.titulo : '')}" placeholder="Ej. 2x1 en gelish" autocomplete="off"></label>
        <label class="cell"><span class="l">Etiqueta</span><input class="in" id="p-et" value="${esc(p ? p.etiqueta : '')}" placeholder="Ej. Solo este mes" autocomplete="off"></label>
        <label class="cell"><span class="sr">Texto</span><textarea class="in" id="p-txt" placeholder="Lo que dirá la publicación">${esc(p ? p.texto : '')}</textarea></label>
        <div class="cell"><span class="l">Color</span>${PROMO_COLORS.map(c => `<button type="button" data-color="${c}" aria-label="Color ${c}" aria-pressed="${c === color}" style="width:30px;height:30px;border-radius:50%;border:3px solid ${c === color ? 'var(--ink)' : 'transparent'};background:${c}"></button>`).join('')}</div></div>
      ${p ? `<p class="gh">Publicar en grupos · uno por uno</p>
      <div class="group">${grupos.map(g => { const when = p.publicado && p.publicado[g.id]; return `<div class="cell"><span class="ico" style="background:#1877F2">f</span><span class="l">${esc(g.nombre)}<small>${when ? '✓ Publicado ' + esc(ago(when)) : 'Pendiente'}</small></span>${g.url ? `<a class="btn ${when ? '' : 'fb'}" href="${esc(g.url)}" target="_blank" rel="noopener" data-pub="${esc(g.id)}">${when ? 'Otra vez' : 'Publicar'}</a>` : '<span class="v">Sin enlace</span>'}</div>`; }).join('') || '<div class="cell"><span class="l">Agrega tus grupos en Más › Grupos de Facebook</span></div>'}</div>
      <p class="foot">«Publicar» copia el texto y abre el grupo: pega, adjunta tu imagen y publica. Facebook no permite que las apps publiquen por ti.</p>
      <div style="padding:14px 16px 0;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" data-copy>Copiar texto</button>${Object.keys(p.publicado || {}).length ? '<button type="button" class="btn" data-reset>Reiniciar marcas</button>' : ''}</div>
      <div class="group" style="margin-top:22px"><button type="button" class="cell danger" data-del style="justify-content:center">Eliminar promoción</button></div>` : ''}`, 'Promoción', root => {
      const copy = async () => {
        const txt = p ? promoText(p) : '';
        try { await navigator.clipboard.writeText(txt); return true; } catch (e) { return false; }
      };
      root.addEventListener('click', e => {
        const b = e.target.closest('button, a');
        if (!b) return;
        if (b.dataset.color) { color = b.dataset.color; $$('[data-color]', root).forEach(x => { x.setAttribute('aria-pressed', String(x === b)); x.style.borderColor = x === b ? 'var(--ink)' : 'transparent'; }); }
        if (b.hasAttribute('data-close')) closeSheet();
        if (b.hasAttribute('data-copy')) copy().then(ok => toast(ok ? 'Texto copiado' : 'No se pudo copiar. Mantén presionado el texto para copiarlo.'));
        if (b.dataset.pub) {
          copy();
          const u = clone(byId(p.id)); u.publicado = Object.assign({}, u.publicado, { [b.dataset.pub]: new Date().toISOString() }); delete u.example;
          if (!save(u)) return;
          setTimeout(() => { closeSheet(); sheetPromo(p.id); toast('Texto copiado: pégalo en el grupo'); }, 50);
        }
        if (b.hasAttribute('data-reset')) { const u = clone(byId(p.id)); u.publicado = {}; delete u.example; if (!save(u)) return; closeSheet(); sheetPromo(p.id); }
        if (b.hasAttribute('data-done')) {
          const titulo = $('#p-tit', root).value.trim();
          if (!titulo) { toast('Escribe el título.'); return; }
          const it = Object.assign(p ? clone(p) : { id: newId(), kind: 'promo', publicado: {} }, { titulo, etiqueta: $('#p-et', root).value.trim(), texto: $('#p-txt', root).value.trim(), color });
          delete it.example; if (!save(it)) return; closeSheet(); S.tab = 'promos'; render(); toast('Promoción guardada');
        }
        if (b.hasAttribute('data-del')) {
          if (b.dataset.sure) { const before = clone(p); if (!remove(p.id)) return; closeSheet(); toast('Promoción eliminada', () => save(before)); }
          else { b.dataset.sure = '1'; b.textContent = 'Toca otra vez para eliminar'; }
        }
      });
    });
  }
  function sheetGrupo(id) {
    const g = id ? byId(id) : null;
    openSheet(`${navSheet(g ? 'Grupo' : 'Nuevo grupo', 'Guardar')}
      <div class="group" style="margin-top:6px"><label class="cell"><span class="l">Nombre</span><input class="in" id="g-nom" value="${esc(g ? g.nombre : '')}" placeholder="Ej. Ventas Coyoacán" autocomplete="off"></label>
        <label class="cell"><span class="l">Enlace</span><input class="in" id="g-url" type="url" value="${esc(g ? g.url : '')}" placeholder="facebook.com/groups/…"></label></div>
      <p class="foot">Copia el enlace desde Facebook: abre el grupo › Compartir › Copiar enlace.</p>
      ${g ? '<div class="group" style="margin-top:22px"><button type="button" class="cell danger" data-del style="justify-content:center">Eliminar grupo</button></div>' : ''}`, 'Grupo', root => {
      root.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-close')) closeSheet();
        if (b.hasAttribute('data-done')) {
          const nombre = $('#g-nom', root).value.trim();
          let url = $('#g-url', root).value.trim();
          if (!nombre) { toast('Escribe el nombre del grupo.'); return; }
          if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
          if (url && !/^https:\/\/([a-z0-9-]+\.)?(facebook\.com|fb\.com)\//i.test(url)) { toast('Usa un enlace de facebook.com'); return; }
          const it = Object.assign(g ? clone(g) : { id: newId(), kind: 'grupo' }, { nombre, url });
          delete it.example; if (!save(it)) return; closeSheet(); toast('Grupo guardado');
        }
        if (b.hasAttribute('data-del')) {
          if (b.dataset.sure) { const before = clone(g); if (!remove(g.id)) return; closeSheet(); toast('Grupo eliminado', () => save(before)); }
          else { b.dataset.sure = '1'; b.textContent = 'Toca otra vez para eliminar'; }
        }
      });
    });
  }
  function sheetMensajes() {
    const s = Store.settings;
    const ej = list('cita')[0] || { date: today(), start: '10:00', servicio: (list('servicio')[0] || {}).id, clienta: (list('clienta')[0] || {}).id };
    const row = (k, n) => `<p class="gh">${n}</p><div class="group"><label class="cell"><span class="sr">${n}</span><textarea class="in" data-tpl="${k}">${esc(s[k])}</textarea></label></div><div class="bubble" data-prev="${k}">${esc(fill(s[k], ej))}</div>`;
    openSheet(`${navSheet('Mensajes', 'Guardar')}<p class="foot" style="margin-top:4px">Puedes usar {nombre}, {servicio}, {fecha}, {hora} y {negocio}.</p>
      ${row('tplConfirm', 'Confirmación')}${row('tplRecordar', 'Recordatorio')}${row('tplGracias', 'Gracias y reseña')}`, 'Mensajes', root => {
      root.addEventListener('input', e => { const k = e.target.dataset.tpl; if (k) $(`[data-prev="${k}"]`, root).textContent = fill(e.target.value, ej); });
      root.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-close')) closeSheet();
        if (b.hasAttribute('data-done')) { const p = {}; $$('[data-tpl]', root).forEach(t => { p[t.dataset.tpl] = t.value.trim() || DEFAULTS[t.dataset.tpl]; }); if (Store.setSettings(p) === false) return; closeSheet(); toast('Mensajes guardados'); }
      });
    });
  }
  function sheetRecordatorios() {
    const man = C.addDays(today(), 1);
    const citas = citasDe(man).filter(c => c.estado !== 'cancelada');
    openSheet(`<div class="sh-nav"><span style="width:64px"></span><b>Recordatorios de mañana</b><button type="button" class="done" data-close>Listo</button></div>
      ${citas.length ? `<div class="group" style="margin-top:6px">${citas.map(c => { const k = cliOf(c), sent = c.enviados && c.enviados.recordatorio; return `<div class="cell"><span class="l">${esc(k.nombre)}<small>${c.start} · ${esc(svcOf(c).nombre)}${sent ? ' · ✓ enviado' : ''}</small></span>${k.telefono ? `<a class="btn ${sent ? '' : 'wa'}" href="${esc(waLink(k.telefono, fill(Store.settings.tplRecordar, c)))}" target="_blank" rel="noopener" data-sent="${esc(c.id)}:recordatorio">${sent ? 'Otra vez' : 'Enviar'}</a>` : '<span class="v">Sin teléfono</span>'}</div>`; }).join('')}</div>
      <p class="foot">Cada botón abre WhatsApp con el mensaje listo. Con Railway se enviarán solos a la hora que elijas.</p>` : '<p class="empty">No hay citas mañana.</p>'}`, 'Recordatorios', root => {
      root.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
    });
  }
  function sheetMes() {
    let m = C.monthStart(S.day);
    const draw = root => {
      const g0 = C.startOfWeek(m, 0), end = C.monthEnd(m), weeks = Math.ceil((C.diffDays(g0, end) + 1) / 7), t = today();
      let h = `<div class="sh-nav"><button type="button" data-m="-1" aria-label="Mes anterior">${I.left}</button><b>${C.cap(C.MES[+m.slice(5, 7) - 1])} ${m.slice(0, 4)}</b><button type="button" data-m="1" aria-label="Mes siguiente" style="transform:scaleX(-1)">${I.left}</button></div>
        <div class="week" style="padding:0 10px">${C.DOW_1.map(x => `<span style="text-align:center;color:var(--ink3);font-size:12px;font-weight:600">${x}</span>`).join('')}`;
      for (let i = 0; i < weeks * 7; i++) {
        const d = C.addDays(g0, i), n = citasDe(d).filter(c => c.estado !== 'cancelada').length;
        h += `<button type="button" class="wd ${d === t ? 'today' : ''}" data-pick="${d}" ${d === S.day ? 'aria-current="date"' : ''} style="${d.slice(0, 7) !== m.slice(0, 7) ? 'opacity:.35' : ''};padding:4px 0">${'' }<b>${+d.slice(8)}</b><span class="dots">${'<i></i>'.repeat(Math.min(3, n))}</span></button>`;
      }
      root.innerHTML = '<div class="grab"></div>' + h + '</div><div style="height:12px"></div>';
    };
    openSheet('', 'Elegir fecha', root => {
      draw(root);
      root.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.m) { m = C.addMonths(m, +b.dataset.m); draw(root); }
        if (b.dataset.pick) { S.day = b.dataset.pick; lastScrollDay = null; closeSheet(); render(); }
      };
    });
  }

  // ---------- Exportar a calendario ----------
  async function exportarICS() {
    const citas = list('cita').filter(c => c.estado !== 'cancelada');
    if (!citas.length) { toast('Aún no hay citas.'); return; }
    const items = citas.map(c => ({ id: c.id, type: 'event', title: `${svcOf(c).nombre} · ${cliOf(c).nombre}`, date: c.date, start: c.start, end: C.fromMin(Math.min(endOf(c), 1439)), allDay: false, days: 1, repeat: null, category: 'personal', location: Store.settings.negocio, notes: '' }));
    const contenido = C.toICS(items, { tz: TZ }).replace('PRODID:-//Ritmo//Agenda//ES', 'PRODID:-//Agendappx//Agenda//ES')
      .replace('X-WR-CALNAME:Ritmo', 'X-WR-CALNAME:Agendappx').replace(/^(UID:[^\r\n]+)@ritmo(?=\r?$)/gm, '$1@ritmo-belleza');
    const data = new Blob([contenido], { type: 'text/calendar;charset=utf-8' });
    const name = `Agendappx-${today()}.ics`;
    const dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads').catch(() => null) : null;
    if (dl) { try { await dl.save({ filename: name, data }); toast('Abre el archivo .ics para agregar tus citas.'); } catch (e) { if (!e || e.code !== 'declined') toast('No se pudo descargar.'); } return; }
    if (!(window.claude && typeof window.claude.use === 'function')) {
      const url = URL.createObjectURL(data), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }
    toast('Las descargas no están disponibles aquí.');
  }

  // ---------- Aviso ----------
  let toastT = null;
  function toast(msg, undo) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Deshacer</button>' : ''}`;
    el.hidden = false;
    el.onclick = e => { if (e.target.closest('button') && undo) { el.hidden = true; undo(); } };
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, undo ? 6000 : 3000);
  }

  // ---------- Eventos ----------
  document.addEventListener('click', e => {
    const sentLink = e.target.closest('[data-sent]');
    if (sentLink) {
      const [cid, key] = sentLink.dataset.sent.split(':');
      const c = byId(cid);
      if (c) { const u = clone(c); u.enviados = Object.assign({}, u.enviados, { [key]: new Date().toISOString() }); if (key === 'confirmacion' && u.estado === 'pendiente') u.estado = 'pendiente'; delete u.example; save(u); }
      return;
    }
    if (S.sheetOpen && card.contains(e.target)) {
      const b = e.target.closest('[data-cita],[data-clienta]');
      if (b && !b.closest('[data-agendar-cli]')) {
        if (b.dataset.cita && !b.closest('.sh-nav')) { closeSheet(); sheetDetalle(b.dataset.cita); }
        else if (b.dataset.clienta) { closeSheet(); sheetClienta(b.dataset.clienta); }
      }
      return;
    }
    const b = e.target.closest('[data-tab],[data-day],[data-cita],[data-clienta],[data-servicio],[data-promo],[data-grupo],[data-seg],[data-cat],[data-agendar],[data-act],[data-modo],[data-skin],[data-setsw],[data-newat],[data-fotos]');
    if (!b) return;
    const d = b.dataset;
    if (d.tab) { S.tab = d.tab; if (d.tab === 'servicios') S.seg = 'servicios'; lastScrollDay = null; scrollTo({ top: 0 }); render(); }
    else if (d.day) { S.day = d.day; lastScrollDay = null; render(); }
    else if (d.cita) sheetDetalle(d.cita);
    else if (d.clienta !== undefined && d.clienta !== '') sheetClienta(d.clienta);
    else if (d.fotos) sheetFotos(d.fotos);
    else if (d.servicio) sheetServicio(d.servicio);
    else if (d.promo) sheetPromo(d.promo);
    else if (d.grupo) sheetGrupo(d.grupo);
    else if (d.seg) { S.seg = d.seg; S.tab = d.seg === 'promos' ? 'promos' : 'servicios'; render(); }
    else if (d.cat) { S.cat = d.cat; render(); }
    else if (d.agendar) sheetCita({ servicio: d.agendar });
    else if (d.newat) sheetCita({ date: S.day, start: d.newat });
    else if (d.skin) Store.setSettings({ skin: d.skin });
    else if (d.modo && ['white', 'dark'].includes(d.modo)) Store.setSettings({ modo: d.modo });
    else if (d.setsw) Store.setSettings({ [d.setsw]: !Store.settings[d.setsw] });
    else if (d.act) ({
      mes: sheetMes, hoy: () => { S.day = today(); lastScrollDay = null; render(); },
      'nueva-clienta': () => sheetClienta(null), 'nuevo-servicio': () => sheetServicio(null), 'nueva-promo': () => sheetPromo(null), 'nuevo-grupo': () => sheetGrupo(null),
      'exportar-ics': exportarICS, recordatorios: sheetRecordatorios, mensajes: sheetMensajes, servidor: sheetServidor,
      suscripcion: () => sheetConexion('calendario'), 'estado-whatsapp': () => sheetConexion('whatsapp'),
      'borrar-ejemplos': () => { const ex = [...Store.items.values()].filter(x => x.example); for (const x of ex) if (Store.remove(x.id) === false) return; toast(`Ejemplos borrados (${ex.length})`, () => Store.putMany(ex)); },
    })[d.act]?.();
  });
  $('#fab').addEventListener('click', () => sheetCita({ date: S.day }));
  document.addEventListener('input', e => {
    if (e.target.id === 'q') { S.q = e.target.value; const pos = e.target.selectionStart; render(); const q = $('#q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }
  });
  document.addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.setin;
    if (!k) return;
    const v = e.target.value.trim();
    if ((k === 'abre' || k === 'cierra') && !C.isTime(v)) return;
    Store.setSettings({ [k]: v || DEFAULTS[k] });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.sheetOpen) closeSheet(); });
  // Puntos del carrusel
  document.addEventListener('scroll', e => {
    if (!e.target.id || e.target.id !== 'cards') return;
    const el = e.target, cards = [...el.children], dots = $$('#pdots i');
    let best = 0, bd = Infinity;
    cards.forEach((c, i) => { const dd = Math.abs(c.offsetLeft - el.scrollLeft - 16); if (dd < bd) { bd = dd; best = i; } });
    dots.forEach((x, i) => x.classList.toggle('on', i === best));
  }, true);
  // Deslizar: la semana cambia de semana; la agenda cambia de día
  let sx = 0, sy = 0, st0 = 0, onWeek = false;
  document.addEventListener('touchstart', e => { if (S.tab !== 'agenda' || S.sheetOpen) return; const p = e.touches[0]; sx = p.clientX; sy = p.clientY; st0 = Date.now(); onWeek = !!e.target.closest('#week'); }, { passive: true });
  document.addEventListener('touchend', e => {
    if (S.tab !== 'agenda' || S.sheetOpen) return;
    const p = e.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - st0 < 700) { S.day = C.addDays(S.day, (dx < 0 ? 1 : -1) * (onWeek ? 7 : 1)); lastScrollDay = null; render(); }
  }, { passive: true });
  setInterval(() => { if (document.visibilityState === 'visible' && !S.sheetOpen && S.tab === 'agenda') render(); }, 60000);

  Store.onChange(render);
  Store.init();
  if (enlaceActivacion && Store.sync) { const enlace = enlaceActivacion; enlaceActivacion = ''; sheetActivacion(enlace); }
  window.addEventListener('hashchange', () => { const enlace = tomarEnlaceActivacion(); if (enlace && Store.sync) sheetActivacion(enlace); });
})();
