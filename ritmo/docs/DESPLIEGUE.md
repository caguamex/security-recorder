# Ritmo Belleza: publicación e instalación

La PWA y el backend PostgreSQL están publicados en https://belleza-production.up.railway.app. Antonio autorizó el 25 de octubre de 2026 el despliegue dentro del límite compartido de consumo de Railway de 10 USD por ciclo, sin ampliarlo. El proyecto `ritmo-belleza` tiene dos servicios dedicados, con límites de 0.25 GB de memoria y 0.1 vCPU cada uno. No se contrataron otros planes.

Consulta [el manual de uso](USO.md) para conectar los dispositivos, suscribir calendarios y conocer las condiciones de WhatsApp gratuito. WhatsApp oficial está implementado y probado con transporte simulado; su activación real depende de vincular el número del salón en Meta y disponer de sus credenciales. No se han enviado mensajes de Meta.

## Enlace de vista previa

[Abrir Ritmo Belleza](https://caguamex.github.io/security-recorder/).

La vista previa está publicada con GitHub Pages desde la rama `gh-pages`. Sirve para revisar la interfaz y probar el funcionamiento sin conexión; guarda los datos únicamente en el dispositivo. No conecta el backend ni muestra la opción para introducir el token. Sus claves de almacenamiento usan el prefijo `belleza.preview.v1.` para separarlas de la versión de producción. Para trabajar con la agenda sincronizada usa la dirección de Railway indicada arriba. Los datos locales de la vista previa permanecen en el navegador y no se transfieren automáticamente entre dominios.

La rama `gh-pages` contiene una copia de `dist/pwa/` para la vista previa, con la conexión al servidor oculta, el almacenamiento separado y el service worker versionado de nuevo. No se actualiza automáticamente al cambiar la rama de desarrollo.

## Ejecutar y verificar sin servicios externos

Desde la raíz del repositorio, con Node.js 22 o posterior:

```bash
npm ci --prefix ritmo/servidor
npm test --prefix ritmo/servidor
node ritmo/herramientas/servir.mjs
```

La última instrucción abre el servidor estático en `http://localhost:4173`. La agenda y el modo sin conexión funcionan allí. La sincronización requiere el backend.

La prueba de navegador usa PostgreSQL en WebAssembly (PGlite), crea dos dispositivos aislados y cierra sus datos temporales al terminar. No conecta Railway:

```powershell
$env:BROWSER_CHANNEL='msedge'
npm run test:navegador --prefix ritmo/servidor
```

En equipos con Chromium de Playwright instalado se puede omitir `BROWSER_CHANNEL`. Las capturas se guardan en `ritmo/imagenes/pwa-*.png`.

Para ejecutar el backend contra una base PostgreSQL local o ya autorizada, configura las variables en el entorno de la terminal; no las escribas en archivos versionados:

```bash
npm run build --prefix ritmo/servidor
npm start --prefix ritmo/servidor
```

El servidor usa el puerto 3000 si no recibe `PORT`. Al arrancar crea sus tablas `belleza_*` si no existen y aplica cambios aditivos de versión. Usa una base dedicada al proyecto.

## Preparación para Railway

El servicio usa la raíz del repositorio como directorio de trabajo. El `Dockerfile` compila TypeScript, genera `ritmo/dist/pwa/`, conserva solo dependencias de producción y ejecuta con usuario sin privilegios. Railway detecta el Dockerfile; el constructor de su API se configura como `RAILPACK` y la ruta del Dockerfile activa el constructor Docker real. No usar el valor inexistente `DOCKERFILE` en el enum GraphQL `Builder`. `railway.toml` fija la ruta y la comprobación `/salud`. No requiere un volumen para el servicio web: la persistencia está en PostgreSQL. Los despliegues actuales se suben desde la CLI; no se conectó un despliegue automático que pudiera activarse con cualquier push.

Variables del **servicio web**:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Referencia a la conexión de PostgreSQL, por ejemplo `${{Postgres.DATABASE_URL}}` si el servicio de base se llama `Postgres`. Usa la red privada del proyecto. |
| `APP_TOKEN` | Secreto aleatorio de al menos 32 caracteres. El mismo token autoriza todos los dispositivos de esta agenda. |
| `PORT` | Railway lo proporciona; el proceso escucha en `0.0.0.0`. |
| `NODE_ENV` | El contenedor ya lo establece como `production`. |
| `PUBLIC_URL` | Dirección HTTPS pública de la app; se usa para construir el enlace privado del calendario. |
| `TZ` | `America/Mexico_City`. |

Genera el token localmente y guárdalo solo en las variables del servicio y en tus dispositivos:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

No pegues ese resultado en GitHub, capturas, mensajes o URLs. Para revocar el acceso, cambia `APP_TOKEN` y vuelve a conectar los dispositivos autorizados. El frontend nunca recibe `DATABASE_URL` ni un token incrustado en su código. Las conexiones PostgreSQL respetan los parámetros TLS de `DATABASE_URL`; no se desactiva la validación de certificados.

Una vez publicado, comprueba la dirección HTTPS y `/salud`. La aplicación y la API se sirven desde el mismo dominio. No se admite apuntar la app a una API de otro dominio.

La suscripción privada `.ics` está implementada y publicada. WhatsApp automático requiere `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` y `WHATSAPP_APP_SECRET`; `WHATSAPP_API_VERSION` es opcional y actualmente usa `v24.0`. No se configuraron porque todavía no hay credenciales oficiales del salón disponibles. El webhook es `/webhooks/whatsapp`; GET valida el token de verificación y POST exige `X-Hub-Signature-256` con el secreto de la app de Meta. El modo implementado solo envía mensajes de servicio en una ventana gratuita abierta por la clienta, con su consentimiento; nunca envía plantillas facturables. Los botones manuales permanecen disponibles.

## Instalar en iPhone

1. Abre la dirección **HTTPS** publicada desde Safari, con conexión a internet.
2. En Compartir, elige **Agregar a pantalla de inicio**. Activa **Abrir como app** si aparece y toca **Agregar**.
3. Abre **Ritmo Belleza** desde su ícono. En **Más → Sincronización**, pega `APP_TOKEN` y toca **Conectar**. Hazlo desde la app instalada aunque ya lo hayas hecho en Safari: pueden usar almacenamiento separado.
4. Espera a ver **Sincronizado con tu servidor**. Para probar el modo sin conexión, activa modo avión, crea un registro y vuelve a abrir la app; al regresar internet se enviarán los cambios.

La primera apertura necesita internet para descargar los archivos. El service worker conserva HTML, scripts, íconos y las fuentes de los cinco temas; las respuestas de `/api/` nunca se guardan en CacheStorage. Las actualizaciones se aplican al cerrar las ventanas de la app y volver a abrirla.

El navegador puede eliminar su almacenamiento si se borran datos del sitio o falta espacio. Sincroniza antes de borrar datos o desinstalar. Una copia de seguridad de PostgreSQL protege lo ya sincronizado; los cambios aún sin enviar existen solo en ese dispositivo.

## Sincronización y conflictos

- La caché y la cola se guardan juntas en `localStorage` (`belleza.v1.sync`); el token se guarda en `belleza.v1.token`.
- Se recuperan los objetos antiguos de `belleza.v1.items` y los ajustes de `belleza.v1.settings` al inicializar la nueva caché. Los datos de ejemplo no se suben hasta que el usuario los usa.
- Se intenta sincronizar al guardar, al volver internet, al regresar a la app y cada 30 segundos mientras está visible. En iPhone la sincronización requiere abrir la app; no depende de ejecución en segundo plano.
- Las consultas usan un cursor del servidor y devuelven solo las modificaciones posteriores, incluidas las eliminaciones. El cursor y la tanda se leen en una misma instantánea SQL para evitar saltarse cambios concurrentes.
- Cada registro tiene una versión del servidor. Una edición atrasada recibe un conflicto en vez de sobrescribir al otro dispositivo.
- Las eliminaciones conservan un registro vacío con versión para que un dispositivo atrasado no resucite datos.
- Los cambios tienen un identificador de operación: perder una respuesta y reintentar no duplica escrituras.
- En **Más → Sincronización** se pueden comparar las dos copias y elegir cuál conservar. La copia local permanece hasta que se resuelve el conflicto.
- **Desconectar este dispositivo** conserva la agenda y su cola, y quita el token local. No elimina datos del servidor.

El backend está pensado para un salón con un token compartido. No implementa cuentas separadas, permisos por empleada ni aislamiento entre distintos negocios.

## API

Todas las rutas `/api/` requieren `Authorization: Bearer <APP_TOKEN>` y responden con `Cache-Control: no-store`.

| Ruta | Uso |
|---|---|
| `GET /salud` | Disponibilidad del proceso y de PostgreSQL, sin datos privados. |
| `GET /api/estado?since=<cursor>` | Devuelve `{ records: [{ id, version, data, revision }], cursor, full }`, incluidas eliminaciones. Sin cursor entrega el estado completo. |
| `PUT /api/objetos/<id>` | Crea, actualiza o elimina un objeto con `{ baseVersion, mutationId, data }`. `data: null` elimina. |
| `PUT /api/objetos/__settings` | Guarda los ajustes con el mismo control de versiones; no admite eliminación. |
| `GET /api/conexiones` | Enlace privado del calendario y estado de WhatsApp, con autenticación. |
| `POST /api/calendario/renovar` | Invalida el enlace anterior y emite uno nuevo. |
| `GET /calendario/<token>.ics` | Feed privado de solo lectura, con token distinto del acceso general. |
| `GET/POST /webhooks/whatsapp` | Verificación y eventos firmados de Meta; sin sesión de la app, con validación específica del webhook. |

El servidor admite los cinco tipos `servicio`, `clienta`, `cita`, `promo` y `grupo`, valida los campos principales y limita cada petición a 64 KB. Los errores 409 incluyen `current`, la copia actual del servidor. Un ID de operación no se puede reutilizar con otro contenido.

## Validación y límites

Se conservan la distribución y los cinco temas originales. Se compararon las pantallas con `diseno-1.png` y `belleza-app-pantallas.png` y se revisaron anchos de 390, 768 y 1440 px. El inspector de diseño detectó aspectos anteriores al cambio: contraste bajo de “Por confirmar”, sombra del marco de escritorio y título de 34 px. Se conservaron por la instrucción de no rediseñar.

Pasan 84 pruebas locales; las pruebas SQL usan PGlite. El contenedor se compiló correctamente en Railway y sus dos servicios llegaron a estado `SUCCESS`. En producción se verificó `/salud`, la protección de la API, escritura y lectura en PostgreSQL, el calendario privado y una creación sin conexión que se sincronizó con un segundo dispositivo a 390 px. Los registros temporales fueron retirados. La instalación física en Safari/iPhone queda pendiente de probar en el dispositivo del usuario. WhatsApp se probó con transporte simulado y sin enviar mensajes reales.

La primera medición en reposo observó aproximadamente 76 MB de RAM entre ambos servicios. Es una observación inicial y no una tarifa fija; el consumo futuro depende del uso. Se conserva el aviso de consumo a los 5 USD y el límite compartido de 10 USD. El volumen es persistente y privado; no se habilitó un puerto público de PostgreSQL ni complementos de respaldos de pago.

Referencias: [Dockerfile en Railway](https://docs.railway.com/builds/dockerfiles), [variables de Railway](https://docs.railway.com/variables), [apps web en Safari](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios), [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [PGlite](https://pglite.dev/docs/).
