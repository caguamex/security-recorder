# Reparación de acceso en Safari — 29 de octubre de 2026

La publicación de las etapas estaba autorizada por Antonio. Su captura posterior muestra «Response served by service worker has redirections». Esta reparación restaura ese mismo alcance publicado; no añade funciones de negocio, migraciones, permisos, cobros ni recursos.

## Causa reproducida

Cloudflare Assets responde a `/index.html`, `/comunidad/index.html` y `/planes/index.html` con una redirección a su directorio. `cache.addAll()` sigue esa redirección y guarda una Response cuyo `redirected` es true. El worker anterior la entregaba directamente a las navegaciones. WebKit rechaza esa respuesta. Las pruebas anteriores usaban un servidor estático sin esa canonicalización y no detectaron el fallo.

Referencia primaria de WebKit: https://bugs.webkit.org/show_bug.cgi?id=190041. El diagnóstico también se reprodujo con nuestro worker anterior y redirecciones HTTP reales en una prueba local con WebKit 27.2.

## Corrección

- El service worker recrea únicamente las respuestas que conservan una redirección, con el mismo contenido, estado y encabezados de seguridad. Omite longitud/codificación de transporte porque el cuerpo ya está decodificado. Tanto la caché como el respaldo por red pasan por esa normalización.
- `/recuperar-acceso/` llega directamente al alojamiento aun con el worker anterior instalado. El botón actualiza el worker, activa la versión en espera y abre `/`. La ruta queda reservada frente al perfil público y excluida de la interceptación de caché. Usar el enlace con `/` final.
- No se anula el registro del worker ni se borran localStorage, IndexedDB, cookies, sesiones o colas. La activación mantiene la limpieza existente de versiones de recursos estáticos. No fuerza la recarga de formularios de otras pestañas.
- La recuperación no solicita códigos, permisos, números ni datos personales; requiere internet. Conserva áreas seguras de iPhone y no introduce servicios externos.

## Verificación

`safari-redirecciones-navegador.mjs` instala el comportamiento anterior con redirecciones reales, reproduce el rechazo en WebKit y después atraviesa ese mismo worker para abrir la recuperación. Comprueba el botón, activación, cookies y sesión de prueba, cola local y foto en IndexedDB idénticas, encabezados CSP, agenda/directorio/planes/perfil sin conexión, tamaños 320/390/768 y un segundo intento sin actualización pendiente. Todos los datos son locales de prueba, sin cuentas o mensajes reales.

La regresión previa de actualización conserva instalación inicial silenciosa, descarga incompleta, actualización sin internet, advertencia/cancelación de borradores y protección de otra pestaña. Cloudflare dry-run verifica el paquete en el Worker existente, con las mismas variables, permisos, secretos y límites.

La entrega al iPhone físico queda por confirmar por Antonio al abrir el enlace; no confundir una ejecución de WebKit en Windows con una prueba realizada en su teléfono.

## Publicación

Publicada desde **cfa075e9ed5d6d957d2dd43686ea50439d90d387**, Worker **e9b7ed9b-5e1f-43b0-a444-b015a8a1daf0**, dentro del cierre de las etapas autorizadas. Se conservan keep-vars, bindings, cron, secretos, planes y límites. Las siete rutas de agenda, Comunidad, Planes, worker y recuperación coinciden en SHA256 con el paquete local y responden 200 sin redirección.

WebKit y Chromium pasan la nueva regresión. Las dos pruebas anteriores de actualización (agenda y Comunidad) también pasan, incluidos borradores de otra pestaña. El navegador integrado abrió el enlace publicado, pulsó el botón y llegó a la pantalla real Hoy; después se dejó abierta la recuperación como enlace para Antonio. No se inició sesión, solicitaron códigos ni crearon datos para esta comprobación.

Enlace: https://ritmo-belleza.antonio-t-22.workers.dev/recuperar-acceso/ . No volver a aplicar migraciones ni modificar Supabase, Railway o FiNeCi para esta incidencia. PR #15 contiene esta reparación y sus pruebas.
