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
- Modelo de Belleza: un solo arreglo de objetos con `kind`: `servicio`, `clienta`, `cita`, `promo` y `grupo` (ver `buildExamples()` en `belleza.js`).

## Lo que falta (en este orden)
1. **PWA publicada**: https://belleza-production.up.railway.app. Manifest, íconos derivados de `imagenes/icono-1024.png`, service worker y fuentes locales. Publicación generada en `dist/pwa/`. Falta verificar la instalación en un iPhone físico.
   Vista previa pública sin backend: `https://caguamex.github.io/security-recorder/`, publicada desde `gh-pages`; usa almacenamiento local separado y no solicita tokens.
2. **Backend publicado y verificado en Railway** (`servidor/`, Node + TypeScript + Postgres): API con token, versiones, eliminaciones, idempotencia y sincronización incremental por cursor. `belleza/sincronizacion.js` conserva caché, cola y conflictos en `localStorage`. Proyecto dedicado `ritmo-belleza`, servicios `Belleza` y `Datos`. Consulta `docs/DESPLIEGUE.md` y `docs/USO.md`.
3. **WhatsApp oficial implementado; falta vincular el número del salón en Meta**: confirmación, recordatorio y gracias solo con consentimiento y dentro de una ventana gratuita abierta por la clienta. No enviar plantillas de pago bajo el presupuesto actual. Webhook firmado para las respuestas "1" (confirmar) y "2" (solicitar cambio), cola persistente y revisión cada 5 minutos en el mismo servidor. No hay credenciales de Meta configuradas ni mensajes reales enviados. Nunca uses librerías no oficiales de WhatsApp Web.
4. **Calendario privado publicado**: enlace `.ics` revocable en `/calendario/<token>.ics`, disponible en Más, para suscribirse desde Apple y Google Calendar. Excluye teléfonos, notas, cancelaciones y datos de ejemplo.
5. **Facebook**: se mantiene el flujo de un grupo por vez (copiar texto + abrir el grupo). Facebook no permite publicar en grupos por API.

Variables de entorno del servidor: `DATABASE_URL`, `APP_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`.

Autorización de Antonio del 25 de octubre de 2026: «Entrégame todo listo, sin costo, si algo requiere costo, que esté dentro de la cuota de railway, máximo 10 Dlls». Se permite este despliegue dentro del límite de consumo compartido existente de 10 USD por ciclo, sin aumentarlo ni modificar otros proyectos. No autoriza cuotas de Meta, otros planes ni servicios fuera de Railway. Los servicios de Ritmo tienen una réplica y límites de 0.25 GB / 0.1 vCPU cada uno. No afirmar que ese presupuesto es exclusivo de Ritmo ni que equivale a una tarifa fija. Las claves se guardan fuera del repositorio en una carpeta local protegida; nunca copiarlas a Git, mensajes, capturas o URLs.

Para la agenda se requieren `DATABASE_URL` y `APP_TOKEN`; se configura `PUBLIC_URL` y `TZ`, y `PORT` identifica el puerto HTTP. Los secretos de WhatsApp, incluido `WHATSAPP_APP_SECRET`, se configuran cuando esté disponible la cuenta oficial. Mantener el bloqueo de plantillas facturables.

Verificación del backend: `npm ci --prefix ritmo/servidor` y `npm test --prefix ritmo/servidor`. Pruebas de navegador: `npm run test:navegador --prefix ritmo/servidor` (Chromium de Playwright o `BROWSER_CHANNEL=msedge`). Las pruebas usan PostgreSQL local en WebAssembly, sin servicios externos. No activar despliegues ni recursos facturables sin autorización de Antonio.

## Reglas
- No cambies el diseño de las pantallas existentes sin pedirlo; compáralas con `imagenes/`.
- Cada cambio de código: corre las pruebas, regenera `dist/` y revisa la app en un navegador con ancho de teléfono (390 px).
- Nada de secretos en el repositorio.
