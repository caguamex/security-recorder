# Ritmo: guía para continuar el trabajo

## Revisión de Claude y Codex — 31 de octubre de 2026, pendiente de publicación

Antonio encargó a Claude reparar el QR persistente del dueño, estimar capacidad y revisar la app. Rama aislada `codex/claude-revision-agendappx` desde `ba0cdf1`; leer `docs/INFORME-CLAUDE-20261030.md`. Se reprodujo el cliente controlado por SW/SDK `61cb2a6`: `b158896` quedaba en espera y Actualizar solo refrescaba datos. La reparación incorpora actualización del panel y recuperación con destino fijo, sin cambiar Auth/SQL/RLS. Claude y Codex comprobaron 287/287 pruebas; Codex repitió la regresión residente completa en Edge y WebKit, con proxy que bloquea conexiones externas, sesión/fotos/cola conservadas y cero intentos hacia Supabase. iPhone físico pendiente. Estimaciones de capacidad son escenarios, no cupos garantizados; la descarga completa cada 30 s y el directorio sin paginar limitan crecimiento. El límite registrado de Railway es 0.5 GB/0.1 vCPU, no 0.25 GB; presupuesto compartido de 10 USD y mínimo Hobby sin duplicarlo. No se publicó ni migró nada en esta revisión, ni se enviaron códigos reales. No repetir limpieza de cuentas ni tocar FiNeCi. Las capturas ajenas regeneradas se conservan pero quedan fuera del alcance; no restaurar/borrar directorios. Falta confirmación específica de Antonio para publicar esta reparación en Cloudflare.

## Dueño solo con WhatsApp — preparación del 30 de octubre de 2026

Antonio rechazó QR y autenticadora para su acceso de dueño: WhatsApp → código → panel. Esto sustituye su requisito anterior de TOTP, sin fingir AAL2 ni desactivar MFA globalmente. Leer `docs/DUENO-SOLO-WHATSAPP.md`. Rama `codex/agendappx-dueno-solo-whatsapp`, PR #22. Archivo aditivo `20261030214547_dueno_solo_whatsapp.sql`, **aplicado como 20261030220441 / dueno_solo_whatsapp_aprobado_20261030**, no repetir. Propietario reservado + sesión admitida + prueba OTP usada propia; marca duradera al depurar códigos, API no puede insertarla directamente. Moderación del dueño usa el mismo permiso; otras cuentas conservan sus reglas. Respaldo privado verificado. Antonio confirmó migración y publicación: código **b158896**, Worker **0984ce8b-a525-497c-b1b0-7a9875f5da51**, --keep-vars. 287 pruebas y tres navegadores locales; público White/Dark, seis hashes, salud 200, panel anónimo 401 y Comunidad/registro conservados verificados sin códigos reales. Falta prueba física del dueño. No borrar sesiones reales nuevas ni ejecutar limpieza vieja, no tocar Railway ni FiNeCi.

## Dueño sin salón — preparación del 30 de octubre de 2026

Antonio sustituyó su registro de salón por acceso directo de dueño a `/plataforma/`, sin negocio ni plan. Leer `docs/ACCESO-DUENO.md`. Rama `codex/agendappx-acceso-dueno`, PR #21, desde el PR #20. SDK con sesión de plataforma independiente; servidor y SQL existentes conservan propietario reservado + sesión admitida + MFA, incluso sin membresías. 280 pruebas y tres recorridos de navegador aprobados; capturas en `imagenes/acceso-dueno/`. Antonio confirmó publicar; código **61cb2a6**, Worker **a564ac9a-2ca7-4e85-8f84-da29ae5228bc**, --keep-vars. Entrada White/Dark, seis archivos por SHA-256, panel anónimo 401, salud 200 y Comunidad/registro normal verificados. Sin migración ni cambios en Railway. La limpieza de los intentos vencidos **no se aplicó**: tres confirmaciones de Supabase caducaron. Respaldo privado verificado; revalidar inventario y completar esa confirmación antes de borrar. Si Antonio ya configuró MFA o entró, no revocar su acceso nuevo: preparar solo limpieza de registros vencidos. Conservar Auth/propiedad/WhatsApp de códigos y no tocar FiNeCi. Apertura del navegador integrado rechazada por control desactivado en Work; dar enlace directo al celular, sin afirmar que se abrió.

## Registro visual en revisión — 30 de octubre de 2026

Antonio confirmó la recepción del OTP y pidió mejorar las ventanas. Rama `codex/agendappx-registro-visual`, PR #20, documento `docs/REGISTRO-VISUAL.md`. Cabecera Agendappx, avance en los cuatro pasos, campos amplios y presentación White/Dark; conservar el flujo real de código, contraseña y MFA. 279 pruebas y recorrido Edge aprobados, capturas ficticias en `imagenes/registro-neutro/`. Antonio aprobó publicar; código `7a7d854`, Worker **fe5c32f7-90e2-4bfa-aab8-0bc472746626**, --keep-vars. Archivos por SHA-256, registro White/Dark, inicio Comunidad, salud 200 y panel 401 verificados públicamente sin códigos ni cuentas de prueba. Sin migración, cambios en Railway ni permisos nuevos. El dueño reservado ya verificó el teléfono; falta comprobar que termine los datos del salón y MFA. No repetir el reinicio ni conceder propiedad a otro registro.

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
3. **WhatsApp automático priorizado por Antonio: solo envíos por dispositivo vinculado**. La instrucción del 27 de octubre de Antonio sustituye la regla antigua que prohibía librerías no oficiales. Fuente vigente: `docs/WHATSAPP-AUTOMATICO.md`, commit de Claude `dc15fe5`, secciones 0–6 completas. Usar Baileys, la librería que FiNeCi utiliza mediante Evolution API, en un servicio propio `agendappx-whatsapp`, sin tocar servicios, instancias ni claves de FiNeCi. Un proceso permanente y una réplica, cola revisada cada minuto, sesión cifrada AES-256-GCM en Supabase con WA_SESSION_KEY únicamente en Railway. No chatbot, no mensajes entrantes guardados/procesados ni confirmaciones de lectura. Cloudflare dejará de enviar con `WHATSAPP_REMITENTE=vinculado`, conservando Meta apagado. La preparación del PR #3 todavía requiere adaptarse a esta especificación: no confundir las pruebas anteriores con el cumplimiento de la sección 6. No crear servicio, migrar, desplegar, vincular ni enviar mensajes reales sin las confirmaciones correspondientes. Ver `docs/SIGUIENTE-WHATSAPP.md`.
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

Antonio cambió la prioridad con «primero termina esta implementación de WhatsApp»: completar WhatsApp con el acceso mínimo seguro de Admin y MFA; el encargo completo de cuentas continúa después. Antonio autorizó expresamente dispositivo vinculado conociendo el riesgo de bloqueo. Esta autorización reemplaza la prohibición histórica de WhatsApp Web no oficial; no autoriza acceso a FiNeCi ni nuevos cargos fuera del presupuesto compartido de 10 USD. Proyecto aparte, un servicio permanente `agendappx-whatsapp`, una réplica y sin cron/Redis/volumen adicionales por defecto. No reutilizar el motor Evolution anterior sin adaptar cifrado y descarte de entradas.

El código de vinculación tiene ocho caracteres alfanuméricos, como el ejemplo K7QM-29XA de la especificación; no imponer solo números. Solo Admin autenticado con MFA puede vincular/desvincular. Cada salón utiliza exclusivamente su número y sesión. Rol futuro de mínimos permisos `agendappx_whatsapp`; la sesión se cifra por negocio con AES-256-GCM y nunca se registra en claro. Secretos fuera de Git.

Solo avisos de citas con consentimiento: al agendar, anticipo marcado recibido manualmente, el día de la cita, antes de llegar con dirección y cambios de horario. No respuestas automáticas, botones de Meta ni comprobantes recibidos por webhook. Entradas/historial/contactos se descartan sin persistencia, logs de contenido ni marcas de leído; se permiten únicamente eventos del protocolo necesarios para conexión, credenciales y estado de envíos propios.

Pausas 20–60 s, presencia escribiendo 2–5 s, máximo 30/h y 150/día por número, silencio 21:00–08:00 CDMX, idempotencia, invalidación al mover/cancelar, envíos inciertos sin repetición automática y freno persistente ante bloqueo. Cumplir también las omisiones de recordatorios de la sección 2 y todas las pruebas de la sección 6. Conservar las decisiones directas anteriores de Antonio: anticipo predeterminado 20 % (el documento de Claude dice 30 %) y máximo mensual 600 hasta instrucción posterior que los cambie expresamente. No liberar horarios automáticamente.

Confirmaciones separadas antes de migrar, desplegar, vincular el número y realizar el primer envío real. Informar consumo atribuible y conjunto tras siete días encendido, a partir de la fecha real de activación; la automatización de seguimiento ya está creada, sin iniciar recursos.
## Apple Calendar y activación privada — corrección del 26 de octubre de 2026

Antonio nunca recibió la clave técnica y pidió que activar/suscribir funcionara sin introducirla. Ver `docs/CALENDARIO-APPLE.md`: la rama `codex/agendappx-calendario-sin-claves` corrige el ZIP por .ics directo y prepara un enlace privado de activación de un solo uso con cookie HttpOnly. No abrir la agenda sin autorización ni poner APP_TOKEN en frontend/URLs. El enlace temporal se entrega solo al propietario y activa el contexto donde están sus citas. El sistema es exclusivo de la agenda heredada; queda deshabilitado cuando se activan cuentas y no concede roles al equipo. Antonio confirmó «Implementa» a la pregunta de publicar esta corrección y preparar la activación de su celular. Se publicó en Cloudflare como `48604e6c-0f36-4ce6-9961-a9e2740f3b6c`, desde el commit `69a6537` de esta rama (PR #4); no incluye cuentas ni WhatsApp pendientes. Se comprobó con una sesión temporal revocada y sin cambios de citas/ajustes. La activación real la confirma Antonio en su celular. Futuras publicaciones o migraciones siguen requiriendo sus confirmaciones pertinentes.

### Seguimiento de Apple Calendar después de la activación

La primera versión bloqueaba cualquier suscripción con cambios pendientes. Se reprodujo el fallo con ajustes distintos en celular/servidor y se reparó en el mismo alcance aprobado, sin resolver ni borrar conflictos. Versión publicada actual: `cc592c8f-29ce-4bb5-a8a4-1be92a5018b1`, commit de aplicación `6eb81b3` en esta rama. Apple puede mostrar las citas ya sincronizadas, con aviso de pendientes y acceso a revisarlos. Los fallos de red ofrecen reintentar o copia .ics. La sesión del celular permanece activa; no renovar enlaces para un bloqueo de datos pendientes.


## Entrega local de WhatsApp — 27 de octubre de 2026

En `codex/agendappx-whatsapp-vinculacion`, PR #3, se preparó la implementación de Baileys fijado a 7.0.0-rc13 con cifrado, custodia, cola durable, reglas/anticipos, panel y acceso mínimo Supabase firmado con TOTP. Ver `whatsapp/README.md` y `docs/WHATSAPP-PRUEBAS.md`. La prioridad nueva de Antonio reemplaza la espera por cuentas completas, pero conserva Admin con MFA y RLS. El enlace privado de arranque es temporal ante el bloqueo de Brevo: no equivale a terminar registro, bienvenida o equipo.

El esquema y el acceso por cuentas aún requieren migración y publicación aprobadas; no declarar WhatsApp disponible en la URL actual hasta comprobarlo. Solicitar aprobación explícita de migración del salón antes de ejecutarla. «Implementa para probarlo» autoriza terminar la preparación; no elimina las confirmaciones separadas ya exigidas para vincular el número y primer mensaje real. No generar códigos reales, abrir sockets con credenciales del dueño o habilitar envíos como parte de pruebas locales.

La pantalla actual conserva diseño, modos, fotos y calendario publicado. Cachés/colas de cuentas se separan del almacenamiento heredado; no mezclar ni borrar pendientes del celular durante la transición. El Worker bloquea rutas heredadas al activar cuentas y proxy WhatsApp; Meta deja de procesar cron/webhook con WHATSAPP_REMITENTE=vinculado. No aplicar las migraciones históricas de Evolution al servicio nuevo.


### Autorización y estado de publicación del 27 de octubre

Antonio aprobó respaldo, migración y publicación con «okey, hazlo»: ya se ejecutaron y verificaron. No repetir esa autorización. Worker `49605020-f7e9-4403-8a0d-8b51ab3c3743`; Railway `af30f7e3-448f-42ef-86a4-e1d563529cb5`, SUCCESS, inicio real **2026-10-27T19:11:09.551883275Z**. Ver `whatsapp/README.md` y `docs/SIGUIENTE-WHATSAPP.md` para IDs, presupuesto y seguimiento. La imagen Linux pasó salud; las siete tablas originales coinciden con el respaldo. Credencial Admin y enlace del dueño solamente en archivos privados fuera de Git; API oficial, sin endpoints públicos privilegiados ni sesiones inventadas.

Cuentas mínimas activas con TOTP; resto de cuentas pendiente. `WHATSAPP_REMITENTE=vinculado` apaga Meta. Servicio activo, **vinculación y envíos apagados**, cero sesiones reales. Pedir aprobación específica para vincular y otra para el primer mensaje con destinatario/consentimiento. No tocar FiNeCi ni aumentar límites. El seguimiento de consumo cuenta siete días desde el inicio real arriba. Pendientes locales del celular se conservan y se recuperan únicamente con el Admin migrado, sin resolver conflictos automáticamente.

## Buscador de servicios publicado — 28 de octubre de 2026

Antonio autorizó «sí, publica esto para probarlo en la app». Publicado desde `codex/agendappx-buscador-servicios`, aplicación `2a98555`, PR #6; Worker `a8277d15-0c7d-41b5-b65d-b24b4694a1ec`. Ver `docs/BUSCADOR-SERVICIOS.md`: búsqueda local por nombre/categoría sin acentos, mayúsculas ni plural, agrupación, precio, duración y nombres asignados del mismo salón. Conserva fotos, edición, carrusel y uso sin conexión. Producción comprobada sin modificar citas ni ajustes. No se activaron invitaciones ni recursos nuevos.

El acceso de otra administradora está preparado aparte en `codex/agendappx-equipo-compartido`, PR #5. Antonio aprobó enlace temporal sin correo y sesiones temporales protegidas; falta configurar Turnstile/Auth y aprobar su publicación. No confundir la aprobación de este buscador con la de aquella etapa. El código del buscador también está integrado en esa rama para no perderlo al continuarla.

## Encargo completo y envío 24 horas — instrucción vigente del 28 de octubre

El encargo completo pegado por Antonio y los dos documentos del commit f743ccf sustituyen mensajes anteriores sobre cuentas y WhatsApp. Leer CUENTAS.md y WHATSAPP-AUTOMATICO.md completos y SIGUIENTE-VERSION.md. Después Antonio respondió explícitamente «los códigos a cualquier hora, citas y promociones también»: quitar ventanas de silencio y de promociones en la siguiente versión, preservando consentimiento, topes, pausas, prioridades y recordatorios a tiempo. No es autorización de deploy ni vinculación.

El login será por WhatsApp mediante hook firmado de Supabase, con sesión de plataforma propia del 528661241483 y sesiones de salones separadas; no usar ni tocar sesiones de FiNeCi. Leer solo metadatos de contactos autorizados, nunca mensajes ni marcas de lectura. Anticipo nuevo predeterminado 30 % según especificación vigente; no alterar pagos previos. La propuesta de cuentas anónimas temporales deja de ser el destino. No publicar las funciones nuevas ni activar R2 facturable sin las aprobaciones correspondientes. Registrar lo ya publicado y preparar cada etapa en esta rama nueva y PR nuevo.

## Avisos 24 horas publicados

Autorización «publícalo» y «sigue»: cambio de horarios de los avisos existentes publicado en Cloudflare 843ab4e0-a836-4acd-9a1e-abf420770707 y Railway 9a4a3f3b-8a32-48fd-a652-2a1c09d2ab99, aplicación a17a88b, PR #7. Ver registro final de docs/SIGUIENTE-VERSION.md. Cero sesiones; vinculación y envíos reales siguen apagados. Esta publicación no completa login por WhatsApp, sesión de plataforma, equipo ni campañas. Continuar las etapas del encargo sin repetir migración ya realizada ni reiniciar la fecha original del informe de consumo. No interpretar esta aprobación como permiso de vincular un número o primer envío.


## Login por WhatsApp preparado — 28 de octubre de 2026

Antonio pidió implementar el login por WhatsApp. Se agregó el proxy OTP con el SDK real, límites durables 3/destino/15 min y 10/IP/h, cinco intentos y diez minutos, hook Standard Webhooks con texto fijo, sesión cifrada de plataforma aislada en tablas plataforma_*, prioridad de códigos y acceso de Admin con MFA. Sesiones nuevas de Auth requieren admisión del proxy para impedir que la API pública evite los límites. Se conserva la identidad existente mediante phone_change autenticado; no hay altas ni fusiones automáticas. Recuperación solo por enlace de operación registrado y UUID esperado. Correo tiene bandera independiente y sigue pendiente del SMTP real.

193 pruebas automáticas aprobadas y navegador local con SDK real/RLS: WhatsApp, correo simulado, MFA, Recepción, mismo UUID, vinculación propia, espera de veinte segundos y White/Dark a 390/768/1440. Cloudflare dry-run. Detalles, configuración, operación y límites reales en docs/LOGIN-WHATSAPP.md (desde docs, LOGIN-WHATSAPP.md). No confundir preparación con publicación: esta migración y etapa no están desplegadas, el número no está vinculado y no hubo códigos reales. Confirmaciones pendientes antes de migrar/publicar, vincular y primer envío. Los diez códigos de respaldo MFA y el resto del encargo de cuentas siguen pendientes de sus etapas propias.


## Login publicado, activación pendiente — 28 de octubre de 2026

Antonio confirmó «sí autorizo». Respaldo verificado y migración 20261028163724_login_whatsapp_aprobado_20261028 aplicada. Las 21 tablas previas conservan sus huellas exactas y el mismo Admin. Aplicación 9e3c0e8, PR #7; Worker 0679a8c3-eb04-483a-ad3b-410356aaeb6b y Railway b63a5b0a-e9dd-443b-a87f-4feff1dfc80c SUCCESS, sin modificar planes, límites, recursos ni FiNeCi. Salud, archivos y pantalla real de login verificados; detalle y respaldo en docs/LOGIN-WHATSAPP.md (desde docs, LOGIN-WHATSAPP.md).

La pantalla está publicada; los códigos aún NO funcionan: external.phone=false, Send SMS Hook pendiente y control del navegador deshabilitado en Work. Se pidió habilitarlo para completar la configuración de Supabase y cerrar altas públicas. Correo y las cuatro banderas de vinculación/envío de Railway siguen apagados. Cero sesiones vinculadas y envíos reales. Confirmaciones para vincular número y primer código siguen pendientes. Preservar el inicio real del servicio del 27 de octubre para el seguimiento semanal.


## Registro automático — preparación del 29 de octubre de 2026

Antonio pidió terminar el registro por WhatsApp e incluyó explícitamente a otras dueñas con salones propios, además del equipo por invitación. Preparación local en codex/agendappx-registro-whatsapp; leer docs/REGISTRO-WHATSAPP.md antes de publicar o activar. El registro abierto de Supabase permanece cerrado: un intermediario aislado en el mismo proyecto prepara la cuenta y nunca entrega la llave Admin a Worker/Railway/navegador. OTP nuevo ligado a la misma sesión y MFA para Admin antes de otorgar membresía. Los salones nuevos empiezan vacíos; no copiar datos del propietario. La vinculación física existente se conserva; no volver a pedir código de dispositivo ni habilitar avisos de citas por terminar el registro. No publicar, aplicar la migración nueva ni activar códigos generales sin la confirmación específica de Antonio. Brevo y el modo de entrega manual quedan pendientes fuera de este recorrido; la recuperación privada del propietario se conserva como emergencia.


## Neutro iOS — aprobado y en revisión, 29 de octubre de 2026

El diseño aprobado del PR #11 sustituye al candado 3D histórico en Agendappx. Rama nueva codex/agendappx-neutro-ios-etapa1 desde 559c3a6. Leer docs/NEUTRO-IOS-ETAPA1.md y la galería antes de continuar. Antonio pidió: selectores HH:mm sin input time, Nueva cita con fotos/pastillas/switch, Apariencia solo Mi negocio o Perfil, chips, lunes–domingo y simultáneas lado a lado. Preparación local y pruebas completas; NO desplegado. No actualizar ni la vista pública sin la confirmación nueva solicitada. No migrar ni publicar Railway: etapa de interfaz, no cambia Auth/RLS/envíos ni toca FiNeCi. Comunidad se incorpora desde los estáticos de PR #8 y sigue siendo demo; la preparación de build/deploy conserva PWA + Comunidad y secretos. Datos/funciones nuevos de Hoy, horarios, perfil público real, planes y Social siguen separados en etapas 2–4.


### Publicación de Neutro y continuación por etapas — 29 de octubre

Antonio autorizó «Publica todas las etapas». Etapa 1 publicada, Worker ccc3d5d0-1d8c-4906-9e35-ffdb3e84e40b, detalle en docs/NEUTRO-IOS-ETAPA1.md. La vista de GitHub Pages también fue actualizada y verificada. Esta aprobación cubre publicar las etapas 2–4 aprobadas conforme se completen y verifiquen; no repetir la pregunta de despliegue dentro de ese alcance. Mantener PRs independientes encadenados. Las migraciones conservan su confirmación separada previa; no aplicar SQL de nuevas etapas sin aprobación concreta. No activar cobros, envíos de citas/promociones, vinculaciones ni recursos adicionales.


## Modo negocio — etapa 2, 29 de octubre

Leer docs/NEGOCIO-ETAPA2.md. Hoy y Mi negocio funcionales, menú Crear, turnos/descanso/comida/días especiales, asignaciones de servicios y calendario Apple por cita. Migración de horarios autorizada y aplicada con respaldo verificado; versión 20261029204424, no repetirla. Stages 3–4 aún no implementadas. La publicación está autorizada por «Publica todas las etapas», pero registrar su resultado antes de decir que quedó publicada. Mantener cobros, nuevos dispositivos y envíos automáticos apagados.


### Etapa 2 publicada

PR #13, aplicación 2e8ee48, Worker ffdfd164-e182-43d0-b50b-b9569412925c y Railway 4d3e6c3d-6d04-4326-b626-05d7e0bb347e SUCCESS. Ver docs/NEGOCIO-ETAPA2.md. Horarios migrados y siete tablas previas idénticas al respaldo. Código real de Hoy y Mi negocio publicado; Planes y Comunidad real pendientes de etapas 3–4. Se conserva código WhatsApp habilitado, vinculación y envíos automáticos apagados. La nueva rama de etapa 3 parte de esta rama.


## Planes — etapa 3 preparada

Rama codex/agendappx-planes-etapa3 desde aaf60f4, PR nuevo por etapa. Leer docs/PLANES-ETAPA3.md. Precios aprobados, 30 días exactos para nuevas altas, límites en SQL, contador real de fundadoras y Mi plan privado. Cuentas existentes conservadas como legado. No hay cobros, tarjeta ni pasarela. La publicación de la etapa está autorizada, pero la migración de planes requiere respuesta específica a la pregunta pendiente; no reutilizar la autorización de horarios. La etapa 4 aún falta.


### Planes — etapa 3 publicada

Autorización específica «Sí, respalda y aplica Planes». Migración 20261029221042 registrada; siete tablas originales idénticas al respaldo. Worker 4a622a3e-ca59-4864-843f-d154acf77105, aplicación ccf4775, PR #14. Ver docs/PLANES-ETAPA3.md. Acceso existente legado sin nueva caducidad; nuevos salones treinta días. No hay cobros ni cambios de Railway. Etapa 4 continúa preparada por separado y exige su propia autorización de migración.


## Explorar y Social — etapa 4 preparada

Rama codex/agendappx-explorar-social-etapa4 sobre Planes / PR #14. Leer docs/EXPLORAR-SOCIAL-ETAPA4.md, EXPLORAR.md y SOCIAL.md. Directorio, reservas solicitadas, registro de clientas con WhatsApp, publicaciones, reseñas, interacciones, moderación y avisos PWA voluntarios preparados y verificados localmente. No son demostraciones dentro del código nuevo, pero todavía NO están publicados ni migrados en producción. La migración 20261029233337 requiere su propia confirmación y respaldo; las autorizaciones de horarios y Planes no la cubren. Publicación incluida en «Publica todas las etapas». No activar cobros, envíos/vinculación de WhatsApp, servicios nuevos o FiNeCi. Los negocios existentes quedan ocultos hasta que Admin publique su perfil. No colocar VAPID privadas ni datos de prueba en Git.


### Migración de etapa 4 aplicada

Antonio autorizó «Sí, respalda y aplica Explorar/Social». Versión real 20261029233337, aplicada mediante conector oficial. Diez tablas existentes idénticas al respaldo; quince tablas nuevas cerradas, un moderador aprobado y cero datos de prueba. Ver docs/EXPLORAR-SOCIAL-ETAPA4.md. No volver a aplicar ni pedir esa autorización. La publicación está autorizada y todavía falta registrar su resultado. VAPID solo en secretos/archivo privado.


### Todas las etapas publicadas — 29 de octubre de 2026

Etapas 1–4 publicadas, PRs #12, #13, #14 y #15 encadenados. Última aplicación ef8abee, Worker 36421810-c292-476b-8921-4f97578f1e48; migración final 20261029233337. Leer el cierre de docs/EXPLORAR-SOCIAL-ETAPA4.md. Diez tablas originales intactas y cero ejemplos en producción. Directorio real vacío hasta que Admin active su perfil; no activarlo por cuenta del propietario. Avisos PWA requieren permiso voluntario del dispositivo, sin suscripciones de prueba. Registro WhatsApp sigue habilitado; citas/promociones y nuevas vinculaciones siguen apagadas. No repetir migraciones, activar mensajes/cobros ni tocar FiNeCi/Railway al retomar.

### Reparación posterior de Safari

Leer docs/RECUPERACION-SAFARI.md. La canonicalización de index.html dejaba Response.redirected=true en caché y Safari rechazaba la navegación. El worker normaliza esas respuestas y /recuperar-acceso/ actualiza la copia instalada conservando sesión, cookies, IndexedDB y cola pendiente. La prueba nueva reproduce el fallo anterior con WebKit y redirecciones HTTP reales. No indicar borrar datos de Safari ni repetir migraciones para resolver este problema.

Reparación publicada desde cfa075e, Worker e9b7ed9b-5e1f-43b0-a444-b015a8a1daf0, PR #15. Verificados hash y 200 sin redirección de siete rutas; botón publicado abre Hoy. WebKit/Chromium y ambas regresiones de actualización aprobados. Entregar /recuperar-acceso/ con barra final a dispositivos con la copia anterior; falta confirmación física del iPhone de Antonio.


## Contraseña y equipo — revisión del 30 de octubre de 2026

Antonio pidió revisar y publicar la implementación de Claude en `claude/agendappx-registro-contrasena`, desde PR #16, sin rehacerla. Leer `docs/CONTRASENA-EQUIPO.md` completo. Copia de revisión `codex/agendappx-revision-contrasena`, desde `28f6cc3`; no incorpora los cambios locales incompletos de la otra copia de PR #16.

256 pruebas y Edge aprobados. Se corrigió un fallo real del restablecimiento: cuentas con MFA deben completar AAL2 antes de guardar la contraseña nueva; la prueba ahora exige esa regla de Supabase. El dominio interno `agendappx.invalid` pasó validación Admin sin crear usuarios. Email y Phone ya están activos; Auth mínimo seis, app mínimo ocho, Free conservado. No se cambiaron ajustes ni datos de producción.

Publicado con autorización «sí publica todo lo que esté listo»: migración real 20261030160000 / usuarios_contrasena, intermediario versión 3 y Worker 867d6000-8926-440f-b836-b79bf1eda4a7, aplicación 54081f1 / PR #17 sobre #16. Respaldo privado de once tablas verificado; 44 de 46 tablas previas idénticas y las dos restantes solo son la conexión viva de plataforma. Once conjuntos del salón y 23 objetos intactos; tres tablas nuevas cerradas y vacías. Página real, hashes, rechazos sin autorización y Edge a 390/768/1440 verificados sin crear usuarios ni enviar códigos. Mantener AGENDAPPX_INICIO_PUBLICO apagado: no se autorizó ese cambio. No tocar FiNeCi/Railway ni activar envíos. Pendiente únicamente la prueba física guiada de registro, contraseña, restablecimiento y equipo con Antonio. Para su cuenta existente, entrar con código y crear usuario/contraseña después; no registrarlo como otro salón.


## Panel de plataforma y códigos manuales — revisión detenida, 30 de octubre de 2026

Antonio pidió tomar solo `7b0f9e9` y `480b852` de Claude encima del PR #17, en rama/PR nuevos, sin rehacer. Rama `codex/agendappx-panel-codigos-manuales` desde `f5ce2d1`; commits integrados `26c7539` y `b3e5747`. Se conserva el MFA de `54081f1`; dist se regeneró. Leer `docs/PANEL-PLATAFORMA.md` completo.

265 pruebas originales y ambos navegadores solicitados pasan, pero una prueba de revisión adicional reproduce un fallo: el aviso push se marca antes de enviarse y, si el proveedor responde 503, ya no se reintenta. `revision-avisos-codigos.test.mjs` queda en rojo como evidencia. También se observó que activo:true del panel depende de la llave HMAC, no de la bandera manual de Railway. Por «Si algo falla, detente y dime», no corregir ni publicar por inercia: informar y esperar la siguiente instrucción.

No hubo respaldo ni cambios en producción en esta etapa. Pendientes confirmaciones por separado para respaldo, migración 20261030180000 (misma sesión con ritmo.plataforma_admin igual a MIGRACION_USUARIO_ID), migración 20261030190000, Worker --keep-vars y Railway con WA_CODIGOS_RESPALDO_MANUAL=true. No desconectar códigos, pausar salones reales, activar citas/promociones/vinculaciones ni tocar FiNeCi. El PR #17 sigue publicado y su migración 20261030160000 ya está aplicada.

### Corrección de Claude revisada — 30 de octubre de 2026

Antonio pidió retomar el PR #18 con `ac61e25`, integrado como `509e575` sin rehacerlo. Los dos hallazgos anteriores quedaron corregidos: reserva/confirmación del aviso con reintento tras error y bandera manual anunciada por el servicio. **266/266 pruebas y ambos navegadores solicitados aprobados**, incluido el restablecimiento con MFA de `54081f1`. Ver el cierre de `docs/PANEL-PLATAFORMA.md`.

Preparación lista, publicación aún pendiente: pedir confirmación antes de cada paso (respaldo, panel, códigos, Worker, Railway). La migración manual corregida no está aplicada y no requiere reversión. No interpretar el estado de la bandera ni una respuesta 201/202 como recepción física del aviso; probar con Antonio después, con su permiso para desconectar. No tocar FiNeCi ni activar citas/promociones/vinculaciones/inicio público. No hubo cambios en producción en esta revisión.

### Panel publicado y reinicio del propietario — 30 de octubre de 2026

Antonio autorizó cada paso y pidió borrar las cuentas/datos para empezar de cero con un nuevo número de propietario, guardado solo en operación privada. Leer los cierres de `docs/PANEL-PLATAFORMA.md` y `docs/REINICIO-PROPIETARIO.md`. Migraciones reales 20261030185341 y 20261030185533 ya aplicadas; no repetirlas por sus nombres de archivo originales. Worker 2be43b60-cf88-4f6c-869a-e376a68af5b7 con inicio público expresamente autorizado. Railway 97a5e4da-0c3b-45d2-84ec-f040ab4a8243 SUCCESS, respaldo manual anunciado=true y conexión de códigos conservada. Citas/promociones y vinculaciones nuevas siguen apagadas.

Cuenta antigua eliminada por Auth Admin después del respaldo y vaciado autorizado. Cero salones/objetos/accesos anteriores; única identidad Auth nueva reservada para Antonio, sin confirmar teléfono, sesión, contraseña, MFA ni salón. Solo ese UUID posee plataforma_admins y social_moderadores. Antonio debe completar `/#registro` y sus dos pasos para ver el panel. No reasignar dueño al primer registro arbitrario, no conceder permisos por formulario y no volver a ejecutar el reinicio. El UUID histórico MIGRACION_USUARIO_ID no se traslada a la cuenta nueva: no recuperar caché heredada en el salón limpio.

268/268 pruebas, dos recorridos de navegador y comprobación pública final aprobados sin códigos ni usuarios de prueba. Prueba física del primer registro y del respaldo manual aún pendiente con Antonio; desconexión deliberada requiere su permiso. Inicio real original del servicio conserva 2026-10-27T19:11:09.551883275Z para el informe de siete días. No tocar FiNeCi ni aumentar el presupuesto compartido de 10 USD.

### Reparación de validación Workers — 30 de octubre de 2026

Ante la captura del registro con Turnstile verde y error de seguridad, se reprodujo `Illegal invocation` en el motor workerd y un 503 público con token inválido, antes del OTP. Leer `docs/CORRECCION-REGISTRO-WORKERS.md`. Rama separada `codex/agendappx-captcha-workers` desde `8a72fa4`; dos constructores ligan el fetch global correctamente. 268 pruebas, cuatro escenarios workerd y navegador aprobados, sin CAPTCHA/códigos reales ni cambios de base/Railway. Antonio autorizó publicar esta corrección solo en Cloudflare; registrar el resultado antes de afirmar que se publicó. Conservar la reserva del dueño, el reinicio, inicio público y las banderas existentes.

Reparación publicada: código `7e9dc20`, Worker **1a2ba21b-467c-458d-9056-77299bcf9422**, `--keep-vars`. Prueba pública negativa pasó del 503 incorrecto al 400 correcto de Siteverify; inicio público, registro y panel protegido verificados en Edge. No se generaron OTP ni cuentas de prueba. WhatsApp conectado, respaldo manual activo y reserva del dueño intacta. La corrección es de servidor; no cambia estáticos ni requiere actualización PWA. Se pidió a Antonio repetir su registro con una validación reciente; la recepción física del código queda pendiente de su respuesta. No desactivar CAPTCHA ni reiniciar cuentas para resolver una incidencia posterior.

La captura siguiente mostró «No se pudo preparar la cuenta». Logs reales: Auth 422/phone_exists porque la identidad del dueño ya estaba reservada; la función confundía `code:422` con `error_code`. Prueba ajustada al formato REST real, fallo reproducido y corrección mínima; 268/268 aprobadas. Con autorización específica se publicó la función **agendappx-registro v4**, comprobada con petición firmada real sobre la misma identidad: 200/preparada, sin crear cuentas ni confirmar teléfono/enviar OTP. Se caducó solo el ticket/apartado fallido aprobado, conservando UUID/propiedad/datos. Leer el cierre de `docs/CORRECCION-REGISTRO-WORKERS.md`. El Worker conserva 1a2ba21b y Railway no cambió. Se espera que Antonio solicite el código desde su registro; recepción física todavía no confirmada.

La nueva captura llegó a «Escribe el código», pero Auth rechazó `/otp` con 422/signup_disabled antes del hook: un teléfono existente sin confirmar se trata como alta, aunque `create_user:false`. Reparación preparada en el PR #19: usar `/resend` type sms únicamente tras ese rechazo explícito, para WhatsApp con registro habilitado y sin phone_change; mismo ticket, límites y hook, sin abrir altas, autoconfirmar ni repetir envíos inciertos. Error_code normalizado. 279/279 pruebas, navegador con teléfono inicialmente sin confirmar, workerd y paquete aprobados. Esta corrección nueva aún exige la confirmación de publicación preguntada al usuario. No borrar la cuenta ni caducar el ticket válido. Ver el último apartado de CORRECCION-REGISTRO-WORKERS.md.

Publicación autorizada y completada: **Worker 1a9f4aa9-a53a-487c-a949-6c4bd2082e62**, código c01675f, --keep-vars, sin cambios de estáticos, Supabase ni Railway. Configuración, registro, panel protegido y Siteverify comprobados públicamente sin OTP real. Ticket del usuario aún válido y dueño sin confirmar/sin sesiones; WhatsApp conectado. Se pidió continuar desde la misma pantalla y solicitar una vez. Pendiente respuesta física, sin declarar recibido el código antes de verificarlo.
