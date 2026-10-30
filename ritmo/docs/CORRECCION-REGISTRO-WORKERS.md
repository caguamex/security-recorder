# Corrección del registro en Cloudflare Workers

30 de octubre de 2026. Rama `codex/agendappx-captcha-workers`, encima del cierre del PR #18 (`8a72fa4`). Antonio compartió la captura con Turnstile verde y «No se pudo comprobar la seguridad». No había solicitudes de registro/OTP en la base; el WhatsApp estaba conectado.

## Causa reproducida

`RegistroWhatsApp` y `Contrasenas` guardaban `fetch` como propiedad y lo invocaban mediante `this.red(...)`. El motor nativo de Workers exige un receptor compatible y lanza `Illegal invocation` antes de realizar la solicitud. El catch lo convertía en 503 de seguridad, antes de crear un ticket o pedir el OTP. Los simuladores de Node y sus funciones flecha no reproducían esta condición de workerd.

Se comprobó primero en workerd local: llamada original = Illegal invocation, llamada ligada al ámbito global = respuesta de red simulada. Después, con las clases de producción sin corregir, `registro-workers.mjs` reprodujo exactamente el 503 de la captura. Una petición pública con un token deliberadamente inválido también respondió 503 antes de publicar, sin crear cuentas ni códigos.

Referencia primaria: [errores de invocación de Workers](https://developers.cloudflare.com/workers/observability/errors/#illegal-invocation-errors). La validación del lado servidor sigue siendo obligatoria y se conserva: [Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Reparación mínima

En ambos constructores, el transporte predeterminado pasa a `fetch.bind(globalThis)`; la función inyectada de pruebas se conserva. No se desactiva ni debilita Turnstile, MFA, consentimiento, límites, RLS, verificación del teléfono ni aislamiento de la plataforma. Sin cambios visuales, de base, recursos, planes, secretos ni Railway.

## Verificación

- `npm test` en `ritmo/servidor`: **268/268**.
- `BROWSER_CHANNEL=msedge node pruebas/contrasenas-navegador.mjs`: aprobado, incluidos registro de cuatro pasos, CAPTCHA y restablecimiento con AAL2.
- `node ritmo/servidor/pruebas/registro-workers.mjs`: cuatro escenarios con clases reales y motor workerd: registro válido, CAPTCHA rechazado de registro, CAPTCHA rechazado de acceso y respuesta Auth. Toda la red saliente está sustituida: no se valida CAPTCHA real ni se envían códigos o se crean cuentas.
- Para la prueba workerd deben estar instaladas las dependencias de `ritmo/servidor` y `ritmo/nube`. Utiliza Miniflare instalado por Wrangler y su adaptador de opciones v4→v5; no modifica dependencias compartidas ni requiere servicios externos.
- Paquete de Cloudflare preparado con dry-run aprobado. Archivos generados regenerados, sin resolverlos a mano.

Antonio autorizó explícitamente publicar esta reparación solo en Cloudflare. Registrar aquí el despliegue y la comprobación posterior antes de declararla publicada. La recepción física del código sigue requiriendo que Antonio lo solicite desde su registro; no solicitar códigos por él ni confirmar teléfono/MFA por operación.

## Publicada y comprobada

Con la respuesta explícita «Sí, publica la reparación en Cloudflare», se publicó el código `7e9dc20` en Worker **1a2ba21b-467c-458d-9056-77299bcf9422**, misma URL y `--keep-vars`. No hubo archivos estáticos nuevos: la reparación es del servidor y no exige actualizar el service worker.

La misma comprobación pública con token deliberadamente inválido cambió de **503** («No se pudo comprobar la seguridad») a **400** («Vuelve a completar la verificación de seguridad»), que es el rechazo correcto de Siteverify. Así se verificó que la llamada real ya llega a Cloudflare sin crear cuentas ni pedir códigos. No confundir esta comprobación negativa ni los casos válidos con red simulada con la recepción física de un OTP.

Comprobación adicional de producción con Edge: inicio público sigue activo, registro de cuatro pasos disponible, panel sin sesión devuelve 401 y los cuatro archivos del panel/SDK coinciden por SHA-256. Sin errores JS. La lectura inmediata de la base confirmó cero tickets/OTP/salones y reserva del propietario intacta; WhatsApp conectado y respaldo manual activo. No se modificó Railway ni la base en esta reparación.

Se pidió a Antonio abrir de nuevo `/#registro` para obtener una validación reciente, solicitar una sola vez su código y responder qué ocurre. Esa verificación física sigue pendiente de su respuesta. No volver a borrar cuentas ni reasignar el dueño ante un error posterior.

## Segunda incidencia: identidad ya reservada en Supabase

La siguiente captura cambió a «No se pudo preparar la cuenta». Se comprobó que Turnstile ya había pasado: había un ticket de registro sin verificar y todavía ningún OTP. Los logs del intento mostraron Auth Admin HTTP 422 / `phone_exists` y la función devolviendo 503. La fuente publicada v3 coincidía exactamente con el archivo local; no era un problema de claves ni de publicación incompleta.

La función elegía `e.code || e.error_code`, pero en la respuesta REST real `code` es el número HTTP 422 y `error_code` contiene `phone_exists`. La prueba anterior simulaba `code:'phone_exists'`, por lo que no detectaba el fallo. Al reservar previamente la identidad del dueño, ese caso se volvió obligatorio en su primer registro. Referencia primaria: [esquema de errores Auth Admin](https://github.com/supabase/auth/blob/master/client/admin/client.go).

Reparación: leer primero `error_code` y admitir `code` solo cuando es texto. Únicamente `phone_exists` y `user_already_exists` permiten continuar de manera idempotente. El resto de errores 422 se sigue rechazando. La prueba usa ahora la respuesta real con código numérico, comprueba compatibilidad y rechaza errores diferentes o sin clasificación; no permite confirmar ni modificar la cuenta existente.

- Se reprodujo primero el 503 con la prueba corregida; después de reparar, **268/268 pruebas aprobadas**.
- Antonio autorizó explícitamente «Sí, corrige Supabase y libera el intento fallido».
- Se respaldó la función previa v3 fuera de Git y publicó `agendappx-registro` **v4 ACTIVE**, con la misma autenticación HMAC y `verify_jwt=false` anterior. No cambió ningún secreto, plan, Worker ni Railway.
- Prueba real firmada del propósito `alta-whatsapp-v1` sobre la identidad ya existente: **HTTP 200 / preparada:true**, mismo UUID y teléfono sin confirmar antes/después, sin contraseña nueva, OTP ni sesión. No se crearon cuentas de prueba.
- Se caducó únicamente el ticket fallido no verificado/no completado y su apartado de usuario; no se borró la cuenta, se reasignó propiedad ni se reiniciaron datos. La intervención se limitó al intento identificado en los logs y aprobado por Antonio.
- Se pidió a Antonio repetir el registro y solicitar su código una vez. La recepción física del OTP queda pendiente de su respuesta. No declarar que ya lo recibió basándose en la preparación correcta de la cuenta.

## Confirmación inicial con las altas de Supabase cerradas

La captura siguiente ya mostraba «Escribe el código», pero la solicitud falló antes del hook. Lectura del intento: ticket de registro preparado, solicitud OTP fallida sin `hook_hash` ni `codigo_hash`, sin respaldo manual; WhatsApp conectado. Los logs de Auth mostraron `signup_disabled` (HTTP 422) en `/auth/v1/otp`.

Auth trata un usuario existente con teléfono sin confirmar como alta al usar `/otp`, incluso con `create_user:false`. Al conservar las altas públicas cerradas, rechaza esa llamada antes del hook. La API `/resend` con `type:'sms'` permite solicitar confirmación de un teléfono **ya existente**, sin crear un usuario ni confirmar el teléfono por operación. El SMS es el tipo de confirmación interno de Auth; el hook existente sigue entregándolo por WhatsApp.

Fuentes primarias: [implementación de OTP](https://github.com/supabase/auth/blob/master/internal/api/otp.go), [confirmación de cuentas existentes](https://github.com/supabase/auth/blob/master/internal/api/resend.go). No cambiar `disable_signup`, autoconfirmar usuarios, pedir una contraseña a Auth por operación ni abrir un registro alternativo.

Preparación: el proxy intenta la confirmación mediante `/resend` **solo** después de la respuesta explícita 422/`signup_disabled`, en WhatsApp, con registro de Agendappx habilitado y sin `phone_change`. Usa el mismo ticket y los límites vigentes. No repite solicitudes aceptadas, límites, errores ambiguos ni fallos de red. El hook firmado vuelve a exigir solicitud reciente y guarda la huella del OTP, que se verifica antes de admitir la sesión. El error de Auth se normaliza dando prioridad a `error_code`, conservando la respuesta indistinguible de cuentas inexistentes y el HTTP 429 de límites.

Pruebas nuevas `registro-confirmacion.test.mjs`: entrega única por hook simulado con el mismo ticket, OTP verificable, rechazo sin reintentos ante respuesta incierta/límite/otra causa, exclusión de correo y phone_change, registro deshabilitado y fallo del reenvío. El navegador de contraseñas representa ahora altas cerradas y teléfono inicialmente sin confirmar; exige una sola confirmación inicial antes de completar el registro. Todas las llamadas de prueba están simuladas y no mandan mensajes reales.

Esta etapa está preparada, todavía no publicada. Requiere autorización específica para actualizar el Worker; la función Supabase v4 y las demás configuraciones permanecen como fueron publicadas. No caducar ni liberar el ticket nuevo válido del usuario: puede continuar solicitando desde la misma pantalla una vez publicada la corrección.

Verificación de la preparación: **279/279** (`npm test`, incluidas once comprobaciones nuevas), Edge con confirmación inicial y recorrido posterior completos, cuatro casos workerd y empaquetado Cloudflare dry-run aprobados. No hubo códigos reales ni cambios de producción en estas pruebas. El mock de navegador ya exige `signup_disabled` antes de la primera confirmación y una sola llamada a `/resend`.

### Publicación de confirmación inicial

Antonio respondió «Sí, publica la corrección del envío». Se publicó `c01675f` en Worker **1a9f4aa9-a53a-487c-a949-6c4bd2082e62**, con `--keep-vars`; no hubo archivos estáticos nuevos. No cambió Supabase Auth/configuración/base, la función v4 ni Railway. Las altas públicas siguen cerradas.

Verificación final con Edge: inicio público=true, registro de cuatro pasos, panel anónimo 401, cuatro archivos publicados coincidentes por SHA-256 y sin errores JS. Una validación deliberadamente inválida se rechaza correctamente con 400, sin crear tickets/OTP. La lectura de la base confirmó la identidad reservada sin confirmar/sin sesiones, ticket reciente aún válido y WhatsApp conectado con respaldo manual activo. No se solicitó un código por la persona durante la comprobación.

Se indicó a Antonio continuar **desde la misma pantalla «Escribe el código»**, pedir una vez el código y no cerrar/reiniciar el registro. Se espera su respuesta para confirmar entrega física y verificación. La publicación y las pruebas simuladas no demuestran que su iPhone haya recibido un mensaje. No liberar su ticket ni borrar cuentas por inercia.
