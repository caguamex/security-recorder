# Ritmo: guía para continuar el trabajo

Idioma del producto, la interfaz, los comentarios y los commits: **español de México**.

## Qué es
Dos apps web sin dependencias (HTML + JS puro):

1. **Ritmo Belleza** (`belleza/`): agenda para un salón de belleza con aspecto de app de iPhone. Es el producto principal.
   Pestañas: Agenda (semana + día + botón +), Clientas, Servicios, Promos y Más (conexiones, tema y negocio). Tiene 5 temas.
   Referencia visual: `imagenes/diseno-1.png` a `diseno-5.png`, `imagenes/belleza-app-pantallas.png` y `imagenes/belleza-app-temas.png`.
2. **Ritmo** (`prototipo/`): agenda personal con captura en lenguaje natural ("Dentista mañana 5pm"). Su `core.js` (fechas, ICS y zip) lo usa también Belleza.

## Estructura
| Ruta | Contenido |
|---|---|
| `belleza/index.html`, `belleza/belleza.js` | App del salón (usa `../prototipo/core.js`; al publicar se copia junto a ella) |
| `prototipo/` | Agenda personal: `core.js`, `parser.js`, `app.js`, `index.html` |
| `dist/belleza.html`, `dist/ritmo.html` | Versiones de un solo archivo, generadas |
| `pruebas/` | Pruebas con `node --test` (62, todas pasan) |
| `herramientas/` | `empaquetar.mjs` (genera `dist/`), `capturas.mjs` y plantillas de imágenes |
| `docs/` | `BELLEZA.md` (conexiones y prompts), `PLAN.md`, `PROMPTS.md`, `ESPECIFICACION.md` |

## Comandos
```bash
node --test ritmo/pruebas/*.test.js     # pruebas
node ritmo/herramientas/empaquetar.mjs  # regenera dist/ después de cambiar código
```
Los archivos `index.html` son fragmentos (sin `<html>` ni `<head>`) porque se publicaban como página de Claude. `dist/*.html` son documentos completos que se abren con doble clic.

## Almacenamiento
- Fuera de Claude, los datos se guardan en `localStorage` (`belleza.v1.*` y `ritmo.v1.*`).
- Dentro de Claude se usa `window.claude.use('db')`. Si `window.claude` no existe, se ignora; no lo quites, pero el destino nuevo es el backend propio (abajo).
- Modelo de Belleza: un solo arreglo de objetos con `kind`: `servicio`, `clienta`, `cita`, `promo` y `grupo` en `belleza.js`. Desde el 26 de octubre, por instrucción de Antonio, Belleza inicia vacía y no genera datos de ejemplo.

## Lo que falta (en este orden)
1. **PWA publicada**: https://ritmo-belleza.antonio-t-22.workers.dev. Manifest, íconos derivados de `imagenes/icono-1024.png`, service worker y fuentes locales. Publicación generada en `dist/pwa/`. Falta verificar la instalación en un iPhone físico.
   Vista previa pública sin backend: `https://caguamex.github.io/security-recorder/`, publicada desde `gh-pages`; usa almacenamiento local separado y no solicita tokens.
2. **Backend migrado y verificado en Cloudflare Workers Free + Supabase Free** (`nube/worker.mjs` reutiliza `servidor/src/`): API con token, versiones, eliminaciones, idempotencia y sincronización incremental por cursor. `belleza/sincronizacion.js` conserva caché, cola y conflictos en `localStorage`. Supabase tiene un proyecto dedicado `ritmo-belleza` (`zkqwephmuflbuagevvxj`), esquema privado `ritmo`, rol limitado `ritmo_api`, RLS y Hyperdrive sin caché de consultas. Consulta `docs/CLOUDFLARE.md` y `docs/USO.md`. Antonio autorizó específicamente detener `Belleza` y `Datos` del proyecto de Ritmo en Railway, conservando su volumen y respaldos, sin tocar FiNeCi. No reactivar el origen como base de trabajo sin incorporar antes las escrituras del nuevo destino.
3. **WhatsApp oficial implementado; falta vincular el número del salón en Meta**: confirmación, recordatorio y gracias solo con consentimiento y dentro de una ventana gratuita abierta por la clienta. No enviar plantillas de pago bajo el presupuesto actual. Webhook firmado para las respuestas "1" (confirmar) y "2" (solicitar cambio), cola persistente y disparador programado de Cloudflare cada 5 minutos. No hay credenciales de Meta configuradas ni mensajes reales enviados. Nunca uses librerías no oficiales de WhatsApp Web.
4. **Calendario privado publicado**: enlace `.ics` revocable en `/calendario/<token>.ics`, disponible en Más, para suscribirse desde Apple y Google Calendar. Excluye teléfonos, notas, cancelaciones y datos de ejemplo.
5. **Facebook**: se mantiene el flujo de un grupo por vez (copiar texto + abrir el grupo). Facebook no permite publicar en grupos por API.

Variables de entorno del servidor: `DATABASE_URL`, `APP_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`.

Autorización de Antonio del 25 de octubre de 2026: «Entrégame todo listo, sin costo, si algo requiere costo, que esté dentro de la cuota de railway, máximo 10 Dlls». Se permite este despliegue dentro del límite de consumo compartido existente de 10 USD por ciclo, sin aumentarlo ni modificar otros proyectos. No autoriza cuotas de Meta, otros planes ni servicios fuera de Railway. Los servicios de Ritmo tienen una réplica y límites de 0.25 GB / 0.1 vCPU cada uno. No afirmar que ese presupuesto es exclusivo de Ritmo ni que equivale a una tarifa fija. Las claves se guardan fuera del repositorio en una carpeta local protegida; nunca copiarlas a Git, mensajes, capturas o URLs.

En el servidor Node original se requieren `DATABASE_URL` y `APP_TOKEN`; `PORT` identifica su puerto HTTP. El Worker actual usa `HYPERDRIVE`, `APP_TOKEN`, `PUBLIC_URL` y `TZ`; no necesita un proceso ni un puerto público permanente. Los secretos de WhatsApp, incluido `WHATSAPP_APP_SECRET`, se configuran cuando esté disponible la cuenta oficial. Mantener el bloqueo de plantillas facturables.

Verificación del backend: `npm ci --prefix ritmo/servidor` y `npm test --prefix ritmo/servidor`. Pruebas de navegador: `npm run test:navegador --prefix ritmo/servidor` (Chromium de Playwright o `BROWSER_CHANNEL=msedge`). Las pruebas usan PostgreSQL local en WebAssembly, sin servicios externos. No activar despliegues ni recursos facturables sin autorización de Antonio.

## Reglas
- Autorización del 26 de octubre: migrar a Cloudflare; crear el proyecto Supabase en «caguamex's Org» bajo Free de 0 USD; detener únicamente los dos despliegues antiguos de Ritmo en Railway, conservando volumen y respaldos. No contratar planes de pago. El dominio anterior de Railway deja de servir la app al detenerla; los datos locales de ese origen no se trasladan automáticamente entre dominios.
- Las tarjetas de servicios tienen fotografías de demostración en `belleza/trabajos/`, suministradas por Antonio. La asociación se realiza en el frontend; «Ver fotos» abre los originales. Conservar el logo original de AB BEAUTY ROOM. Ver `belleza/TRABAJOS.md` para la correspondencia.
- No cambies el diseño de las pantallas existentes sin pedirlo; compáralas con `imagenes/`.
- Cada cambio de código: corre las pruebas, regenera `dist/` y revisa la app en un navegador con ancho de teléfono (390 px).
- Nada de secretos en el repositorio.

## Fotos por servicio — 26 de octubre de 2026

Antonio autorizó agregar la opción de subir fotos. El editor permite subir, reemplazar, previsualizar y quitar una imagen por servicio, con guardado explícito y cancelación. `foto` es un campo opcional del objeto servicio: JPEG data URL optimizado (máximo 48 000 caracteres), `null` para quitar también la referencia automática, y ausente conserva las referencias anteriores. El navegador reduce a un lado mayor de hasta 800 px; la API valida tipo, tamaño y marcadores JPEG sin aumentar el límite de cuerpo de 64 KB. Se sincroniza con el protocolo existente, sin tablas, permisos, claves ni servicios nuevos. `img-src` permite blob local para decodificar el archivo temporal; nunca se cargan URLs externas de fotos. Prueba completa con dos dispositivos, sin internet y PostgreSQL local: `npm run test:fotos --prefix ritmo/servidor`. Mantener la entrega de producción sin registros de prueba.

## Confirmación de deploy — Antonio, 26 de octubre de 2026

Leer la skill portable [ritmo-confirmar-deploy](../.agents/skills/ritmo-confirmar-deploy/SKILL.md) para cada conjunto nuevo de cambios de la aplicación. Implementar, verificar y mostrar el resultado; después preguntar si Antonio quiere publicarlo. No actualizar producción sin su aprobación explícita para ese conjunto. Esta regla sustituye las autorizaciones generales anteriores de deploy y autonomía, sin repetir una aprobación de publicación que ya cubra explícitamente el alcance actual. Capturar datos desde la app no requiere deploy. Existe una copia de la skill en `~/.codex/skills/ritmo-confirmar-deploy/`; conservarla igual a la versión del repositorio al modificar esta regla.

## Aviso de actualización — preparado el 26 de octubre de 2026

Antonio autorizó implementar el aviso de nueva versión con Actualizar ahora / Más tarde. `belleza/pwa.js` detecta un service worker completamente instalado en espera y solo solicita su activación al pulsar el botón. `belleza/sw.js` acepta el mensaje `RITMO_ACTUALIZAR` desde una ventana del mismo origen; no usa skipWaiting automático durante install. Solo la pestaña que confirma se recarga. Las otras muestran aviso sin perder sus formularios. El evento `ritmo:hoja` captura los valores iniciales de las hojas; si cambian sus campos, controles o foto, se pide confirmación antes de recargar. La preparación de una foto bloquea temporalmente la actualización. Los datos locales y la cola se conservan, y la API sigue fuera de CacheStorage. Los archivos de un solo documento continúan sin registrar service worker.

Prueba: `npm run test:actualizacion --prefix ritmo/servidor`, con versiones locales, descarga fallida, posposición, formulario/cancelación, actualización sin internet, datos pendientes, dos pestañas y anchos 390/768/1440. Esta implementación queda pendiente de confirmación explícita de deploy; no confundir el push con la publicación. La primera carga desde una versión antigua puede requerir cerrar y reabrir todas las pestañas/app para instalar el código de avisos; documentado en `docs/USO.md`.
