// El empaquetador reemplaza la versión y la lista por el contenido de esta compilación.
const CACHE = 'ritmo-belleza-54cc85acff109991';
const ASSETS = ["./","./avisos-pwa.js","./belleza.js","./comunidad/actualizacion.mjs","./comunidad/cuentas-cliente.js","./comunidad/index.html","./comunidad/manifest.webmanifest","./comunidad/real.css","./comunidad/real.mjs","./core.js","./cuentas.js","./estilo-neutro-ios.css","./fuentes/Archivo-OFL.txt","./fuentes/Cormorant-Garamond-OFL.txt","./fuentes/DM-Serif-Display-OFL.txt","./fuentes/Inter-OFL.txt","./fuentes/Nunito-OFL.txt","./fuentes/fuente-0.ttf","./fuentes/fuente-1.ttf","./fuentes/fuente-10.ttf","./fuentes/fuente-11.ttf","./fuentes/fuente-12.ttf","./fuentes/fuente-13.ttf","./fuentes/fuente-14.ttf","./fuentes/fuente-15.ttf","./fuentes/fuente-16.ttf","./fuentes/fuente-17.ttf","./fuentes/fuente-18.ttf","./fuentes/fuente-19.ttf","./fuentes/fuente-2.ttf","./fuentes/fuente-20.ttf","./fuentes/fuente-21.ttf","./fuentes/fuente-22.ttf","./fuentes/fuente-23.ttf","./fuentes/fuente-24.ttf","./fuentes/fuente-25.ttf","./fuentes/fuente-26.ttf","./fuentes/fuente-27.ttf","./fuentes/fuente-28.ttf","./fuentes/fuente-29.ttf","./fuentes/fuente-3.ttf","./fuentes/fuente-30.ttf","./fuentes/fuente-31.ttf","./fuentes/fuente-32.ttf","./fuentes/fuente-33.ttf","./fuentes/fuente-34.ttf","./fuentes/fuente-35.ttf","./fuentes/fuente-36.ttf","./fuentes/fuente-4.ttf","./fuentes/fuente-5.ttf","./fuentes/fuente-6.ttf","./fuentes/fuente-7.ttf","./fuentes/fuente-8.ttf","./fuentes/fuente-9.ttf","./fuentes/fuentes.css","./iconos/icono-180.png","./iconos/icono-192.png","./iconos/icono-512.png","./index.html","./manifest.webmanifest","./negocio.js","./planes.js","./planes/index.html","./planes/inicio.js","./planes/planes.css","./plataforma/index.html","./plataforma/plataforma.css","./plataforma/plataforma.js","./pwa.js","./recuperar-acceso/index.html","./recuperar-acceso/recuperar.css","./recuperar-acceso/recuperar.js","./sincronizacion.js","./social.js","./trabajos/extensiones-1.jpg","./trabajos/extensiones-2.jpg","./trabajos/extensiones-3.jpg","./trabajos/lifting-cejas.jpg","./trabajos/logo-ab-beauty.jpg","./whatsapp-vinculacion.js"];
// Cache.addAll sigue las redirecciones de /index.html a /. Safari no admite
// devolver esa lista de redirecciones a una navegación controlada por el SW.
// Recrear solo esas respuestas conserva el documento, sus encabezados y estado.
function sinRedirecciones(response) {
  if (!response.redirected) return response;
  const headers = new Headers(response.headers);
  for (const nombre of ['content-encoding', 'content-length', 'transfer-encoding']) headers.delete(nombre);
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}
// El panel del dueño y la recuperación no guardan agenda, cola ni fotos en el dispositivo.
// Las versiones anteriores del panel no tenían aviso de actualización: si solo están
// abiertas esas páginas, una versión en espera nunca llegaba a activarse.
const sinDatosLocales = url => /^\/(plataforma|recuperar-acceso)\//.test(new URL(url).pathname);
const soloPaneles = async () => (await self.clients.matchAll({type: 'window', includeUncontrolled: true}))
  .every(c => sinDatosLocales(c.url));
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await caches.open(CACHE).then(cache => cache.addAll(ASSETS));
    if (self.registration.active && await soloPaneles()) await self.skipWaiting();
  })());
});
// Con la agenda o Comunidad abiertas, solo su botón de actualizar activa la versión en espera.
self.addEventListener('message', event => {
  if (event.data?.tipo === 'RITMO_ACTUALIZAR' && event.source?.type === 'window' &&
      new URL(event.source.url).origin === self.location.origin) event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    let anterior = false;
    for (const key of await caches.keys()) {
      if (key.startsWith('ritmo-belleza-') && key !== CACHE) { anterior = true; await caches.delete(key); }
    }
    await self.clients.claim();
    // Recarga los paneles que siguen con el código anterior, nunca la agenda ni Comunidad.
    // Sin await: esa navegación espera a que termine esta activación.
    if (anterior && await soloPaneles()) for (const c of await self.clients.matchAll({type: 'window'})) {
      if (new URL(c.url).pathname.startsWith('/plataforma/')) c.navigate(c.url).catch(() => {});
    }
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Los datos privados y las respuestas de autenticación nunca entran en CacheStorage.
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  // La recuperación siempre llega a la red, incluso con una copia antigua instalada.
  if(url.pathname.startsWith('/recuperar-acceso/'))return;
  let recurso=url.pathname.replace(new URL(self.registration.scope).pathname,'./');
  if(recurso.endsWith('/'))recurso+='index.html';
  if(['./comunidad','./planes'].includes(recurso))recurso+='/index.html';
  if(event.request.mode==='navigate'&&/^\.\/[a-z0-9][a-z0-9-]{2,59}\/?$/.test(recurso)&&!['./api','./salud','./webhooks','./calendario'].includes(recurso))recurso='./comunidad/index.html';
  if(!ASSETS.includes(recurso))return;const cacheURL=new URL(recurso,self.registration.scope).href;
  event.respondWith((async () => {
    const cached = await caches.match(cacheURL, { ignoreSearch: true });
    return sinRedirecciones(cached || await fetch(event.request));
  })());
});

self.addEventListener('push',event=>{let d={};try{d=event.data?.json()||{};}catch{}const ruta=typeof d.url==='string'&&['/comunidad/#mis-citas','/#hoy','/plataforma/'].includes(d.url)?d.url:'/';event.waitUntil(self.registration.showNotification('Agendappx',{body:d.tipo==='codigo'?'Un código de acceso no salió por WhatsApp. Ábrelo en tu panel para enviarlo.':'Hay una novedad en tu agenda. Abre la app para verla.',tag:typeof d.etiqueta==='string'?d.etiqueta:'agendappx',icon:'/iconos/icono-192.png',data:{url:ruta}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();const ruta=event.notification.data?.url;const url=new URL(['/comunidad/#mis-citas','/#hoy','/plataforma/'].includes(ruta)?ruta:'/',self.location.origin).href;event.waitUntil((async()=>{const ventanas=await self.clients.matchAll({type:'window',includeUncontrolled:true});const actual=ventanas.find(c=>new URL(c.url).origin===self.location.origin);if(actual){await actual.navigate(url);return actual.focus();}return self.clients.openWindow(url);})());});
