const boton = document.getElementById('reparar');
const estado = document.getElementById('estado');
const pausa = () => new Promise(resolve => setTimeout(resolve, 150));
// ?destino=/plataforma/ regresa al panel del dueño; cualquier otro valor abre la agenda.
const destino = new URLSearchParams(location.search).get('destino') === '/plataforma/' ? '/plataforma/' : '/';
boton.addEventListener('click', async () => {
  boton.disabled = true;
  estado.textContent = 'Descargando la corrección…';
  try {
    if (!('serviceWorker' in navigator)) {
      location.replace(destino);
      return;
    }
    const registro = await navigator.serviceWorker.getRegistration('/') ||
      await navigator.serviceWorker.register('/sw.js', {scope:'/', updateViaCache:'none'});
    const limite = Date.now() + 45000;
    let cambio = false;
    const alCambiar = () => { cambio = true; };
    navigator.serviceWorker.addEventListener('controllerchange', alCambiar);
    try {
      await registro.update();
      while (registro.installing && Date.now() < limite) await pausa();
      if (registro.installing) throw new Error('descarga');
      if (registro.waiting) {
        estado.textContent = 'Aplicando la corrección…';
        registro.waiting.postMessage({tipo:'RITMO_ACTUALIZAR'});
        while (!cambio && Date.now() < limite) await pausa();
        if (!cambio) throw new Error('activacion');
      }
      if (!registro.active || registro.active.state === 'redundant') throw new Error('sin version');
      estado.textContent = destino === '/' ? 'Listo. Abriendo tu agenda…' : 'Listo. Abriendo tu panel…';
      location.replace(destino);
    } finally {
      navigator.serviceWorker.removeEventListener('controllerchange', alCambiar);
    }
  } catch {
    estado.textContent = 'No se pudo completar. Revisa tu conexión y vuelve a pulsar el botón. Tus datos siguen guardados.';
    boton.disabled = false;
  }
});
