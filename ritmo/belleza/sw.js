// El empaquetador reemplaza la versión y la lista por el contenido de esta compilación.
const CACHE = 'ritmo-belleza-__VERSION__';
const ASSETS = __ASSETS__;
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
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  let recurso=url.pathname.replace(new URL(self.registration.scope).pathname,'./');
  if(recurso.endsWith('/'))recurso+='index.html';
  if(['./comunidad','./planes'].includes(recurso))recurso+='/index.html';
  if(event.request.mode==='navigate'&&/^\.\/[a-z0-9][a-z0-9-]{2,59}\/?$/.test(recurso)&&!['./api','./salud','./webhooks','./calendario'].includes(recurso))recurso='./comunidad/index.html';
  if(!ASSETS.includes(recurso))return;const cacheURL=new URL(recurso,self.registration.scope).href;
  event.respondWith((async () => {
    const cached = await caches.match(cacheURL, { ignoreSearch: true });
    return cached || fetch(event.request);
  })());
});

self.addEventListener('push',event=>{let d={};try{d=event.data?.json()||{};}catch{}const ruta=typeof d.url==='string'&&['/comunidad/#mis-citas','/#hoy'].includes(d.url)?d.url:'/';event.waitUntil(self.registration.showNotification('Agendappx',{body:'Hay una novedad en tu agenda. Abre la app para verla.',tag:typeof d.etiqueta==='string'?d.etiqueta:'agendappx',icon:'/iconos/icono-192.png',data:{url:ruta}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();const ruta=event.notification.data?.url;const url=new URL(['/comunidad/#mis-citas','/#hoy'].includes(ruta)?ruta:'/',self.location.origin).href;event.waitUntil((async()=>{const ventanas=await self.clients.matchAll({type:'window',includeUncontrolled:true});const actual=ventanas.find(c=>new URL(c.url).origin===self.location.origin);if(actual){await actual.navigate(url);return actual.focus();}return self.clients.openWindow(url);})());});
