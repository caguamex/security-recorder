# Ritmo Belleza en Cloudflare y Supabase Free

Aplicación: **https://ritmo-belleza.antonio-t-22.workers.dev**.

Migración autorizada y ejecutada el 26 de octubre de 2026. Los dos despliegues antiguos de Ritmo en Railway quedaron detenidos (`deploymentStopped: true`, instancias `EXITED`) después de verificar el nuevo destino. Se conservaron el proyecto, su volumen y el respaldo local; no se modificaron recursos de FiNeCi.

## Componentes

| Parte | Destino |
|---|---|
| HTML, JS, fotos, íconos y fuentes | Workers Static Assets; los archivos se sirven sin ejecutar el Worker |
| API, calendario privado y webhook | Worker `ritmo-belleza`, Node.js compatible |
| Base PostgreSQL | Supabase Free, proyecto `ritmo-belleza`, `zkqwephmuflbuagevvxj`, región `us-east-1` |
| Conexiones SQL | Hyperdrive `1eb7ac0aa8da4ed4914302faa7f1b89c`, caché desactivada, límite de origen configurado en cinco conexiones |
| Revisión de WhatsApp | Cron de Cloudflare cada cinco minutos; no procesa envíos mientras falten las credenciales oficiales |

`nube/worker.mjs` reutiliza el servidor HTTP, validaciones, repositorio, calendario y WhatsApp de `servidor/src/`. `httpServerHandler` adapta Node HTTP a Workers. Cada operación abre un cliente `pg` y lo cierra; no comparte sockets de aplicación entre solicitudes. Hyperdrive administra las conexiones remotas. El Worker no crea tablas al atender visitas.

El esquema privado `ritmo` usa el rol limitado `ritmo_api`, sin privilegios de superusuario, creación de bases ni creación de roles. Solo tiene acceso a las tablas de Ritmo; estas tienen RLS y una política para el rol de servidor. No se exponen a `anon`, `authenticated` ni a la Data API pública. La revisión de seguridad de Supabase no devolvió observaciones en este proyecto después de aplicar el esquema.

## Costos y cuotas

La cuenta de Cloudflare estaba sin aplicaciones y mostraba cero solicitudes sobre 100,000 diarias. Se publicaron Workers Free y Hyperdrive dentro de su cuota gratuita. Supabase confirmó un costo de **0 USD/mes** para el nuevo proyecto dentro de la organización Free elegida expresamente por Antonio. No se activó un plan de pago.

- Workers Free: 100,000 solicitudes al día y 10 ms de CPU por invocación; los archivos estáticos no consumen solicitudes de ejecución del Worker.
- Hyperdrive Free: 100,000 consultas diarias; cada sentencia cuenta, incluidas las de transacciones. La caché está desactivada para conservar la consistencia de la agenda.
- Supabase Free: 500 MB de base por proyecto; las cuotas de transferencia y funciones se comparten por organización. Puede pausar un proyecto tras una semana de inactividad. No se crea tráfico artificial para eludir esa condición.
- Superar las cuotas puede restringir el servicio; no se habilitó un incremento automático de plan. Estas cuotas no equivalen a una garantía de capacidad ilimitada.
- Detener los contenedores antiguos de Railway reduce su cómputo, pero no borra consumo ya acumulado ni elimina el posible cargo del volumen conservado. El límite de Railway de 10 USD por ciclo sigue siendo compartido con FiNeCi y no se aumentó.
- Meta sigue sin configurar. Las plantillas facturables continúan bloqueadas; no se enviaron mensajes reales.

## Compilar y publicar

Con Node.js 22 o posterior, desde la raíz del repositorio:

```powershell
npm ci --prefix ritmo/servidor
npm ci --prefix ritmo/nube
npm test --prefix ritmo/servidor
npm run build --prefix ritmo/nube
```

El comando de compilación de nube realiza un `deploy --dry-run`: empaqueta sin publicar. `nube/empaquetar.mjs` agrega `_headers` después de generar la caché; `_headers` y `_redirects` no entran en el precache de la PWA.

Antes de publicar cada conjunto nuevo de cambios, completar las verificaciones y solicitar confirmación de Antonio conforme a [.agents/skills/ritmo-confirmar-deploy/SKILL.md](../../.agents/skills/ritmo-confirmar-deploy/SKILL.md). Una aprobación de implementación no autoriza por sí sola un deploy.

Después de recibir autorización explícita para publicar ese conjunto, usar una sesión de Wrangler autorizada:

```powershell
npm run deploy --prefix ritmo/nube -- --secrets-file C:/Users/dellv/.config/ritmo-belleza/cloudflare-secrets.json
```

El archivo privado contiene `APP_TOKEN`, nunca una clave incrustada en el frontend. No copiarlo a Git, capturas o mensajes. `PUBLIC_URL` y `TZ` están en `nube/wrangler.jsonc`. Hyperdrive conserva la conexión PostgreSQL del rol de servidor con verificación TLS completa. No se necesita un dominio comprado ni Vercel Pro.

Las credenciales de Meta, cuando existan, se cargarán como secretos de Cloudflare: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` y, opcionalmente, `WHATSAPP_API_VERSION`. No se cargaron valores ficticios ni se reutilizó la conexión Evolution de FiNeCi.

No hay despliegue automático conectado a Git: un push no vuelve a encender Railway ni publica Cloudflare por sí solo. Para publicar cambios se usa el comando anterior después de la confirmación específica del conjunto.

## Traslado de datos y respaldo

El origen se puso temporalmente en modo de traslado. Se exportaron en una instantánea de solo lectura y aislamiento repetible las siete tablas de Ritmo: estado global, objetos, recibos de mutaciones, integraciones, contactos de WhatsApp, entradas y cola. El endpoint temporal de exportación exige una clave de operación independiente; el token de la aplicación no permite descargar ese respaldo. En Cloudflare este endpoint no se publica.

La copia original contiene cinco registros de objetos (incluidos ajustes y eliminaciones), nueve recibos de idempotencia y una configuración de calendario; no había filas de WhatsApp. Se importó con una transacción al esquema privado de Supabase. Se comprobaron las versiones, los datos y la revisión de cada objeto contra el respaldo. Se conservó la clave privada del calendario.

Las verificaciones en producción usaron identificadores aleatorios `verificacion_nube_*` y retiraron sus registros mediante la eliminación versionada de la API. Quedan sus recibos y registros vacíos como parte del protocolo de sincronización; no son clientas, servicios o citas activos. La revisión global avanzó con esas comprobaciones, por lo que no debe compararse con el número anterior como si no hubiera habido operaciones nuevas.

Respaldo privado: `C:/Users/dellv/.config/ritmo-belleza/respaldo-railway-20261026.json`. La sentencia de importación y las claves también permanecen fuera de Git en esa carpeta protegida. El volumen anterior de Railway no fue borrado. Estos respaldos son una instantánea de la migración; no sustituyen respaldos periódicos de las futuras escrituras de Supabase.

Un retorno al origen requiere copiar primero las escrituras del nuevo destino y retirar el modo de traslado. No reactivar la base antigua como fuente de trabajo por suposición.

## Cambio de dominio y dispositivos

La clave de acceso se conserva, pero el navegador separa sesiones y almacenamiento por dominio. Abrir la nueva dirección requiere conectar el dispositivo en Más → Sincronización. Los datos ya sincronizados sí están en el nuevo servidor; cambios pendientes que existan únicamente en otro dispositivo no se transfieren por cambiar de dominio. No borrar la copia anterior si tiene cambios sin enviar; recuperarlos antes de descartar su almacenamiento.

Apple/Google Calendar deben suscribirse al enlace obtenido desde la nueva dirección. La clave del feed se conservó, pero la URL anterior de Railway deja de responder con sus despliegues detenidos.

## Verificación realizada

- **86 pruebas locales pasan**, con PostgreSQL en WebAssembly. Incluyen el respaldo consistente y la espera de una sincronización automática al pulsar el botón manual.
- Compilación del Worker y publicación de archivos, secretos y disparador programado verificadas.
- `/salud`: 200; API sin clave: 401; solicitudes de otro origen: 403; webhook de WhatsApp sin configurar: 503.
- Escritura y lectura real en Supabase, calendario privado sin teléfonos, edición sin internet, recarga, sincronización entre dos dispositivos y ausencia de datos privados en CacheStorage, con Edge aislado.
- Anchos de 390, 768 y 1440 px sin desbordamiento en la prueba del destino.
- Después de detener ambos despliegues antiguos, Cloudflare conserva salud 200 y los objetos originales coinciden con el respaldo.
- No se verificó instalación física en iPhone, ni envíos reales de Meta, ni una prueba de carga para exceder las cuotas gratuitas.

## Fuentes oficiales

- [Workers: precios y límites](https://developers.cloudflare.com/workers/platform/pricing/).
- [Static Assets: facturación](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).
- [Compatibilidad HTTP de Node](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/).
- [Supabase con Hyperdrive](https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/).
- [Hyperdrive Free](https://developers.cloudflare.com/hyperdrive/platform/pricing/).
- [Supabase: precios](https://supabase.com/pricing).

## Publicación del aviso y prueba real — 26 de octubre de 2026

Antonio confirmó publicar el aviso y probarlo con la carga de fotos. Se publicó primero la versión `4831e3b7-b9d6-4eaa-8733-af6eb0456198` para cargar el sistema de avisos en los dispositivos que aún tenían el código anterior. Después de que Antonio confirmó abrir y cerrar Ritmo en su celular, se publicó `0eb2f0ae-1f05-44c3-ae18-e1691fdae3a4`, con revisión cada minuto mientras la página está visible y la opción Subir foto disponible.

Una sesión aislada en Edge permaneció abierta durante ambas publicaciones reales. Mostró el aviso de nueva versión, Actualizar ahora cambió la caché y recargó, y Servicios → Nuevo servicio mostró Subir foto. La comprobación no escribió datos en el servidor. También pasó de nuevo `test:actualizacion` con las dos versiones locales. Antonio confirmó en su celular «Sí, ya apareció» al preguntarle por el aviso y el botón Actualizar ahora. Se verificó así la recepción del aviso en su dispositivo; el clic y la carga de foto en ese celular todavía no están confirmados. No se activaron planes de pago ni publicación automática desde Git.

## Diseño 3D publicado — 26 de octubre de 2026

Después de revisar la vista interactiva y confirmar «sí, hazlo», se publicó el diseño 3D de Claude sobre la app real. Worker: `ecd22d8d-7140-40b8-85a7-f2263178373d`. Incluye barra minimal con emojis, Nueva cita desde el + central, Ajustes, promociones dentro de Servicios y apariencia White/Dark sincronizada sobre los cinco temas. Las fotos propias, la entrega vacía y el aviso de actualización se conservan.

Una sesión aislada que tenía el diseño anterior recibió el aviso real, actualizó y verificó Ajustes, Dark, + central y preparación de foto a 390 px, sin guardar cambios del salón. La prueba completa de producción pasó salud, autenticación, origen, PostgreSQL, calendario privado y sincronización entre dos dispositivos con edición sin conexión. Solo se retiraron los registros temporales con prefijo `verificacion_nube_c806b3028f3f42ccadc1aa4429231ad3`. No se activaron planes ni recursos nuevos. La recepción de este diseño en el celular físico de Antonio todavía no se ha confirmado.

## Nombre Agendappx publicado — 26 de octubre de 2026

Antonio eligió Agendappx y confirmó su publicación. La versión final es `141500c2-0639-423f-a707-3b835d51ea65`. Se actualizan título, manifest (`name` y `short_name`), metadatos de instalación (`apple-mobile-web-app-title` y `application-name`) y nombre visible del calendario. Conserva URL, identidad de instalación, UID de eventos, claves, almacenamiento y prefijo de caché. No crea recursos ni cambia planes.

El primer intento devolvió el error 10013 de Cloudflare al iniciar la carga; el reintento publicó correctamente. Una primera sesión conservó el título anterior; se completó el metadato genérico de nombre y una nueva publicación renovó la caché. La verificación final mantuvo una sesión abierta, recibió el aviso real, actualizó y confirmó título, manifest y metadatos Agendappx también al recargar. Salud respondió 200 y el calendario privado mostró `X-WR-CALNAME:Agendappx`. No se escribieron registros ni se cambiaron claves en producción. El nombre del ícono en instalaciones anteriores depende de la actualización de metadatos del navegador y no se verificó físicamente en el celular.

## Apple Calendar y activación privada publicados — 26 de octubre de 2026

Antonio respondió «Implementa» a la pregunta de publicar la corrección y preparar la activación de su celular. Se publicó desde `codex/agendappx-calendario-sin-claves`, commit de aplicación `69a6537`, PR #4: Worker `48604e6c-0f36-4ce6-9961-a9e2740f3b6c`. Incluye .ics directo, acceso por enlace de un solo uso y sesión HttpOnly del propietario. No incluye los PR #2/#3 de cuentas y WhatsApp.

La verificación real de backend y navegador pasó; la sesión temporal de prueba se revocó y las citas/ajustes conservaron su misma huella antes/después. No se modificaron planes, recursos, claves ni permisos de base; la tabla privada existente guarda únicamente huellas y caducidades. No hubo migraciones. El celular se activa mediante una confirmación de Antonio, conservando su cola local. Detalle: [CALENDARIO-APPLE.md](CALENDARIO-APPLE.md).

Reparación posterior del mismo flujo: Worker `cc592c8f-29ce-4bb5-a8a4-1be92a5018b1`, commit de aplicación `6eb81b3`. Corrige el bloqueo innecesario al suscribirse con diferencias pendientes. Se conservan sesión, cola y conflictos; la UI advierte sobre lo aún no sincronizado y permite revisar/reintentar. Verificación del archivo publicado, salud 200 y privacidad 401 correctas. Sin cambios de claves, datos, esquema ni planes.

## Cuentas mínimas y WhatsApp publicados — 27 de octubre de 2026

Antonio autorizó respaldo, migración y publicación con «okey, hazlo». Worker vigente `49605020-f7e9-4403-8a0d-8b51ab3c3743`, misma URL. Activadas cuentas Supabase firmadas con TOTP Admin y rutas por salón; APP_TOKEN ya no da acceso a agenda ni WhatsApp. Se conservaron exactamente las siete tablas originales del respaldo y el feed privado anterior. Los cambios locales heredados se conservan y el dueño puede recuperarlos con conflictos explícitos.

`WHATSAPP_REMITENTE=vinculado`: Cloudflare no envía ni procesa el webhook de Meta. El proxy apunta al servicio separado `agendappx-whatsapp` de Railway; una réplica, 0.5 GB/0.1 vCPU, salud 200, sin teléfono ni envíos habilitados. Inicio real 2026-10-27T19:11:09.551883275Z; detalle en SIGUIENTE-WHATSAPP.md. La clave Admin de Supabase nunca se cargó en Cloudflare ni Railway; el frontend solo recibe clave publicable. No se renombró infraestructura, compró dominio ni modificó FiNeCi.

Verificación publicada: salud/configuración/página 200, datos y control sin identidad 401 incluso con APP_TOKEN, Meta 503, calendario original 200 sin notas. Acceso Admin sin SMS visible en Edge a 390 px sin errores ni desbordamiento. El dueño debe completar TOTP en su teléfono; vinculación y primer mensaje requieren aprobaciones separadas.

## Buscador publicado — 28 de octubre de 2026

Con aprobación expresa de Antonio, Worker `a8277d15-0c7d-41b5-b65d-b24b4694a1ec`, aplicación `2a98555`, PR #6. Solo añade buscador, agrupación y consulta autenticada de nombres/asignaciones del equipo. Archivos y navegador de producción verificados; sin migración, cambios de datos, nuevos planes o activación de invitaciones/WhatsApp. Referencia y pruebas: BUSCADOR-SERVICIOS.md. Los móviles reciben el aviso de nueva versión y actualizan con su confirmación.
