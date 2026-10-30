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
