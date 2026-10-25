// Cola persistente: los cambios se guardan antes de intentar enviarlos.
(function (root) {
  'use strict';
  function crear({ storage, fetcher, defaults = {}, onChange = () => {}, uuid = () => crypto.randomUUID() }) {
    const KEY = 'belleza.v1.sync', TOKEN = 'belleza.v1.token';
    const leer = (key, fb) => { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : fb; };
    let state = leer(KEY, null), token = storage.getItem(TOKEN) || '', busy = false, status = token ? 'Pendiente de sincronizar' : 'Guardado en este dispositivo';
    if (!state) {
      const items = leer('belleza.v1.items', []), settings = leer('belleza.v1.settings', {});
      const records = items.map(data => ({ id: data.id, data, version: 0 }));
      if (Object.keys(settings).length) records.push({ id: '__settings', data: settings, version: 0 });
      state = { records, pending: records.map(r => ({ id: r.id, data: r.data, baseVersion: 0, mutationId: uuid() })), conflicts: [] };
      storage.setItem(KEY, JSON.stringify(state));
    }
    const clone = data => JSON.parse(JSON.stringify(data));
    const emit = () => onChange();
    function recargar() { const saved = leer(KEY, null); if (saved) state = saved; }
    function guardar(next) { storage.setItem(KEY, JSON.stringify(next)); state = next; }
    function vista() {
      const map = new Map(state.records.map(r => [r.id, r.data]));
      for (const op of state.pending) map.set(op.id, op.data);
      return { items: new Map([...map].filter(([id, data]) => id !== '__settings' && data !== null)),
        settings: Object.assign({}, defaults, map.get('__settings') || {}) };
    }
    function cambiar(id, data) {
      recargar();
      const old = state.pending.find(op => op.id === id), record = state.records.find(r => r.id === id);
      const next = clone(state);
      next.pending = next.pending.filter(op => op.id !== id);
      next.pending.push({ id, data: clone(data), baseVersion: old ? old.baseVersion : record?.version || 0, mutationId: uuid() });
      guardar(next); emit(); void sync();
    }
    async function request(path, options = {}, accessToken = token) {
      const response = await fetcher(path, { ...options, cache: 'no-store', headers: {
        'Authorization': 'Bearer ' + accessToken, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
        signal: AbortSignal.timeout(12000) });
      const body = await response.json();
      if (!response.ok) throw Object.assign(new Error(body.error || 'No se pudo sincronizar.'), { status: response.status, current: body.current });
      return body;
    }
    function recibir(records) {
      recargar(); const next = clone(state);
      next.records = records;
      guardar(next);
    }
    async function sync() {
      if (!token || busy) return;
      const before = JSON.stringify(state), beforeStatus = status;
      busy = true;
      try {
        recibir((await request('/api/estado')).records);
        // Capturar una tanda. Lo que cambie durante el envío conserva su propia operación.
        const batch = clone(state.pending.filter(op => !state.conflicts.some(c => c.id === op.id)));
        for (const op of batch) {
          // Puede haberse editado mientras se enviaba un objeto anterior.
          recargar();
          if (!state.pending.some(p => p.mutationId === op.mutationId)) continue;
          try {
            const ack = await request('/api/objetos/' + encodeURIComponent(op.id), { method: 'PUT', body: JSON.stringify(op) });
            recargar(); const next = clone(state);
            next.records = next.records.filter(r => r.id !== op.id).concat(ack);
            next.pending = next.pending.filter(p => p.mutationId !== op.mutationId);
            const newer = next.pending.find(p => p.id === op.id);
            if (newer && newer.baseVersion === op.baseVersion) newer.baseVersion = ack.version;
            guardar(next);
          } catch (e) {
            if (e.status !== 409 || !e.current) throw e;
            recargar(); const next = clone(state);
            next.conflicts = next.conflicts.filter(c => c.id !== op.id).concat(e.current);
            guardar(next);
          }
        }
        recibir((await request('/api/estado')).records);
        status = state.conflicts.length ? 'Hay cambios por revisar' : state.pending.length ? 'Cambios pendientes de enviar' : 'Sincronizado con tu servidor';
      } catch (e) {
        status = e.status === 401 ? 'Revisa tu token de acceso' : e.status && e.status < 500 ? e.message : 'Sin conexión con el servidor; cambios guardados aquí';
      } finally { busy = false; if (JSON.stringify(state) !== before || status !== beforeStatus) emit(); }
    }
    return {
      get items() { return vista().items; }, get settings() { return vista().settings; },
      get status() { return status; }, get connected() { return !!token; },
      get pending() { return clone(state.pending); }, get conflicts() { return clone(state.conflicts); },
      put(data) { cambiar(data.id, data); }, remove(id) { cambiar(id, null); },
      setSettings(patch) { recargar(); cambiar('__settings', Object.assign({}, vista().settings, patch)); },
      async conectar(value) {
        const proposed = value.trim();
        if (!proposed) throw new Error('Escribe el token de acceso.');
        const body = await request('/api/estado', {}, proposed);
        storage.setItem(TOKEN, proposed); token = proposed; recibir(body.records); await sync();
      },
      desconectar() { storage.removeItem(TOKEN); token = ''; status = 'Guardado en este dispositivo'; emit(); },
      resolver(id, conservarLocal) {
        recargar(); const conflict = state.conflicts.find(c => c.id === id); if (!conflict) return;
        const next = clone(state), pending = next.pending.find(p => p.id === id);
        next.conflicts = next.conflicts.filter(c => c.id !== id);
        next.records = next.records.filter(r => r.id !== id).concat(conflict);
        if (conservarLocal && pending) { pending.baseVersion = conflict.version; pending.mutationId = uuid(); }
        else next.pending = next.pending.filter(p => p.id !== id);
        guardar(next); emit(); void sync();
      },
      actualizar() { recargar(); token = storage.getItem(TOKEN) || ''; emit(); }, sync,
    };
  }
  const api = { crear };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BellezaSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
