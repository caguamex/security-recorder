# Ritmo: guía para continuar el trabajo

Idioma del producto, la interfaz, los comentarios y los commits: **español de México**.

## Qué es
Dos apps web sin dependencias (HTML + JS puro):

1. **Agendappx** (antes Ritmo Belleza, `belleza/`): agenda para un salón de belleza con aspecto de app de iPhone. Es el producto principal.
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
3. **WhatsApp automático: encargo posterior a cuentas, solo envíos por dispositivo vinculado**. La instrucción del 27 de octubre de Antonio sustituye la regla antigua que prohibía librerías no oficiales. Fuente vigente: `docs/WHATSAPP-AUTOMATICO.md`, commit de Claude `dc15fe5`, secciones 0–6 completas. Usar Baileys, la librería que FiNeCi utiliza mediante Evolution API, en un servicio propio `agendappx-whatsapp`, sin tocar servicios, instancias ni claves de FiNeCi. Un proceso permanente y una réplica, cola revisada cada minuto, sesión cifrada AES-256-GCM en Supabase con WA_SESSION_KEY únicamente en Railway. No chatbot, no mensajes entrantes guardados/procesados ni confirmaciones de lectura. Cloudflare dejará de enviar con `WHATSAPP_REMITENTE=vinculado`, conservando Meta apagado. La preparación del PR #3 todavía requiere adaptarse a esta especificación: no confundir las pruebas anteriores con el cumplimiento de la sección 6. No crear servicio, migrar, desplegar, vincular ni enviar mensajes reales sin las confirmaciones correspondientes. Ver `docs/SIGUIENTE-WHATSAPP.md`.
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

## Aviso de actualización — publicado el 26 de octubre de 2026

Antonio autorizó implementar el aviso de nueva versión con Actualizar ahora / Más tarde. `belleza/pwa.js` detecta un service worker completamente instalado en espera y solo solicita su activación al pulsar el botón. `belleza/sw.js` acepta el mensaje `RITMO_ACTUALIZAR` desde una ventana del mismo origen; no usa skipWaiting automático durante install. Solo la pestaña que confirma se recarga. Las otras muestran aviso sin perder sus formularios. El evento `ritmo:hoja` captura los valores iniciales de las hojas; si cambian sus campos, controles o foto, se pide confirmación antes de recargar. La preparación de una foto bloquea temporalmente la actualización. Los datos locales y la cola se conservan, y la API sigue fuera de CacheStorage. Los archivos de un solo documento continúan sin registrar service worker.

Prueba: `npm run test:actualizacion --prefix ritmo/servidor`, con versiones locales, descarga fallida, posposición, formulario/cancelación, actualización sin internet, datos pendientes, dos pestañas y anchos 390/768/1440. Antonio confirmó el deploy y la prueba real con la carga de fotos. Se publicó primero el sistema de avisos para cargarlo una vez en el celular y después una segunda versión de prueba que revisa cada minuto mientras está visible, conservando Subir foto. La confirmación no se extiende a cambios futuros; no confundir el push con la publicación. La primera carga desde una versión antigua puede requerir cerrar y reabrir todas las pestañas/app para instalar el código de avisos; documentado en `docs/USO.md`.

## Diseño 3D de Claude — publicado el 26 de octubre de 2026

El 26 de octubre Antonio pidió aplicar el diseño de la rama `claude/es-posible-esto-tjimmb` y mostrarlo aquí antes de publicarlo. Se integra mediante merge, conservando fotos propias, sincronización, entrega vacía y aviso de actualización. Barra minimal con emojis, + central siempre visible que abre Nueva cita, Ajustes y Promociones dentro de Servicios. Servicios sigue seleccionada al abrir promociones. La apariencia White/Dark es nativa, con `modo: 'white' | 'dark'` en los ajustes sincronizados, validada por el servidor; no se usa el script de MutationObserver ni el almacenamiento independiente del prototipo. Black 3D se aplica sobre los cinco temas. Dorado conserva barra oscura y las hojas de Cristal se adaptan a Dark.

Prueba `npm run test:diseno --prefix ritmo/servidor`: cinco temas por ambos modos, secciones, Nueva cita desde todas, Promociones, persistencia, segunda cuenta de navegador conectada a la misma agenda y rechazo de modo desconocido. La vista de conversación se genera con `herramientas/vista-diseno.mjs`: reutiliza la app en un contexto aislado y en memoria, sin red, claves ni escrituras a producción; sus datos de muestra no se copian al salón. Antonio confirmó «sí, hazlo» al pedir autorización para publicar este diseño. Se desplegó la versión `ecd22d8d-7140-40b8-85a7-f2263178373d`. En producción se verificaron el aviso desde la versión anterior, White/Dark, + central, preparación de foto y sincronización con dos dispositivos; los registros de prueba se retiraron. La aprobación no se extiende a futuros conjuntos de cambios.

## Nombre Agendappx — publicado el 26 de octubre de 2026

Antonio eligió Agendappx como nuevo nombre público. Se sustituye Ritmo Belleza en el título de la página, `name`/`short_name` del manifest, el título de instalación de Apple y el nombre visible del calendario. Se conservan la URL del Worker, el `id`, scope y start_url de la app, los UID de las citas, los prefijos de almacenamiento y caché, las claves privadas, el nombre del negocio y los cinco temas. No renombrar infraestructura ni crear dominios por esta petición. Los íconos gráficos no cambian. Los dispositivos que ya la instalaron pueden conservar su etiqueta anterior según el navegador; no borrar datos para forzar el nombre. La skill ritmo-confirmar-deploy sigue aplicando a esta misma app con su nombre nuevo. Antonio confirmó «sí» al solicitar autorización para publicarlo. La versión final es `141500c2-0639-423f-a707-3b835d51ea65`; se verificaron título, metadatos Apple y application-name, manifest, actualización desde una versión anterior, caché, recarga y calendario Agendappx. No se modificaron datos del salón ni planes de servicio. La aprobación no se extiende a cambios futuros.


## Vincular WhatsApp por código — autorizado el 26 de octubre de 2026

Antonio pidió implementar en Agendappx el flujo de FiNeCi, código de ocho caracteres y mensajes desde el número vinculado, con sesión persistente y pronóstico de consumo. La integración exige cuentas, sesión vigente, Admin y MFA; no usar APP_TOKEN para controlar WhatsApp ni nombres/credenciales de FiNeCi. Evolution debe ser exclusivo de Agendappx, guardar la sesión en su esquema PostgreSQL privado y no borrar ni recrear ante errores temporales. El cron de envío es independiente del servidor que mantiene la sesión. El cambio permanece sin desplegar ni migrar hasta confirmación, y ningún mensaje real se envía sin otra confirmación. La imagen de Evolution 2.3.7 incluye Baileys rc.9 afectado por GHSA-qvv5-jq5g-4cgg: no activar esa imagen sin corregir y verificar la dependencia. Ver docs/WHATSAPP-VINCULACION.md para el estado, el costo y las verificaciones pendientes de producción.

## WhatsApp de solo envío — instrucción vigente de Antonio, 27 de octubre de 2026

Empezar después de terminar cuentas. Antonio autorizó expresamente dispositivo vinculado conociendo el riesgo de bloqueo. Esta autorización reemplaza la prohibición histórica de WhatsApp Web no oficial; no autoriza acceso a FiNeCi ni nuevos cargos fuera del presupuesto compartido de 10 USD. Proyecto aparte, un servicio permanente `agendappx-whatsapp`, una réplica y sin cron/Redis/volumen adicionales por defecto. No reutilizar el motor Evolution anterior sin adaptar cifrado y descarte de entradas.

El código de vinculación tiene ocho caracteres alfanuméricos, como el ejemplo K7QM-29XA de la especificación; no imponer solo números. Solo Admin autenticado con MFA puede vincular/desvincular. Cada salón utiliza exclusivamente su número y sesión. Rol futuro de mínimos permisos `agendappx_whatsapp`; la sesión se cifra por negocio con AES-256-GCM y nunca se registra en claro. Secretos fuera de Git.

Solo avisos de citas con consentimiento: al agendar, anticipo marcado recibido manualmente, el día de la cita, antes de llegar con dirección y cambios de horario. No respuestas automáticas, botones de Meta ni comprobantes recibidos por webhook. Entradas/historial/contactos se descartan sin persistencia, logs de contenido ni marcas de leído; se permiten únicamente eventos del protocolo necesarios para conexión, credenciales y estado de envíos propios.

Pausas 20–60 s, presencia escribiendo 2–5 s, máximo 30/h y 150/día por número, silencio 21:00–08:00 CDMX, idempotencia, invalidación al mover/cancelar, envíos inciertos sin repetición automática y freno persistente ante bloqueo. Cumplir también las omisiones de recordatorios de la sección 2 y todas las pruebas de la sección 6. Conservar las decisiones directas anteriores de Antonio: anticipo predeterminado 20 % (el documento de Claude dice 30 %) y máximo mensual 600 hasta instrucción posterior que los cambie expresamente. No liberar horarios automáticamente.

Confirmaciones separadas antes de migrar, desplegar, vincular el número y realizar el primer envío real. Informar consumo atribuible y conjunto tras siete días encendido, a partir de la fecha real de activación; la automatización de seguimiento ya está creada, sin iniciar recursos.
## Apple Calendar y activación privada — corrección del 26 de octubre de 2026

Antonio nunca recibió la clave técnica y pidió que activar/suscribir funcionara sin introducirla. Ver `docs/CALENDARIO-APPLE.md`: la rama `codex/agendappx-calendario-sin-claves` corrige el ZIP por .ics directo y prepara un enlace privado de activación de un solo uso con cookie HttpOnly. No abrir la agenda sin autorización ni poner APP_TOKEN en frontend/URLs. El enlace temporal se entrega solo al propietario y activa el contexto donde están sus citas. El sistema es exclusivo de la agenda heredada; queda deshabilitado cuando se activan cuentas y no concede roles al equipo. Antonio confirmó «Implementa» a la pregunta de publicar esta corrección y preparar la activación de su celular. Se publicó en Cloudflare como `48604e6c-0f36-4ce6-9961-a9e2740f3b6c`, desde el commit `69a6537` de esta rama (PR #4); no incluye cuentas ni WhatsApp pendientes. Se comprobó con una sesión temporal revocada y sin cambios de citas/ajustes. La activación real la confirma Antonio en su celular. Futuras publicaciones o migraciones siguen requiriendo sus confirmaciones pertinentes.

### Seguimiento de Apple Calendar después de la activación

La primera versión bloqueaba cualquier suscripción con cambios pendientes. Se reprodujo el fallo con ajustes distintos en celular/servidor y se reparó en el mismo alcance aprobado, sin resolver ni borrar conflictos. Versión publicada actual: `cc592c8f-29ce-4bb5-a8a4-1be92a5018b1`, commit de aplicación `6eb81b3` en esta rama. Apple puede mostrar las citas ya sincronizadas, con aviso de pendientes y acceso a revisarlos. Los fallos de red ofrecen reintentar o copia .ics. La sesión del celular permanece activa; no renovar enlaces para un bloqueo de datos pendientes.
