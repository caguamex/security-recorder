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
