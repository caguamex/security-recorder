# Comunidad y acceso Neutro iOS — 31 de octubre de 2026

## Estado y alcance

Preparación local en `codex/agendappx-comunidad-acceso-ios`, desde `8bbf70e` (PR #23). Antonio mostró que Comunidad ocultaba el registro al detectar una sesión y que el acceso seguía usando la hoja genérica de la agenda. Esta corrección aún **no está publicada** y requiere su confirmación específica según `.agents/skills/ritmo-confirmar-deploy/SKILL.md`. La autorización anterior solo cubrió la reparación de actualización del panel del dueño.

Referencia vigente de Claude: [inicio.html en a91beea](https://github.com/caguamex/security-recorder/blob/a91beea/ritmo/ios/inicio.html) y `registro.html` de esa misma rama. Se conservan Neutro, SF/sistema, White/Dark, cápsulas, vidrio y áreas seguras aprobadas; no se sortea otra dirección visual ni se cambia de framework. Las reglas generales de diseño no sustituyen ese modelo explícito.

## Cambios

- **Registro en la barra de Comunidad:** «Regístrate como negocio · 30 días gratis, sin tarjeta» permanece visible con y sin sesión. Para visitantes conserva Inicio y la cápsula de registro. Con sesión de clienta conserva las cuatro pestañas y el buscador, y fija la invitación inmediatamente arriba, dentro del mismo grupo de navegación. Se reserva espacio inferior para que el contenido pueda desplazarse por encima de esos controles. La sesión no se cierra ni se cambia por mostrar o pulsar la invitación.
- **Entrada visible:** Entrar para visitantes; Mi cuenta con sesión. La selección existente entre clienta y negocio se conserva. Los cambios de sesión actualizan la barra sin duplicar sus controles.
- **Primero las publicaciones:** Social es la vista inicial, conforme al modelo aprobado. Hay buscador y chips de categorías; Explorar conserva el directorio. Una comunidad vacía muestra su estado real, sin poblarla con fotos o negocios de prueba. El acceso directo por slug sigue abriendo el salón. La ubicación pasa a los filtros para dejar claros el logo y Entrar/Mi cuenta. Se elimina la invitación duplicada al final del contenido porque ya está fija en la barra.
- **Acceso como pantalla propia:** Agendappx y botón Volver arriba; se ocultan el asa y el check genérico. En teléfono ocupa la altura disponible con sus áreas seguras, sin la agenda visible detrás. Campos completos con etiquetas encima, controles de al menos44px, letra de17px, contraseña visible/oculta y un botón principal. El código de WhatsApp permanece como alternativa. Recuperación queda en ayuda secundaria; los controles de sesión conservan sus reglas.
- **Estilo compartido:** `belleza/acceso-neutro.css` se utiliza en negocio y en el acceso de clienta de Comunidad, con los tokens de cada superficie. El empaquetador lo incluye en la PWA, la caché y la versión de un archivo. El registro dentro del acceso de clienta se llama «Crear mi cuenta» y no crea un salón; la invitación de negocio continúa en la barra pública.
- **Registro conservado:** siguen los cuatro pasos y el transporte vigente. La pantalla de acceso utiliza el mismo marco Neutro; no se modifican contraseñas, códigos, CAPTCHA, planes, roles, MFA ni RLS. Una sesión existente no se sustituye silenciosamente por un registro nuevo.
- **Enlaces directos:** el SDK podía emitir `agendappx:abrir-acceso` antes de que `belleza.js` instalara el manejador; entonces `/#registro` podía quedarse en Hoy. Se espera `DOMContentLoaded` solo si el documento aún está cargando. No se cambia el protocolo de Auth. La regresión nueva fuerza configuración rápida y descarga más lenta de la app para comprobar ambos enlaces directos.

## Verificación

- `npm test`: **287/287 aprobadas**, cero fallos ni omisiones, ejecución final56241ms, incluido el empaquetado de la hoja compartida.
- `comunidad-acceso-ios-navegador.mjs`: **Edge y WebKit aprobados**. Visitante y clienta, registro persistente, cambio de sesión, perfil, ubicación, chips, Social inicial, acceso y registro directos con carga desigual, White/Dark, 320/390/768/1440px. Login con SDK real sin sesión; estado de clienta simulado para reproducir la barra. Sin solicitudes de códigos ni creación de cuentas.
- `contrasenas-navegador.mjs`: aprobado tras corregir el enlace directo. Registro de cuatro pasos, contraseña, código ficticio, CAPTCHA, recuperación y contraseña temporal del equipo con SDK real y PostgreSQL local.
- `social-etapa4-navegador.mjs`: aprobado. Directorio y publicaciones de PostgreSQL local, reserva solicitada, fotos, seguir, guardar, comentar y perfil de clienta; White/Dark y390/768/1440px. Se permite elegir otra carpeta de capturas mediante `SOCIAL_CAPTURAS`, sin cambiar su comportamiento predeterminado.
- SDK y `dist/` regenerados desde fuentes; `git diff --check` sin errores. No se cambian paquetes ni lockfiles.
- `dueno-actualizacion-navegador.mjs`: **Edge y WebKit aprobados** con la versión nueva del SDK. Conserva la corrección del panel retenido en caché, la sesión, las fotos, la cola y las otras pestañas, sin peticiones hacia Supabase real.

Las capturas de `imagenes/comunidad-acceso-ios/` son locales. Las de `social/` incluyen una publicación y datos ficticios de la prueba, usando una foto ya autorizada de AB Beauty Room. No se publicaron ni cargaron esos datos en Supabase. Las capturas de error y el resto de recorridos no forman parte del conjunto a guardar.

No hubo migraciones, consultas de datos personales, OTP reales, mensajes, nuevas vinculaciones ni cambios en Railway, servicios, recursos, límites o FiNeCi. La versión de producción sigue siendo el Worker `b47b38fc-c9bb-400b-b7b1-f27b6f562c09` hasta autorización nueva.

## Capturas para revisión (390px)

- `imagenes/comunidad-acceso-ios/social/social-White.png` y `social-Dark.png`: Comunidad con publicación ficticia y registro fijo.
- `imagenes/comunidad-acceso-ios/comunidad-con-sesion-light.png` y `comunidad-con-sesion-dark.png`: barra de clienta conservada y registro visible.
- `imagenes/comunidad-acceso-ios/entrar-white.png` y `entrar-dark.png`: acceso con contraseña y alternativa WhatsApp.
- `imagenes/comunidad-acceso-ios/registro-light.png` y `registro-dark.png`: primer paso del registro con el mismo marco.
