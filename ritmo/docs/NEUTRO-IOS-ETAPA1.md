# Neutro iOS — etapa 1 publicada

Antonio aprobó la vista del PR #11 y pidió cuatro correcciones: horas siempre HH:mm con selectores en vez de input time; Nueva cita con carrusel de fotos, fecha/hora en pastillas y switch; Apariencia solo en Mi negocio/Perfil; chips de especialistas, lunes–domingo y simultáneas lado a lado. Se implementan en la propuesta y en la app real. Rama codex/agendappx-neutro-ios-etapa1, padre exacto 559c3a6bdae7510e0252f91f0115ecd315a19fb9 del PR #11. No actualizar gh-pages, Cloudflare, Railway o Supabase hasta recibir autorización de publicación de este conjunto.

## Alcance real

- Apariencia Neutro iOS de las pantallas existentes: agenda/detalle/nueva cita, clientas, servicios/buscador/fotos, promociones, Facebook, negocio/ajustes, login WhatsApp/MFA/registro/equipo/invitaciones y calendarios/WhatsApp. Se retira el bloque 3D y los emojis de navegación; quedan cuatro pestañas Agenda, Clientas, Servicios y Negocio, con + separado. Hoy y la navegación completa de etapa 2 todavía no se añaden.
- White/Dark abre únicamente en Mi negocio → Apariencia. Las preferencias existentes se conservan, con Neutro como clave histórica clasico y las paletas opcionales sin relieve. No se migran ajustes. Reduce transparencia del sistema y opción local del dispositivo, controles de 44px/área ampliada para switches, áreas seguras y movimiento reducido. Icono PNG negro con calendario blanco en 180/192/512, generado desde SVG propio.
- Ningún input time en los archivos fuente de app/propuesta. Selectores HH:mm como los del prototipo Mi horario, con opciones de cuarto de hora para apertura/cierre y preservación de valores existentes no redondos. Nueva cita ofrece exactamente la disponibilidad anterior (paso de 30 minutos); no se modifica el algoritmo de disponibilidad. La hora escogida se guarda en el mismo campo start. Aviso del día y marcas de tiempo también usan 24 h.
- Nueva cita conserva los identificadores, fotos optimizadas, creación de clienta/consentimiento, datos, notas y validaciones. Foto y nombre del servicio en carrusel desplazable, fecha/hora juntas y switch de confirmación. En cuentas reales, los avisos del salón continúan bloqueados como antes; la etapa no activa envíos ni cambia banderas de Railway. El switch verde en capturas corresponde exclusivamente al flujo manual de pruebas local.
- Agenda mantiene layoutColumns del núcleo, usado también antes: agrupación de cruces y anchuras por columna, sin superposición visual. Semana y mes empiezan en lunes. Chips filtran solo citas que la cuenta ya puede leer. Nombres de equipo proceden de la ruta existente de miembros para Admin/MFA; no se agrega API ni se amplían permisos. Caché de etiquetas separada por usuario/salón/rol; para otros roles solo se usan datos ya visibles y etiquetas de respaldo, sin consultar el directorio Admin.
- Comunidad se integra selectivamente desde PR #8 (estáticos, herramientas y pruebas), con diseño Neutro iOS y Apariencia en Perfil. Conserva su demostración local: no son reservas, reseñas ni publicaciones reales. No se fusiona su antigua base de Auth. Perfil público real, Mi horario funcional, Hoy, estadísticas/planes y Social real siguen en sus etapas 2–4; su diseño de muestra permanece en la propuesta.

## Conservación y empaquetado

No hay SQL, cambios de esquema, nuevos permisos, credenciales, infraestructura, recursos ni mensajes reales. FiNeCi intacto. La PWA mantiene id/scope/start_url, cachés, aviso de actualización con confirmación y protección del formulario, cola sin conexión, sincronización por cuenta, fotos y calendario. Las copias históricas de capturas y los dos archivos ajenos modificados se conservan. El paquete de Cloudflare ahora prepara conjuntamente PWA + Comunidad y conserva secretos con --keep-vars; build usa únicamente --dry-run. No ejecutar deploy hasta confirmación.

## Verificaciones

- 224 pruebas automáticas del servidor/núcleo/comunidad, cero fallos. No se cambiaron implementaciones de Auth, RLS ni modelos del servidor.
- Diseño: cinco preferencias × White/Dark, secciones y Nueva cita, recarga y sincronización de apariencia.
- App real con PostgreSQL local: dos especialistas con citas a la misma hora, columnas sin choque, filtros, semana lunes–domingo, carrusel con fotos cargadas, selectores HH:mm, guardado y sincronización de apertura/cierre y de una nueva cita; transparencia manual y anchos 390/768/1440. El directorio de nombres se simula solo en esta prueba visual; las pruebas de RLS existentes validan la API real en local.
- Regresiones de navegador local con SDK real y proveedores simulados: login WhatsApp, MFA, registro/invitaciones de dos identidades/salones, buscador, fotos y eliminación, .ics/Apple, actualización y borrador protegido, sin conexión/recarga/sincronización entre dispositivos y paneles/pagos de WhatsApp. Ningún teléfono real.
- Comunidad: búsqueda, guardados, perfil/servicio, reservas locales, foto/consentimiento, escape de HTML, seguimiento y reinicio aislado. White/Dark en 390/768/1440, sin peticiones externas.
- Propuesta corregida: 24 vistas en White/Dark, búsqueda, formulario, horarios y apariencia; sin red externa. Cloudflare compila con 83 archivos, solo dry-run.

Capturas actuales en ../imagenes/neutro-etapa1/ y galería NEUTRO-IOS-CAPTURAS.html. Las capturas de fixtures se identifican como pruebas locales, no son datos del salón. Safari físico y despliegue se comprobarán después de la autorización; no confundir la simulación de proveedores con un envío físico.

## Cómo revisar y publicar después

Ver primero las capturas. La vista pública del PR #11 conserva aún la versión anterior. Si Antonio confirma expresamente, actualizar la carpeta neutro-ios/ de GitHub Pages desde vista-neutro-ios y publicar el paquete combinado en el Worker existente con keep-vars. No aplicar migraciones ni publicar Railway. Comprobar hashes, salud, bloqueo de datos sin identidad y que Comunidad conserve su naturaleza de demostración. Verificar el aviso de actualización desde la versión anterior con una sesión de prueba aislada; no pedir OTP/TOTP en el chat.


## Publicación autorizada — 29 de octubre de 2026

Antonio confirmó «Publica todas las etapas». Esta confirmación cubre la publicación del diseño revisado y las siguientes etapas conforme estén implementadas y verificadas; no elimina la confirmación separada anterior para migraciones ni autoriza nuevos costos.

Etapa 1 publicada desde 7ae2e674a07c1867fad388421410aa39f7b3b055, Worker ccc3d5d0-1d8c-4906-9e35-ffdb3e84e40b. Paquete combinado de 83 archivos y keep-vars. Salud 200, configuración de cuentas/registro/WhatsApp habilitada y correo apagado, contexto sin identidad 401, CSS Neutro y /comunidad/ 200. Sin migración, cambios de datos, Railway ni banderas de envíos. La vista pública para iPhone se actualizó solo dentro de neutro-ios/, commit gh-pages 477e5797f7e6ec7969e866405643d87485c3bae2; los nueve archivos coinciden con sus blobs de origen.

URL real: https://ritmo-belleza.antonio-t-22.workers.dev/
Vista de diseño: https://caguamex.github.io/security-recorder/neutro-ios/

Etapas 2, 3 y 4 siguen en desarrollo. No están publicadas por el hecho de haber recibido aprobación.
