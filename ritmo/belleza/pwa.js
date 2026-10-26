// El aviso aparece solo cuando ya se descargó una actualización completa.
// Los archivos de un solo documento siguen abriéndose con doble clic.
(() => {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const aviso = document.getElementById('pwa-update');
  if (!aviso) return;
  const ahora = document.getElementById('pwa-update-now'), luego = document.getElementById('pwa-update-later');
  const mensaje = document.getElementById('pwa-update-message');
  let registro, solicitada = false, recargando = false, controlada = !!navigator.serviceWorker.controller;
  let activadaEnOtraPestana = false, baseFormulario = '', ultimaRevision = 0, espera;
  const hoja = () => document.getElementById('sheet');
  function formulario() {
    const root = hoja();
    if (!root || root.hidden) return '';
    return JSON.stringify([...root.querySelectorAll('input:not([type="file"]),textarea,select,[aria-pressed],[aria-checked],#s-foto-preview')].map(el =>
      [el.id, el.value ?? '', el.checked ?? false, el.getAttribute('aria-pressed'), el.getAttribute('aria-checked'), el.id === 's-foto-preview' ? el.getAttribute('src') : null]));
  }
  // Las hojas notifican después de montar sus valores iniciales, no después de editar.
  document.addEventListener('ritmo:hoja', () => { baseFormulario = formulario(); });
  function mostrar() {
    if (!solicitada && controlada && (registro?.waiting || activadaEnOtraPestana)) {
      mensaje.textContent = 'Hay una nueva versión disponible.';
      aviso.hidden = false;
    }
  }
  function restaurar(texto) {
    clearTimeout(espera); solicitada = false;
    ahora.disabled = luego.disabled = false; ahora.textContent = 'Actualizar ahora';
    mensaje.textContent = texto; aviso.hidden = false;
  }
  function recargar() {
    if (recargando) return;
    recargando = true; clearTimeout(espera); location.reload();
  }
  luego.addEventListener('click', () => { aviso.hidden = true; });
  ahora.addEventListener('click', () => {
    if (solicitada) return;
    if (hoja()?.querySelector('[data-subir-foto]:disabled')) {
      mensaje.textContent = 'Espera a que termine de prepararse la foto antes de actualizar.'; return;
    }
    if (formulario() !== baseFormulario && !window.confirm('Tienes cambios sin guardar en este formulario. Si actualizas ahora, se perderán. ¿Quieres actualizar de todos modos?')) return;
    if (activadaEnOtraPestana && !registro?.waiting) { recargar(); return; }
    if (!registro?.waiting) { restaurar('La actualización todavía no está lista. Intenta de nuevo en un momento.'); return; }
    solicitada = true; ahora.disabled = luego.disabled = true; ahora.textContent = 'Actualizando…';
    espera = setTimeout(() => restaurar('No se pudo completar la actualización. Tus datos guardados se conservan. Intenta otra vez.'), 15000);
    try { registro.waiting.postMessage({ tipo: 'RITMO_ACTUALIZAR' }); }
    catch { restaurar('No se pudo iniciar la actualización. Intenta otra vez.'); }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlada) { controlada = true; return; } // Primera instalación: no es una actualización.
    activadaEnOtraPestana = true;
    if (solicitada) recargar();
    else mostrar(); // Otra pestaña nunca provoca una recarga que pierda este formulario.
  });
  function revisar() {
    if (!registro || !navigator.onLine || document.visibilityState !== 'visible' || Date.now() - ultimaRevision < 60000) return;
    ultimaRevision = Date.now(); void registro.update().catch(() => {});
  }
  async function iniciar() {
    try {
      registro = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      const observar = worker => {
        if (!worker) return;
        worker.addEventListener('statechange', () => { if (worker.state === 'installed') mostrar(); });
      };
      observar(registro.installing);
      registro.addEventListener('updatefound', () => observar(registro.installing));
      mostrar(); revisar();
      document.addEventListener('visibilitychange', revisar);
      window.addEventListener('online', revisar);
      setInterval(revisar, 60 * 1000);
    } catch { console.warn('No se pudo preparar el modo sin conexión. Vuelve a abrir la app con internet.'); }
  }
  if (document.readyState === 'complete') void iniciar(); else window.addEventListener('load', iniciar, { once: true });
})();
