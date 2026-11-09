# Comunidad de Agendappx — primera entrega

Antonio aprobó las muestras de celular y computadora y pidió empezar el 28 de octubre de 2026. Se inició en codex/agendappx-comunidad, desde codex/agendappx-siguiente-version. PR de la primera entrega: https://github.com/caguamex/security-recorder/pull/8 (borrador, base codex/agendappx-siguiente-version). La petición autoriza esta implementación; la publicación nueva y las migraciones conservan sus confirmaciones separadas. No se crearon servicios ni se modificaron bases. La demostración se publicó después de la autorización específica de Antonio para probar desde iPhone; ver registro final.

## Lo que ya se puede probar

Aplicación aislada en ritmo/comunidad/: Inicio, Buscar, Guardados, Mis citas, perfil y editor de trabajos. Diseño blanco/azul de las muestras aprobadas y apariencia oscura, navegación adaptable a escritorio y móvil con áreas seguras. El diseño de la agenda existente no se cambia.

El recorrido es foto → perfil → servicio → especialista → día y hora → resumen de reserva de demostración. Los horarios de muestra usan tres fechas relativas y rechazan horas pasadas y cruces locales del mismo especialista. Esto NO es un bloqueo transaccional del servidor ni una reserva real. Mis citas lo declara explícitamente. No hay anticipo, cobro, envío de WhatsApp ni sincronización con la agenda.

Búsqueda al escribir por título, nombre del negocio, servicio y categoría, normalizada sin acentos ni mayúsculas y con variantes singular/plural. Filtros combinables de precio y distancia ilustrativa. Publicaciones propias: selección de negocio/servicio de ejemplo, foto JPEG/PNG/WebP reducida localmente a JPEG, máximo 250000 caracteres y ocho trabajos, título/descripción y casilla obligatoria de permiso de la imagen. Se escapa el texto antes de mostrarlo. Guardados, seguidos, gustos, publicaciones y reservas de muestra persisten exclusivamente bajo agendappx.comunidad.demo.v1; Restablecer no toca claves de la agenda.

Datos de demostración explícitos: Distrito Barber, AB Beauty Room y Luna Nails; distancias, servicios, especialistas y precios en comunidad/modelo.mjs son ilustrativos. No se inventan reseñas o contadores de popularidad. La categoría Cabello tiene un vacío real hasta cargar trabajos relacionados. Las fotos proporcionadas por Antonio se usan solo en esta vista de ejemplo; ver comunidad/RECURSOS.md. No reutilizar esta semilla como negocios reales.

No se implementaron aún usuarios públicos, permisos de publicar por dueño, seguimientos compartidos, comentarios, reseñas, moderación, geolocalización, almacenamiento de imágenes en la nube ni reservas de producción. La vista no contiene claves ni pide APIs, y el servidor local solo sirve archivos de la carpeta comunidad.

## Revisar y reproducir

    node ritmo/herramientas/servir-comunidad.mjs
    node --test ritmo/servidor/pruebas/comunidad.test.mjs
    node ritmo/servidor/pruebas/comunidad-navegador.mjs
    node ritmo/herramientas/empaquetar-comunidad.mjs

La vista abre en http://127.0.0.1:4178, solo en esta computadora. El paquete está en ritmo/dist/comunidad/ y no se copia automáticamente a la PWA ni se despliega con el comando de empaquetado. Los archivos de imagen y fuentes son locales. Los módulos se sirven por HTTP; abrir index.html por file:// no ejecuta módulos en algunos navegadores.

Pruebas: normalización y filtros; exclusión de servicios inexistentes; disponibilidad por especialista y duración. Navegador aislado: búsqueda/vacío, guardados al recargar, perfil/servicio, reserva de ejemplo persistente, foto/consentimiento, HTML malicioso mostrado como texto, seguimiento, reinicio sin borrar otras claves, White/Dark a 390/768/1440 y ninguna solicitud externa. Capturas en imagenes/comunidad/.

Diseño: skill design-taste-frontend, Accent ladder, seed 914761682, conservando paleta/tipografía aprobadas. Se adopta la cabecera con búsqueda y las fotos dominantes de la propuesta de Antonio sobre la variante sin cabecera sugerida por la hoja. Cada trabajo es el acceso directo a su servicio. Inter local, marca Agendappx, navegación inferior y env(safe-area-inset-*) en iPhone. Inspección automática final: 0 errores y 0 advertencias; lint: 0 errores y 0 advertencias. Capturas verificadas; no declarar probada una instalación real en iPhone.

## Etapas siguientes

1. **Acceso y propiedad.** Terminar el acceso manual y su recuperación, alta de negocios e invitación de equipo con roles reales. El arranque privado del propietario y el registro manual siguen pendientes del encargo anterior; esta comunidad no los sustituye ni los marca terminados. Cada negocio administra solo sus publicaciones. El visitante puede explorar sin ver las tablas privadas.
2. **Perfiles y catálogo públicos.** DTO público explícito y mínimo con nombre comercial, ubicación publicada voluntariamente, servicios vigentes, precio/duración y portafolio aprobado. Separar borrador/publicado/oculto; nunca copiar snapshots privados, teléfonos de clientas, notas, pagos, tokens o feeds privados. Revisar RLS entre salones antes de habilitar escrituras.
3. **Publicación de trabajos y medios.** Persistencia real ligada al dueño, permiso de las personas fotografiadas, reporte/ocultar, validación MIME/tamaño, límites por negocio y borrado. Elegir almacenamiento con cuota verificada antes de activarlo. R2 u otro recurso con facturación potencial necesita autorización concreta de costo; no crear infraestructura por suponer que será gratuita.
4. **Disponibilidad y solicitudes reales.** Calcular en el servidor desde la agenda existente: zona horaria del local, duración, descansos, ausencias y citas activas. La respuesta pública solo contiene espacios libres. Serializar/coordinar el bloqueo para evitar reservas simultáneas; comprobación al confirmar, idempotencia, caducidad de apartados y límites antibots. Conservar reglas y revisión humana del anticipo. No liberar horarios ni cobrar automáticamente.
5. **Comunidad compartida.** Seguimientos y guardados por identidad, reportes y moderación, reseñas solo tras visitas verificadas y controles de publicación. Comentarios/mensajería solo tras definir su alcance. Añadir notificaciones reutilizando la conexión propia autorizada y consentimiento, nunca FiNeCi.
6. **Lanzamiento gradual.** Comprobar dos negocios y dos clientes sin cruces, reservar simultáneamente un mismo espacio, cancelar/reasignar, uso sin conexión y reconciliación, consentimiento de medios y borrado, rendimiento con fotos y costo real. Pedir la confirmación de migración y de publicación correspondientes antes de habilitar producción.

Restricciones vigentes: conservar el presupuesto compartido de Railway de 10 USD/ciclo, no ampliar servicios, no renombrar infraestructura ni comprar dominios, no tocar FiNeCi. No afirmar costo cero para una comunidad pública a escala sin medir uso y almacenamiento. Las autorizaciones anteriores de publicación del login no cubren esta comunidad.


## Demostración publicada para iPhone — autorización del 28 de octubre

Antonio confirmó «Sí, hazlo» a publicar únicamente la demostración. Dirección: https://ritmo-belleza.antonio-t-22.workers.dev/comunidad/. Cloudflare versión 7a8a8787-4270-4550-a26b-fe320f25e395, código de preparación 6991d86, PR #8. El modo manual de acceso, registro nuevo y reservas reales siguen pendientes y no se activaron por esta publicación.

Se añadió preparar-comunidad-cloudflare.mjs y los comandos build:comunidad/deploy:comunidad de ritmo/nube. Copian los archivos existentes de dist/pwa a una carpeta de preparación ignorada y agregan comunidad como subdirectorio. No reconstruyen la agenda, no agregan la demostración a la lista de precaché de su service worker y no cambian API ni esquema. El despliegue conserva las variables con --keep-vars y los secretos vigentes, incluido el hash de recuperación del propietario. No usar --secrets-file antiguo, que podría reemplazar ese hash con otro vencido.

Verificación: 61 archivos de la agenda conservados idénticos antes del despliegue. Después, las huellas públicas de index.html, belleza.js, cuentas.js, sincronizacion.js y sw.js siguieron exactamente iguales. /comunidad/, su módulo/fotografía y /salud respondieron 200. El Worker y las rutas de archivos existentes se conservaron. Los recursos de comunidad se sirven como archivos estáticos sin nuevos bindings, procesos o planes. Referencia de facturación: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/.

Prueba del enlace publicado: comunidad-publicada.mjs, contexto aislado Chromium móvil de 390px, sin sesiones reales. Fotos visibles, búsqueda, guardados al recargar, foto propia con consentimiento, reserva local y convivencia con el service worker raíz correctos; cero llamadas a APIs, cero errores de JavaScript. Las fotografías fuera de la pantalla se comprueban al cargarse, pues usan carga diferida. WebKit no estaba instalado: no declarar validación de Safari físico hasta la confirmación de Antonio. Las acciones de prueba se guardaron solo en el contexto descartado del navegador.

Para conservar esta ruta en futuras publicaciones, preparar primero la versión aprobada de la agenda y después usar deploy:comunidad desde la rama que incluya estos recursos. El despliegue regular anterior no incorpora automáticamente comunidad. La autorización de esta demostración no publica ni termina el backend de la comunidad.
