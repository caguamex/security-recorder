// Cola persistente: los cambios se guardan antes de intentar enviarlos.
(function (root) {
  'use strict';
  function crear({ storage, fetcher, defaults = {}, cuenta = null, obtenerSesion, onChange = () => {}, uuid = () => crypto.randomUUID() }) {
    const KEY = 'belleza.v1.sync', TOKEN = 'belleza.v1.token', SESION = 'belleza.v1.sesion';
    const leer = (key, fb) => { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : fb; };
    let sesionCookie = storage.getItem(SESION) === 'si', generacionAcceso = 0;
    let state = leer(KEY, null), token = storage.getItem(TOKEN) || '', active = null, status = token || sesionCookie ? 'Pendiente de sincronizar' : 'Guardado en este dispositivo';
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
      if(cuenta){const vigente=await obtenerSesion?.();if(!vigente||vigente.usuarioId!==cuenta.usuarioId||vigente.negocioId!==cuenta.negocioId)throw Object.assign(new Error('Inicia sesión de nuevo.'),{status:401});accessToken=vigente.accessToken;
        path=path.replace(/^\/api\/(estado|objetos|conexiones|calendario)/,'/api/negocios/'+encodeURIComponent(cuenta.negocioId)+'/datos/$1');}
      const response = await fetcher(path, { ...options, credentials: 'same-origin', cache: 'no-store', headers: {
        ...(accessToken ? { 'Authorization': 'Bearer ' + accessToken } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
        signal: AbortSignal.timeout(12000) });
      const body = await response.json();
      if (!response.ok) throw Object.assign(new Error(body.error || 'No se pudo sincronizar.'), { status: response.status, current: body.current });
      return body;
    }
    function recibir(response) {
      recargar(); const next = clone(state);
      if (response.full === false) {
        const map = new Map(next.records.map(r => [r.id, r]));
        for (const record of response.records) map.set(record.id, record);
        next.records = [...map.values()];
      } else next.records = response.records;
      next.cursor = response.cursor;
      guardar(next);
    }
    function sync() {
      if (!cuenta && !token && !sesionCookie) return Promise.resolve();
      // El botón manual espera también una sincronización automática ya en curso.
      if (active) return active;
      active = sincronizar().finally(() => { active = null; });
      return active;
    }
    async function sincronizar() {
      const before = JSON.stringify(state), beforeStatus = status;
      try {
        recibir(await request('/api/estado' + (Number.isInteger(state.cursor) ? '?since=' + state.cursor : '')));
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
        recibir(await request('/api/estado' + (Number.isInteger(state.cursor) ? '?since=' + state.cursor : '')));
        status = state.conflicts.length ? 'Hay cambios por revisar' : state.pending.length ? 'Cambios pendientes de enviar' : 'Sincronizado con tu servidor';
      } catch (e) {
        if (e.status === 401 && sesionCookie && !token) { sesionCookie = false; storage.removeItem(SESION); }
        status = e.status === 401 ? 'Activa nuevamente este dispositivo; tus cambios siguen guardados aquí' : e.status && e.status < 500 ? e.message : 'Sin conexión con el servidor; cambios guardados aquí';
      } finally { if (JSON.stringify(state) !== before || status !== beforeStatus) emit(); }
    }
    return {
      get items() { return vista().items; }, get settings() { return vista().settings; },
      get status() { return status; }, get connected() { return !!cuenta || !!token || sesionCookie; },
      get pending() { return clone(state.pending); }, get conflicts() { return clone(state.conflicts); },
      put(data) { cambiar(data.id, data); }, remove(id) { cambiar(id, null); },
      setSettings(patch) { recargar(); cambiar('__settings', Object.assign({}, vista().settings, patch)); },
      async conectar(value) {
        const proposed = value.trim();
        if (!proposed) throw new Error('Escribe el token de acceso.');
        const body = await request('/api/estado', {}, proposed);
        generacionAcceso++; storage.setItem(TOKEN, proposed); token = proposed; recibir(body); await sync();
      },
      async restaurarSesion() {
        if(cuenta){await sync();return;}
        if (token) { await sync(); return; }
        const generacion = generacionAcceso;
        try {
          const data = await request('/api/dispositivos/sesion');
          if (generacion !== generacionAcceso) return;
          sesionCookie = data.conectado === true;
          if (sesionCookie) storage.setItem(SESION, 'si'); else storage.removeItem(SESION);
          if (sesionCookie) await sync(); else { status = 'Guardado en este dispositivo'; emit(); }
        } catch { /* Sin internet se conserva la sesión conocida y la cola local. */ }
      },
      async activarDispositivo(enlace) {
        generacionAcceso++;
        await request('/api/dispositivos/activar', { method: 'POST', body: JSON.stringify({ enlace }) }, '');
        sesionCookie = true; storage.setItem(SESION, 'si'); storage.removeItem(TOKEN); token = '';
        await sync(); emit();
      },
      async desconectar() {
        generacionAcceso++;
        if (sesionCookie) {
          try { await request('/api/dispositivos/sesion', { method: 'DELETE', body: '{}' }); }
          catch (error) { if (error.status !== 401) throw error; }
        }
        storage.removeItem(TOKEN); storage.removeItem(SESION); token = ''; sesionCookie = false;
        status = 'Guardado en este dispositivo'; emit();
      },
      resolver(id, conservarLocal) {
        recargar(); const conflict = state.conflicts.find(c => c.id === id); if (!conflict) return;
        const next = clone(state), pending = next.pending.find(p => p.id === id);
        next.conflicts = next.conflicts.filter(c => c.id !== id);
        next.records = next.records.filter(r => r.id !== id).concat(conflict);
        if (conservarLocal && pending) { pending.baseVersion = conflict.version; pending.mutationId = uuid(); }
        else next.pending = next.pending.filter(p => p.id !== id);
        guardar(next); emit(); void sync();
      },
      actualizar() { recargar(); token = storage.getItem(TOKEN) || ''; sesionCookie = storage.getItem(SESION) === 'si'; emit(); }, sync,
      conexiones() { return request('/api/conexiones'); },
      renovarCalendario() { return request('/api/calendario/renovar', { method: 'POST', body: '{}' }); },
    };
  }
  const api = { crear };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BellezaSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
