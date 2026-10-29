# Vista previa Neutro iOS de Agendappx

Propuesta navegable independiente, preparada a petición de Antonio para verla desde iPhone. Es una vista de diseño de las cuatro etapas, no una acreditación de funciones nuevas implementadas en la app real. La rama parte exactamente de a5d989a del PR #10; referencias aprobadas de Claude 28038cbae3a901eee24019ab89aa9cb76f19800c, PROMPT-DISENO-IOS.md completo y prototipos ios/negocio/explorar/social/planes.

Incluye 24 vistas, hojas de citas, servicio, clienta, publicación, promoción, equipo, registro y MFA; White/Dark, transparencia reducida, áreas seguras, controles nativos y navegación flotante. Datos ficticios calculados desde arreglos locales. Fotos originales proporcionadas por Antonio, copiadas de belleza/trabajos. Sin Pexels, librerías remotas, API, clave, acceso real, creación de cuentas ni envío de mensajes. Solo se guarda el modo visual en una clave local exclusiva de la propuesta; el resto vive en memoria. No registra service worker ni reemplaza los archivos de la app o Comunidad.

## Cómo probar

Abrir la propuesta en Safari. Hoy, Agenda, Clientas y Negocio se recorren desde la barra; el círculo + abre acciones. Negocio → Modo cliente lleva a Explorar; Negocio → Apariencia cambia White/Dark. Negocio → Ver como cliente abre el perfil, sus cuatro pestañas y la solicitud ilustrativa de cita. Las pantallas muestran que los datos y acciones son de ejemplo. No escribir claves ni códigos reales.

## Verificación

Ejecutar `node ritmo/herramientas/verificar-neutro-ios.mjs` con las dependencias de servidor existentes. Navegador Edge aislado; servidor HTTP solo local y solicitudes externas bloqueadas. Comprueba las 24 vistas en White y Dark a 390px, anchos 768/1440, imágenes, búsqueda/vacío, Nueva cita, selección de servicio y horario, modo visual, transparencia y cero errores de JavaScript. Capturas en ritmo/imagenes/neutro-ios/. La revisión visual sigue el modelo Neutro iOS: fondo F2F2F7 / 000, celdas FFF / 1C1C1E, títulos 33px, listas 22px, botones negros/blancos, vidrio solo en flotantes y colores de servicios suaves. Se conservan las excepciones expresamente solicitadas frente a la guía genérica de diseño: vidrio, títulos de 33px y radios de listas iOS.

## Publicación de la propuesta

Destino: subdirectorio neutro-ios/ del GitHub Pages público ya existente. La petición de un enlace para iPhone autoriza únicamente publicar esta propuesta separada. Confirmado Pages gratuito de repositorio público, fuente gh-pages, sin crear servicios ni activar planes. Se añaden exclusivamente los archivos de esa subcarpeta conservando el árbol del resto de gh-pages. Sin cambios de Cloudflare, Railway, Supabase, datos, WhatsApp o FiNeCi. El PR de etapa 1 permanece en borrador hasta implementar y verificar el cambio de apariencia en la app; no mezclar esta publicación de propuesta con autorización de despliegue de la app real.


## Resultado de publicación — 29 de octubre de 2026

Propuesta publicada y verificada: https://caguamex.github.io/security-recorder/neutro-ios/ . Fuente ae4655ea328a596af89103595262e7625deb57e7, PR #11 encadenado al #10. Commit de distribución de gh-pages 78e9a3ea26c6a22f1f9991359735f56f0ea7e4ee, construcción built sin errores. Los nueve archivos responden 200 y su huella de blob coincide exactamente con el commit fuente (incluida la normalización de líneas de Git). La URL sin parámetros responde 200; la salud de la aplicación de Cloudflare permanece 200. Pruebas aisladas: 24 vistas en dos modos, móvil/tablet/escritorio, cero errores y cero solicitudes externas. Capturas revisadas de Hoy, Agenda, Mi negocio, perfil y Nueva cita. La prueba física en Safari de Antonio queda pendiente. No se publicó el nuevo diseño en la aplicación real.
