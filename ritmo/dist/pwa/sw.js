// El empaquetador reemplaza la versión y la lista por el contenido de esta compilación.
const CACHE = 'ritmo-belleza-1c4f9bad5dbf45fc';
const ASSETS = ["./","./belleza.js","./core.js","./fuentes/Archivo-OFL.txt","./fuentes/Cormorant-Garamond-OFL.txt","./fuentes/DM-Serif-Display-OFL.txt","./fuentes/Inter-OFL.txt","./fuentes/Nunito-OFL.txt","./fuentes/fuente-0.ttf","./fuentes/fuente-1.ttf","./fuentes/fuente-10.ttf","./fuentes/fuente-11.ttf","./fuentes/fuente-12.ttf","./fuentes/fuente-13.ttf","./fuentes/fuente-14.ttf","./fuentes/fuente-15.ttf","./fuentes/fuente-16.ttf","./fuentes/fuente-17.ttf","./fuentes/fuente-18.ttf","./fuentes/fuente-19.ttf","./fuentes/fuente-2.ttf","./fuentes/fuente-20.ttf","./fuentes/fuente-21.ttf","./fuentes/fuente-22.ttf","./fuentes/fuente-23.ttf","./fuentes/fuente-24.ttf","./fuentes/fuente-25.ttf","./fuentes/fuente-26.ttf","./fuentes/fuente-27.ttf","./fuentes/fuente-28.ttf","./fuentes/fuente-29.ttf","./fuentes/fuente-3.ttf","./fuentes/fuente-30.ttf","./fuentes/fuente-31.ttf","./fuentes/fuente-32.ttf","./fuentes/fuente-33.ttf","./fuentes/fuente-34.ttf","./fuentes/fuente-35.ttf","./fuentes/fuente-36.ttf","./fuentes/fuente-4.ttf","./fuentes/fuente-5.ttf","./fuentes/fuente-6.ttf","./fuentes/fuente-7.ttf","./fuentes/fuente-8.ttf","./fuentes/fuente-9.ttf","./fuentes/fuentes.css","./iconos/icono-180.png","./iconos/icono-192.png","./iconos/icono-512.png","./index.html","./manifest.webmanifest","./pwa.js","./sincronizacion.js","./trabajos/extensiones-1.jpg","./trabajos/extensiones-2.jpg","./trabajos/extensiones-3.jpg","./trabajos/lifting-cejas.jpg","./trabajos/logo-ab-beauty.jpg"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
// Solo el botón de actualizar de una página de esta aplicación activa la versión en espera.
self.addEventListener('message', event => {
  if (event.data?.tipo === 'RITMO_ACTUALIZAR' && event.source?.type === 'window' &&
      new URL(event.source.url).origin === self.location.origin) event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('ritmo-belleza-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Los datos privados y las respuestas de autenticación nunca entran en CacheStorage.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      !ASSETS.includes(url.pathname.replace(new URL(self.registration.scope).pathname, './'))) return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request, { ignoreSearch: true });
    return cached || fetch(event.request);
  })());
});
