// Las descargas de un solo archivo siguen funcionando al abrirlas con doble clic.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {
      console.warn('No se pudo preparar el modo sin conexión. Vuelve a abrir la app con internet.');
    });
  });
}
