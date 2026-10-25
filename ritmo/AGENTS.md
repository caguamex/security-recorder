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
1. **Desplegar como PWA instalable en iPhone**: crea `manifest.webmanifest` e íconos (usa `imagenes/icono-1024.png`), un service worker para que funcione sin conexión y un servidor estático. Debe poder "Agregarse a pantalla de inicio" desde Safari.
2. **Backend en Railway** (`servidor/`, Node + TypeScript + Postgres): API con token para los cinco tipos de objeto y la sincronización de la app con ella (conserva `localStorage` como caché sin conexión).
3. **WhatsApp automático** con la Cloud API oficial de Meta: plantillas de confirmación, recordatorio 24 h y gracias; webhook para las respuestas "1" (confirmar) y "2" (cambiar); tarea programada cada 5 minutos. Nunca uses librerías no oficiales de WhatsApp Web.
4. **Calendario**: enlace `.ics` privado en `/calendario/<token>.ics` para suscribirse desde Apple y Google Calendar.
5. **Facebook**: se mantiene el flujo de un grupo por vez (copiar texto + abrir el grupo). Facebook no permite publicar en grupos por API.

Variables de entorno del servidor: `DATABASE_URL`, `APP_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`.

## Reglas
- No cambies el diseño de las pantallas existentes sin pedirlo; compáralas con `imagenes/`.
- Cada cambio de código: corre las pruebas, regenera `dist/` y revisa la app en un navegador con ancho de teléfono (390 px).
- Nada de secretos en el repositorio.
