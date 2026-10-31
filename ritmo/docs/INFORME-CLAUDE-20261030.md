# Informe de Claude Code — Agendappx, 30–31 de octubre de 2026

Encargo de Antonio coordinado por Codex: reparar el «Error generating QR Code» persistente del panel del dueño, estimar capacidad (clientes, concurrencia y fotos) y revisar el funcionamiento. Copia aislada, rama `codex/claude-revision-agendappx`, base `ba0cdf1`.

## 1. Estado

**Terminado para revisión, sin publicar** (actualizado el 31/oct tras la revisión de Codex). La causa se reprodujo en el mismo contexto de navegador y está corregida. La regresión nueva aprueba en **Edge y en WebKit**. El fallo de WebKit que observó Codex se diagnosticó como un problema del arnés de la prueba, no de la app (sección 4.1). Pendientes reales:

- **Prueba física en el iPhone** de Antonio: no realizada (no hay acceso al dispositivo). WebKit en Windows no equivale a Safari en iOS.
- **Publicación:** no se desplegó nada. Requiere la confirmación de Antonio según `.agents/skills/ritmo-confirmar-deploy/SKILL.md`.
- Sin commit ni push; Codex gestiona Git.

No se tocaron producción, Supabase, Railway, Cloudflare, FiNeCi, cuentas, códigos ni mensajes reales. No se leyeron `.env*` ni credenciales. La foto del usuario no se incorporó a Git ni a este informe.

## 2. Causa reproducida

**Cliente anterior retenido por el service worker.** No se trata del servidor ni de la migración.

1. `sw.js` responde primero desde CacheStorage (`caches.match(..., {ignoreSearch:true})`) a `/plataforma/index.html`, `/cuentas.js` y `/plataforma/plataforma.js`.
2. Al publicar b158896, el navegador descarga el SW nuevo, que queda **en espera** (sin `skipWaiting` automático, por diseño). Solo se activa con el botón «Actualizar ahora» de la agenda o de Comunidad, o al cerrar todas las ventanas de Agendappx.
3. `/plataforma/` no cargaba ningún actualizador, y su botón «Actualizar» (`plataforma.js:66` en la base) solo volvía a pedir la API.
4. Recargar no activa un SW en espera porque la propia ventana sigue siendo cliente del SW anterior. Por eso el panel seguía ejecutando el SDK de 61cb2a6: `sesionPlataforma()` exigía AAL2, `preparar()` llamaba a `mfa.enroll` y Supabase Auth respondía «Error generating QR Code».

**Reproducción** (`ritmo/servidor/pruebas/dueno-actualizacion-navegador.mjs`, escenario A, Edge y WebKit, mismo contexto):

- Compilación real de **61cb2a6** extraída de Git. El SW se registra y queda una sola ventana `/plataforma/`, como el navegador integrado de la captura.
- OTP ficticio y PostgreSQL local con la migración vigente del dueño. Auth simulado: el endpoint `/auth/v1/factors` devuelve 500 «Error generating QR Code».
- Se publica la compilación real de **b158896** en el mismo servidor: el navegador la instala y queda `waiting`. Tras dos recargas y el botón «Actualizar»:
  - el texto «Error generating QR Code» sigue visible;
  - `/cuentas.js` servido es idéntico byte a byte al de 61cb2a6;
  - el cliente anterior vuelve a llamar a `mfa.enroll`.

Los botones del panel y la recarga quedan descartados como solución. La respuesta 500 de Auth se simula con el mismo texto; no se consultó Supabase real.

## 3. Cambios (sin rediseño)

| Archivo | Cambio |
|---|---|
| `ritmo/belleza/sw.js` | **install:** si ya hay una versión activa y **todas** las ventanas abiertas son `/plataforma/` o `/recuperar-acceso/` (sin agenda, cola ni fotos locales), la versión nueva se activa sin esperar. **activate:** si había una versión anterior y solo hay ventanas de panel o recuperación, recarga únicamente las ventanas `/plataforma/` (`client.navigate`, sin `await`: esperarla causaba un interbloqueo con la propia activación, detectado y corregido durante la prueba). Con la agenda o Comunidad abiertas se conserva la regla anterior: solo su botón «Actualizar ahora» activa la versión. Se conservan `sinRedirecciones` (Safari), `ignoreSearch`, la exclusión de `/recuperar-acceso/` y la limpieza de cachés antiguas. |
| `ritmo/belleza/plataforma/index.html`, `plataforma.css`, `plataforma.js` | El panel usa el mismo aviso «Hay una nueva versión disponible» que Comunidad (`/comunidad/actualizacion.mjs`). Su botón **Actualizar** busca la versión nueva; si existe, la instala con el mismo aviso y protección de formularios, y si no, recarga los datos. |
| `ritmo/comunidad/actualizacion.mjs` | Devuelve `{pendiente(), aplicar()}` para ese botón. Espera a que termine la instalación en curso. No cambia el comportamiento de Comunidad. |
| `ritmo/belleza/recuperar-acceso/recuperar.js` | `?destino=/plataforma/` (único valor admitido además de `/`) regresa al panel después de reparar. Cualquier otro valor abre la agenda. |
| `ritmo/servidor/pruebas/dueno-actualizacion-navegador.mjs` | Regresión nueva, escenarios A–C (sección 4). |
| `ritmo/servidor/package.json` | Script `test:dueno`. Sin dependencias nuevas ni cambios en lockfiles. |
| `ritmo/dist/**` | Regenerado con `npm run build` (incluye el `sw.js` con versión nueva). |
| `ritmo/imagenes/acceso-dueno/04-panel-tras-actualizar.png`, `05-aviso-version-nueva.png` | Capturas ficticias a 390 px, recortadas para no mostrar el número de códigos. |

**Sin cambios en** servidor, SQL, RLS, MFA de otras cuentas, `sesionPlataforma()`, `plataforma_whatsapp_en`, logout ni aislamiento. No se borra localStorage, cookies, IndexedDB ni cachés ajenas, y no se anula el registro del SW.

**Límites conocidos:**

- **Transición desde el código anterior.** Con la agenda o Comunidad abiertas en el mismo navegador, el panel antiguo sigue esperando. La salida es el aviso «Actualizar ahora» de esa pestaña, `/recuperar-acceso/` o cerrar todas las ventanas de Agendappx. El panel antiguo no tiene código que pueda activar la versión.
- **Recarga automática del panel.** Si una versión nueva se activa mientras el dueño escribe un OTP y solo el panel está abierto, el panel se recarga. La sesión se conserva, pero debe pedir otro código. Solo ocurre después de una publicación.
- Si el sistema detiene el SW entre la instalación y la activación, la activación vuelve a evaluar las ventanas; no depende de una variable global.

### Qué puede hacer Antonio hoy, sin publicar nada

b158896 ya está publicado; en su teléfono solo falta activarlo. Debe hacerlo **en el mismo navegador donde ve el error**. La captura parece un navegador integrado de otra app, con almacenamiento distinto al de Safari:

1. Abrir `https://ritmo-belleza.antonio-t-22.workers.dev/recuperar-acceso/` y pulsar «Reparar y abrir Agendappx». La versión publicada abre la agenda; después debe ir a `/plataforma/`.
2. Alternativa: cerrar todas las ventanas de Agendappx en ese navegador (incluida la app de inicio) y volver a abrir `/plataforma/`.

No se ha comprobado en su iPhone. El mismo camino de recuperación sí se probó en Edge y WebKit con el SW de 61cb2a6 (escenario B).

## 4. Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| `node --test ritmo/servidor/pruebas/dueno-actualizacion-navegador.mjs` (nueva) | **Aprobada en Edge y WebKit** (31/oct, ejecución final de Claude: 45 s). Ambos motores, cada uno en su contexto: **A:** reproduce el fallo con 61cb2a6 → b158896. Con la corrección, una recarga instala la versión y recarga solo el panel. Entra sin QR, sin MFA y sin pedir otro código, conserva la sesión AAL1 y deja una sola caché nueva. El panel y la agenda abren sin conexión. **B:** con la agenda abierta y datos sin sincronizar (cola en localStorage, foto en IndexedDB, cookie) no hay activación automática: la agenda muestra el aviso y no se recarga. `/recuperar-acceso/?destino=/plataforma/` entra al panel con los datos intactos. **C:** con el panel corregido, su botón Actualizar instala la versión siguiente y recarga solo el panel; la agenda conserva datos y no se recarga. Salir funciona, White/Dark sin desbordamiento. Además, **cero intentos de conexión a Supabase** en ambos motores. Edge abrió 55 conexiones propias del navegador (Bing, Office) y el proxy local las rechazó; WebKit no abrió ninguna. Si falta WebKit, la prueba ahora falla en lugar de omitirlo. |
| `dueno-navegador`, `plataforma-navegador`, `contrasenas-navegador`, `safari-redirecciones-navegador` (Chromium/Edge), `actualizacion-navegador`, `comunidad-actualizacion-navegador` | **6/6 aprobadas** en Edge tras el cambio. |
| `npm test --prefix ritmo/servidor` (build + node --test) | **Codex (revisión):** tras instalar `ritmo/whatsapp` con su lockfile (`npm ci --ignore-scripts`, sin cambios de paquetes), **287/287 aprobadas** en 65 589 ms. **Claude, 1.ª entrega:** 250/252, porque faltaba `baileys`. **Claude, tras la revisión:** **287/287 aprobadas** en 64 615 ms (31/oct), con la misma reparación. Después de la revisión solo cambió el arnés de la prueba de navegador, no el código de la app. |
| Otras regresiones de navegador (Edge) | Ver sección 6.4. |

**Restricciones del entorno:** en esta sesión se denegaron `node <script>` directo, variables de entorno en línea (`SAFARI_PRUEBA=webkit …`), `git checkout`, `npm ci`, `openssl` y listar fuera de la copia. Las pruebas se ejecutaron con `node --test <archivo>`.

### 4.1 Fallo de WebKit observado por Codex: diagnóstico y resolución

**Síntoma (Codex):** en WebKit, timeout de 30 s esperando `#auth-otp-valor` en `entrarConCodigoViejo` (línea 76), con el elemento presente pero oculto. Lo reproduje igual.

**Diagnóstico con instrumentación temporal** (consola, peticiones, estado del formulario y registro del servidor; datos ficticios):
- `#auth-status` mostraba «Inicia sesión con tu cuenta.».
- La intercepción `context.route` de Playwright vio **0** solicitudes de código.
- El servidor local recibió `POST /api/acceso/solicitar` directamente y respondió **401**, porque ese servidor de prueba no tiene rutas de acceso.

**Causa probada (del arnés, no de la app):** en WebKit, las peticiones de una página **controlada por el service worker**, cuando el SW no responde y la carga sigue por la red, **no pasan por `context.route`**. En Chromium sí pasan, por eso Edge estaba verde.

Se comprobó lo mismo para las llamadas simuladas a Supabase Auth. Repetí la ejecución con un **proxy local que rechaza toda conexión externa**: WebKit intentó `CONNECT zkqwephmuflbuagevvxj.supabase.co:443` en la fase de autenticadora y el proxy lo **bloqueó con 403**, sin llegar a Supabase.

En la ejecución de Codex (sin proxy) la prueba se detuvo antes de verificar el código, y en mi ejecución con proxy el único intento hacia Supabase ocurrió después de esa fase. **No puedo descartarlo por completo**: si hubo alguna petición, fue anónima o con un token ficticio de prueba, nunca con un OTP ni una cuenta reales.

**Resolución (solo en la prueba; la app no cambia):**
- El OTP ficticio lo atiende un servidor frontal local delante de `crearServidor`, en lugar de `context.route`.
- Supabase Auth simulado se sirve en `/sb/auth/v1/*` del mismo servidor. Un `addInitScript` de la prueba redirige allí las URL de Supabase antes de que cargue el SDK. El cliente exige la URL real del proyecto (`cuentas.js:31`), así que no se puede configurar otra, y sin `openssl` no hay HTTPS simulado.
- Ambos navegadores se lanzan con el proxy de seguridad, y la prueba falla si hay cualquier intento hacia Supabase.

Resultado: **Edge y WebKit aprueban A, B y C**.

**Límite:** WebKit en Windows (Playwright) no es Safari de iOS ni el navegador integrado de la captura, y el `fetch` simulado sustituye la red de Auth. La prueba en el iPhone sigue pendiente.

## 5. Capturas ficticias (390 px)

- `ritmo/imagenes/acceso-dueno/04-panel-tras-actualizar.png`: panel abierto tras la actualización, en Dark, con datos locales ficticios.
- `ritmo/imagenes/acceso-dueno/05-aviso-version-nueva.png`: aviso «Hay una nueva versión disponible» en el panel.

**Para Codex:** las regresiones existentes reescriben sus capturas al ejecutarse. Por eso `git status` muestra modificados ~70 PNG sin relación con este cambio:
- `ritmo/imagenes/contrasena-equipo/`, `panel-plataforma/`, `negocio-etapa2/`, `planes-etapa3/`, `social-etapa4/`, `registro-whatsapp/` y `login-whatsapp/`;
- `apple-calendario-suscripcion.png`, `diseno-integrado-*`, `pwa-*`, `servicio-*`;
- ocho PNG nuevos `contrasena-equipo/0[1-4]-*-{light,dark}.png`.

Son diferencias de renderizado. Por indicación de Codex no se restauran ni se borran: **Codex las excluirá al guardar los cambios**. El alcance es la reparación, la prueba nueva, este informe y las dos capturas `acceso-dueno/04-*` y `05-*` (regeneradas en la ejecución final de Edge, con datos ficticios). La evidencia privada del iPhone queda fuera de Git. Los cambios de `ritmo/belleza/cuentas.js`, `dist/index.html`, `dist/belleza.html` y `dist/ritmo.html` que muestra `git status` son solo fines de línea (`git diff --stat` no muestra contenido).

## 6. Revisión priorizada

Se separa lo **probado** (ejecutado) de lo **estático** (lectura de código) y lo **pendiente**.

### P0 — corregido
1. **Panel del dueño retenido por el SW anterior** (sección 2). Probado en Edge y WebKit; falta el iPhone.

### P1 — capacidad: limitan el crecimiento en los planes gratuitos actuales (estático; sin prueba de carga)
2. **La sincronización descarga el salón completo cada 30 s por dispositivo visible.**
   - `ritmo/belleza/belleza.js:224`: `setInterval(... sync.sync(), 30000)` mientras la app está visible.
   - `ritmo/servidor/src/cuentas/repositorio.ts:17-31`: en modo cuentas, `snapshot(_since)` ignora el cursor y devuelve **todos** los objetos del salón: citas históricas, clientas y servicios con su foto base64 de hasta 48 000 caracteres.
   - `ritmo/servidor/src/cuentas/http.ts:67-70`: cada sondeo abre otra transacción para los anticipos y los cruza con `find` dentro de un bucle, O(objetos × anticipos).
   - **Impacto:** cada sondeo ejecuta ≈12 sentencias SQL (dos transacciones de BEGIN, `set_config`, `sesion_vigente` con escritura en `actividad_sesiones`, miembro, consulta y COMMIT) y descarga el salón completo de Supabase a Hyperdrive. Según la estimación, es el primer límite a medida que el salón acumula datos y dispositivos (sección 7). Codex confirmó en su revisión el snapshot completo y el sondeo de 30 s.
   - **Recomendación (no implementada; requiere diseño y aprobación):** responder «sin cambios» cuando la revisión no cambió, con una sola transacción. Después, enviar solo los cambios desde el cursor, conservando la retirada por permisos que motivó la lista completa.
3. **Explorar y Comunidad no paginan y envían fotos completas.**
   - `explorar_publico()` (migración `20261029233337_explorar_social_etapa4.sql:98`) devuelve todos los perfiles visibles con logo, portada y fotos de todos sus servicios.
   - `trabajos_publicos()` devuelve hasta 200 fotos (`LIMIT 200`, misma migración, línea ~105).
   - `/api/publico/explorar` (`ritmo/servidor/src/social/http.ts:34`) consulta `horarios_publicos` por servicio, hasta 20 por salón (N+1).
   - Cada respuesta pública pasa todas las fotos por `limpiarFotos` (`social/http.ts:29`), que decodifica y recodifica cada JPEG en el Worker. Workers Free permite 10 ms de CPU por solicitud: con varios salones con fotos es probable el error de recursos excedidos (1102). Sin medir.
   - No hay miniaturas; las listas usan las mismas imágenes de hasta 48 000 caracteres.

### P2
4. **Tope global de códigos de WhatsApp: 30/h y 150/día** para toda la plataforma (`ritmo/whatsapp/codigos.mjs:44-45`). Limita registros y accesos nuevos de clientas y equipo; el respaldo manual del panel lo mitiga. Estático.
5. **Tope de avisos por salón: 30/h, 150/día y 600/mes** (`ritmo/servidor/src/whatsapp-vinculado/reglas.ts:8,16`; decisión de Antonio). Con unos tres avisos por cita, alcanza para ~200 citas/mes con todos los avisos. Estático.
6. **Escritura en cada solicitud:** `sesion_vigente()` hace un UPSERT en `actividad_sesiones` en cada transacción (`20261028093000_login_whatsapp.sql:62-64`): dos escrituras por sondeo (WAL y filas muertas). Menor; afecta al disco (modo de solo lectura al 95 % de 2 GB), no a la cuota de 500 MB.
7. **Recarga automática del panel** en la ventana corta posterior a una publicación (límite de la corrección, sección 3).

### P3
8. **`plataforma_sesiones` (950 KB) no es crecimiento de inicios de sesión.** Guarda las llaves Signal cifradas del WhatsApp de códigos (`ritmo/whatsapp/baileys.mjs:7,40-41`). Hipótesis no verificada (Baileys no está instalado aquí): la mayor parte son pre-claves subidas al vincular, que se reponen al consumirse, más una sesión por cada dispositivo destinatario sin depuración. Crece con los teléfonos distintos que reciben códigos (orden de KB por destinatario). No afecta a corto plazo.
9. `acceso_solicitudes` y `registro_solicitudes` se depuran a las 24 h (`cuentas/acceso.ts:21`, `cuentas/registro.ts:41`). `acceso_sesiones` y `actividad_sesiones` no tienen depuración por tiempo: una fila pequeña por sesión. No ejecuté ni propongo la limpieza antigua; las sesiones reales del dueño deben conservarse.
10. **Cuatro pruebas de navegador desactualizadas.** Fallan igual con el `dist` base (sección 6.4): `calendario-pendientes`, `comunidad`, `whatsapp-solo-envios` y `whatsapp-vinculacion`. Hoy no hay regresión de navegador vigente para la vinculación de WhatsApp ni para los envíos automáticos.

### 6.4 Regresiones de navegador existentes (Edge), ejecutadas después del cambio

**11 de 15 aprobadas:** `buscador`, `calendario` (Apple .ics), `diseno`, `fotos` (dos dispositivos y sin conexión), `login-whatsapp`, `navegador` (sincronización y conflictos), `negocio-etapa2` (horarios), `neutro-etapa1`, `planes-etapa3`, `registro-whatsapp` y `social-etapa4` (Explorar, publicar, reservar, mis citas).

**4 fallan, y fallan igual con el `dist` base de ba0cdf1.** Lo comprobé restaurando temporalmente los seis archivos de `dist` a su versión base (contenido idéntico según `git diff --stat`), ejecutando las cuatro pruebas y regenerando después `dist` con `npm run build`. **Son fallos previos, no regresiones de este cambio:**
- `calendario-pendientes-navegador.mjs:14`: no encuentra el botón «Apple Calendar» en la pestaña Negocio.
- `comunidad-navegador.mjs:16`: `.post-photo` nunca aparece; el servidor de vista previa no tiene API ni rutas `/comunidad/*`.
- `whatsapp-solo-envios-navegador.mjs:52`: espera 1 verificación MFA y obtiene 0.
- `whatsapp-vinculacion-navegador.mjs:48`: no encuentra el botón «Mensajes de WhatsApp».

Todas se modificaron por última vez el 29/oct, antes de los cambios de interfaz posteriores. Hay que actualizarlas (fuera de este alcance). Mientras tanto, la vinculación de WhatsApp y los envíos no tienen regresión de navegador vigente.

### Áreas sin revisión profunda en esta sesión

No releí línea por línea: horarios 24 h, agenda simultánea, conflictos, planes y códigos manuales. Su evidencia son las pruebas anteriores (`negocio-etapa2`, `navegador`, `planes-etapa3`, `plataforma`, `fotos`, `calendario`). Aislamiento entre salones y roles: cubierto por `cuentas-rls`, `cuentas-permisos`, `plataforma` y `dueno-whatsapp` dentro de `npm test` (aprobadas). **Que las pruebas pasen no demuestra que todo funcione**: no hay prueba de carga ni prueba física.

## 7. Capacidad y pronóstico técnico

### 7.1 Dónde viven las fotos (verificado en código)

- **Todas en Postgres, no en Supabase Storage.** El 1 GB de Storage no se usa.
  - Servicio: `belleza_objetos.data->>'foto'` (JSONB), una por servicio.
  - Perfil: `publico_perfiles.logo` y `.portada` (texto).
  - Comunidad: `social_trabajos.foto` (texto).
- Formato: JPEG en data URL base64, **≤ 48 000 caracteres** (≈ 35 KB de JPEG), validado en el navegador y el servidor (`modelo.ts:39-44`, `social/fotos.ts:5`, CHECK en SQL).
- El navegador reduce a ≤ 800 px y baja la calidad 0.82 → 0.38 hasta caber (`belleza.js:60-68`). En la práctica, la mayoría queda **cerca del tope**; supuesto: 45 KB almacenados por foto, porque el base64 de un JPEG casi no se comprime.
- No se generan miniaturas. Cuerpo máximo de solicitud: 64 KB (`http.ts:22`, `cuentas/http.ts:74`).
- **Límites por salón:** una foto por servicio (sin tope de servicios); logo y portada; Comunidad, como máximo **30 fotos activas y 10 publicaciones al día** (migración etapa 4, línea 128).
- **Máximo aritmético solo de espacio:** 485 MB libres ÷ 45 KB ≈ 10 000 fotos. **No es una capacidad operativa ni un cupo garantizado.** Ese espacio se comparte con índices, citas, clientas, sesiones y demás tablas, y conviene dejar reserva (por ejemplo, no planear más del 70–80 % de la cuota). Supone 45 KB por foto sin compresión adicional en TOAST y no cuenta el WAL ni las filas muertas, que consumen disco aparte. Antes de llegar ahí actúan los límites de transferencia y de consultas (sección 7.4).

### 7.2 Cuotas oficiales vigentes (consultadas el 31/oct/2026)

| Servicio | Cuota relevante | Fuente |
|---|---|---|
| Cloudflare Workers Free | 100 000 solicitudes/día; 10 ms de CPU por solicitud HTTP y por cron; 128 MB; 50 subsolicitudes; los **estáticos son gratis e ilimitados**. No indica si el cron cuenta en las 100 000 diarias. | [Límites](https://developers.cloudflare.com/workers/platform/limits/) (act. 29/oct/2026), [Precios](https://developers.cloudflare.com/workers/platform/pricing/) (act. 2/oct/2026) |
| Hyperdrive Free | **100 000 consultas/día. Cuenta cada sentencia**, con o sin caché. ~20 conexiones al origen; reinicio a las 00:00 UTC; si se excede, las operaciones fallan. | [Precios](https://developers.cloudflare.com/hyperdrive/platform/pricing/) (act. 18/jun/2026), [Límites](https://developers.cloudflare.com/hyperdrive/platform/limits/) (act. 9/jun/2026) |
| Supabase Free | 500 MB de base de datos; **5 GB de egress, que incluye los datos devueltos por la BD**; 5 GB de egress en caché; 1 GB de Storage; 50 000 MAU; CPU compartida y 500 MB de RAM; **pausa tras 1 semana sin actividad**. Al pasar el egress: aviso, periodo de gracia y restricciones de uso justo. El modo de solo lectura depende del **disco** (95 % de 2 GB), no de los 500 MB. | [Precios](https://supabase.com/pricing), [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [Tamaño de BD](https://supabase.com/docs/guides/platform/database-size) |
| Railway Hobby | 5 USD/mes **con 5 USD de uso incluidos** (no se suman dos veces). RAM 10 USD/GB-mes; CPU 20 USD/vCPU-mes; volumen 0.15 USD/GB-mes; egress 0.05 USD/GB. Al llegar al límite duro, **todas las cargas del espacio se apagan**, incluido FiNeCi si comparte el espacio. Precios sin impuestos. | [Planes](https://docs.railway.com/reference/pricing/plans), [Límites de uso](https://docs.railway.com/reference/usage-limits) |

Fecha de consulta de todas: 31/oct/2026 (UTC). Las páginas de Supabase y Railway no muestran fecha de actualización.

### 7.3 Fórmulas y supuestos

Por salón, con la sincronización actual:

- Sondeos/día: `S = d × h × 120` (d = dispositivos visibles, h = horas visibles al día, 120 = sondeos por hora).
- Consultas Hyperdrive/día: `Q = 12 × S`. Base de la plataforma: cron cada 5 min = 288/día × consultas por ejecución (no medidas), más registros, logins, panel y Comunidad.
- Solicitudes Worker/día: `R = S` (más tráfico público).
- Tamaño del snapshot: `P = F × 45 KB + (citas acumuladas + clientas + servicios) × 0.5 KB` (F = servicios con foto; supuesto de 0.5 KB por objeto JSON).
- Egress Supabase/mes: `E = S × 30 × P`.
- Base de datos/año: `B = (F + 2 + T) × 45 KB + citas/año × 0.7 KB + clientas × 0.5 KB` (T = fotos de Comunidad).
- Espacio libre de BD: 500 MB − 15.1 MB (snapshot de Codex del 30/oct, base completa) ≈ **485 MB**.

| Supuesto por salón | Conservador | Medio | Exigente |
|---|---|---|---|
| Dispositivos visibles × horas/día | 1 × 4 | 2 × 8 | 4 × 10 |
| Citas/mes · clientas · servicios con foto · fotos de Comunidad | 100 · 300 · 8 · 5 | 300 · 800 · 15 · 15 | 800 · 2000 · 25 · 30 |
| S sondeos/día | 480 | 1 920 | 4 800 |
| Q consultas Hyperdrive/día | 5 760 | 23 040 | 57 600 |
| P snapshot a los 6 meses | ≈ 0.81 MB | ≈ 1.98 MB | ≈ 4.5 MB |
| E egress Supabase/mes | ≈ 11.7 GB | ≈ 114 GB | ≈ 650 GB |
| B base de datos tras 1 año | ≈ 1.7 MB | ≈ 4.4 MB | ≈ 10.3 MB |

### 7.4 Salones equivalentes según cada límite, por separado (código actual, estimación)

| Límite (cada fila por separado) | Conservador | Medio | Exigente |
|---|---|---|---|
| **Egress Supabase 5 GB/mes** (solo sondeos, a los 6 meses) | **≈ 0.4** | **≈ 0.04** | **≈ 0.01** |
| Hyperdrive 100 000/día (reserva de ~5 000 para cron y público) | ≈ 16 | ≈ 4 | ≈ 1 |
| Workers 100 000 solicitudes/día | ≈ 200 | ≈ 50 | ≈ 20 |
| Equivalente solo por almacenamiento, 485 MB (1 año) | ≈ 290 | ≈ 110 | ≈ 47 |
| Avisos WhatsApp 600/mes por salón (~3 por cita) | Suficiente (100 citas) | Al límite (300 > ~200) | Insuficiente |

**Umbral de egress, en lugar de una conclusión absoluta.** Con el escenario conservador (1 dispositivo, 4 h/día) hay 14 400 sondeos al mes, y 5 GB ÷ 14 400 ≈ **347 KB por respuesta**, sin contar otras salidas (Comunidad, panel, registros). La estimación de ≈ 11.7 GB/mes corresponde a un salón con ~600 citas acumuladas a 6 meses, 300 clientas y 8 fotos de servicio, un snapshot de ≈ 0.81 MB.

**Un salón nuevo o de uso ligero puede consumir mucho menos** y quedar dentro de la cuota gratuita al inicio. Por ejemplo, sin fotos y con 100 citas y 100 clientas, el snapshot ronda 100 KB, unos 1.4 GB/mes con ese uso.

**El riesgo de crecimiento sí es real:** el tamaño de la respuesta aumenta con cada cita, clienta y foto, y el número de sondeos con cada dispositivo y hora visible. Al pasar de ~347 KB con un dispositivo 4 h/día, o de ~87 KB con 4 dispositivos, se excede la cuota solo con sondeos.

**Hyperdrive** limita aparte, por el número de dispositivos y horas visibles, sin importar el tamaño. Las filas de almacenamiento son **equivalentes solo por espacio**: el sistema completo tiene límites inferiores por transferencia y consultas y no está probado con carga. Todo debe confirmarse con el panel de uso de Supabase y las métricas de Hyperdrive en cuanto haya un salón activo.

**Proyección hipotética, no medida**, si se corrigiera el punto 2 (cambio no implementado):
- respuesta «sin cambios» de pocos KB y unas 5 sentencias por sondeo sin cambios;
- el egress de los sondeos bajaría mucho, pero seguirían las descargas de cambios reales, Comunidad y el panel;
- solo por Hyperdrive, el orden de magnitud serían unos 40 / 10 / 4 salones, sin contar tráfico público ni otros cambios necesarios.

No es un cupo garantizado. Debe validarse con métricas después de implementar el cambio.

### 7.5 Clientas finales, Comunidad y concurrencia

- **Cuentas de clientas:** Supabase admite 50 000 MAU. El techo práctico es el **tope global de 150 códigos/día**: ≈ 4 500 verificaciones al mes, compartidas con el equipo y los registros.
- **Visitas a Explorar** con N salones y S servicios con foto:
  - Consultas: `1 + N × min(S, 20)`.
  - Egress: ≈ `N × (2 + S) × 45 KB`, más la CPU de `limpiarFotos`.
  - Ejemplo con 10 salones × 10 servicios: ≈ 101 consultas y ≈ 5.4 MB por visita. 5 GB alcanzan para ~900 visitas al mes, y es probable que se supere la CPU de 10 ms.
- **Concurrencia:** no es el primer límite.
  - Hyperdrive Free: ~20 conexiones al origen.
  - Cada solicitud abre su cliente (`nube/worker.mjs:23-37`).
  - Supabase usa CPU compartida y 500 MB de RAM.
  - Sin prueba de carga no se puede dar un número; no se realizó ninguna contra producción.
- **WhatsApp en Railway** (corregido tras la revisión de Codex). `ritmo/docs/SIGUIENTE-WHATSAPP.md:67,80` registra el servicio `agendappx-whatsapp` con **una réplica, límite 0.5 GB / 0.1 vCPU**. Es el registro verificado del despliegue anterior, no una consulta en vivo. La cifra de 0.25 GB de AGENTS es antigua. No se cambió ni se consultó nada en Railway.
  - **Consumo real:** no consultado; requiere el panel de Railway.
  - **Techo hipotético de recursos** si el servicio estuviera saturado 24/7 en sus límites: 0.5 × 10 + 0.1 × 20 = **7 USD/mes**, más egress a 0.05 USD/GB. Es un tope de recursos, no una estimación del consumo real (el uso típico suele ser menor) ni un cargo adicional automático.
  - **Mínimo Hobby:** 5 USD/mes que **incluyen** 5 USD de uso. Factura antes de impuestos = `5 + max(0, uso_total − 5)`. Los impuestos aplicables se suman aparte y no están estimados aquí.
  - **Compartido con FiNeCi:** el uso total incluye FiNeCi. Con el techo autorizado de 10 USD por ciclo, el uso conjunto debe quedar ≤ 10 USD. Si FiNeCi y este servicio se acercaran a sus topes, ese techo podría alcanzarse, y el límite duro apaga todas las cargas.
  - El margen real depende del consumo actual de FiNeCi, que no se conoce. Las cifras antiguas de uso no se usaron.
  - Cuántos números vinculados caben depende de la RAM por conexión Baileys, **no medida**.

### 7.6 Adquisición comercial: escenarios, no pronóstico

La capacidad técnica no equivale a ventas. Fórmula: `salones de pago/mes = contactos × % prueba × % activación × % pago`. Supuestos ilustrativos sin datos reales:

| Escenario | Contactos/mes | % prueba | % activación | % pago | Pruebas/mes | Activos/mes | Pagos/mes |
|---|---|---|---|---|---|---|---|
| Conservador | 30 | 10 % | 50 % | 30 % | 3 | 1.5 | ≈ 0.5 |
| Medio | 80 | 15 % | 60 % | 40 % | 12 | ≈ 7 | ≈ 3 |
| Optimista | 200 | 20 % | 70 % | 50 % | 40 | 28 | 14 |

Los primeros salones, con uso ligero, pueden caber en la cuota gratuita. Pero con la sincronización actual el consumo crece con los datos y dispositivos de cada salón (umbral de la sección 7.4), así que conviene corregir el punto 2 antes de captar varios salones activos y vigilar el egress desde el primero.

**Datos que faltan para pronosticar demanda:** prospectos reales y su origen, tasas de respuesta, prueba y conversión, abandono mensual, precio y plan elegido (el panel muestra 20 lugares de «fundadora»), dispositivos y horas de uso por salón, citas/mes, fotos por salón y estacionalidad.

### 7.7 Costos y métricas faltantes

Costo actual atribuible: Cloudflare 0 USD; Supabase 0 USD; Railway dentro del Hobby compartido (sin datos actuales). No se activaron planes, créditos ni recursos.

**Métricas reales necesarias** (requieren paneles con credenciales que no tengo):

- **Supabase:** egress del ciclo, tamaño de BD y de disco, conexiones.
- **Cloudflare:** consultas/día de Hyperdrive, solicitudes/día del Worker, CPU p50/p99 y errores 1102. La observabilidad está desactivada en `wrangler.jsonc`.
- **Railway:** uso del ciclo por servicio (Agendappx y FiNeCi) y límite duro configurado.
- **WhatsApp:** códigos por día y fallos.
- **Producto:** salones activos, dispositivos por salón y fotos por salón.

El informe semanal existente (desde 2026-10-27T19:11:09.551883275Z) no se reinició ni se duplicó.

## 8. Pasos pendientes

1. **Codex:** revisar el diff; excluir las capturas regeneradas ajenas (sección 5); confirmar en Git.
2. Hecho: `node --test ritmo/servidor/pruebas/dueno-actualizacion-navegador.mjs` recorre Edge y WebKit; con `SAFARI_PRUEBA=webkit`, solo WebKit.
3. Hecho por Codex: `ritmo/whatsapp` instalado con su lockfile; `npm test` 287/287.
4. **Pedir a Antonio la confirmación de publicación** de este conjunto (skill `ritmo-confirmar-deploy`). Tras publicar, verificar:
   - salud 200 y panel anónimo 401;
   - hashes de `sw.js`, `cuentas.js`, `plataforma/*`, `comunidad/actualizacion.mjs` y `recuperar-acceso/recuperar.js`;
   - Comunidad y registro intactos.
5. **Prueba física de Antonio**, en el mismo navegador donde vio el error. Hoy mismo, con la versión publicada: `/recuperar-acceso/` y luego `/plataforma/` (sección 3). Tras publicar esta corrección, basta abrir o recargar `/plataforma/` y esperar la recarga automática. Confirmar que entra con WhatsApp → código → panel, sin QR.
6. **Decisión de producto:** corregir la sincronización completa cada 30 s (P1-2) y paginar Explorar con miniaturas (P1-3) antes de captar salones. Son cambios de diseño fuera de este encargo.

## 9. Revisión final de Codex — 31 de octubre de 2026

- Revisado el diff de los siete archivos fuente y la prueba nueva: reparación del cliente residente, sin cambios de servidor, permisos, migraciones o banderas de envíos. Generados publicados revisados contra las fuentes. Las capturas ficticias nuevas a 390 px se inspeccionaron visualmente; las capturas ajenas quedan conservadas fuera del alcance a guardar.
- Repetido `npm test` con las dependencias existentes de WhatsApp: **287/287 aprobadas**, cero omitidas, 65 589 ms. No se cambiaron paquetes ni lockfiles.
- Repetida directamente la versión final de `pruebas/dueno-actualizacion-navegador.mjs`: **salida 0, Edge y WebKit aprobados**, reproduciendo primero el fallo antiguo y después la recuperación del mismo contexto, sin QR ni otra solicitud de código, con la sesión preservada. Agenda abierta con cola/foto/cookie conserva sus datos y no se recarga sola; el botón del panel instala la versión siguiente; salida de sesión y modo sin conexión comprobados.
- Proxy local: **cero intentos hacia Supabase** en ambos motores. Las 57 conexiones propias de Edge fueron rechazadas; WebKit no intentó conexiones externas. No se enviaron códigos reales ni se usaron cuentas reales.
- Contrastadas las cuotas relevantes con las fuentes oficiales enlazadas: 500 MB de BD y 5 GB de transferencia en Supabase Free, 100 000 sentencias/día en Hyperdrive Free, y mínimo Hobby con 5 USD de recursos incluidos. La revisión corrigió el límite registrado de Railway y retiró las conclusiones absolutas de capacidad. No se consultó facturación actual ni se hizo una prueba de carga; no hay una capacidad operativa o demanda comercial medida.
- **Aún no publicado.** Falta confirmación de Antonio para Cloudflare y luego la prueba física en su iPhone. Las mejoras de sincronización/directorio y las cuatro pruebas de navegador anteriores identificadas siguen pendientes; no se afirma que toda la plataforma esté libre de fallos.
