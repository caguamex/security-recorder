# Buscador de servicios — 28 de octubre de 2026

Antonio pidió incorporar la referencia `ritmo/imagenes/buscador-servicios.png` de la rama `claude/es-posible-esto-tjimmb`, commit `9b29cf7`. Agendappx incluye un campo de búsqueda y accesos rápidos Uñas, Pestañas, Cejas y Cabello. Filtra al escribir por nombre o categoría, ignora mayúsculas/acentos y acepta singular y plural; las coincidencias se resaltan, se agrupan por categoría y muestran precio, duración y personas asignadas. Conservar el segmento Promociones, edición, fotos y carrusel con acción Agendar.

El servidor entrega exclusivamente nombres y listas de servicios asignados de miembros activos del mismo salón, tras verificar sesión y membresía. No entrega contactos, teléfonos, correo ni datos de otro salón. Si no hay nadie asignado se muestra «Sin asignar»; si los datos del equipo no están disponibles, se indica «Equipo no disponible». El último listado se guarda por cuenta y salón para uso sin conexión y nunca se comparte entre cuentas. La búsqueda es local y no cambia datos.

Verificación: `node ritmo/servidor/pruebas/buscador-navegador.mjs` con Edge y PostgreSQL local: mayúsculas, acentos, singular/plural, varias palabras, resaltado escapado, categorías, sin resultados, agendar, modo sin conexión, asignaciones, White/Dark y 390/768/1440; `node --test ritmo/servidor/pruebas/buscador-api.test.mjs` comprueba acceso al mismo salón, bloqueo a otros y revocación; suite previa 177 pruebas y regresiones de fotos, diseño y equipo aprobadas. Las capturas usan datos de prueba. La referencia fue leída desde el commit indicado; no se copiaron datos de ejemplo al salón.

El acceso de la segunda administradora sigue en `codex/agendappx-equipo-compartido` y requiere configuración y autorización propias. El buscador puede prepararse de forma independiente sobre la versión actualmente publicada, sin activar las invitaciones ni WhatsApp. Publicar requiere confirmación expresa de Antonio según la skill `ritmo-confirmar-deploy`.

## Publicado con aprobación de Antonio

Antonio confirmó «sí, publica esto para probarlo en la app». Se publicó únicamente el buscador en Cloudflare desde `codex/agendappx-buscador-servicios`, commit de aplicación `2a98555`, PR #6. Worker **a8277d15-0c7d-41b5-b65d-b24b4694a1ec**; misma URL. No hubo migración ni activación de invitaciones, cuentas temporales, vinculación o envíos. La configuración existente de cuentas y el remitente vinculado se conservó.

Verificación en producción: salud 200; agenda y asignaciones sin identidad 401; SHA-256 del JavaScript publicado idéntico al artefacto local; Edge aislado a 390 px muestra el placeholder exacto, las cuatro categorías y filtrado sin perder foco ni desbordar. Sin errores de JavaScript ni escrituras en el salón. La recepción en el celular físico requiere que Antonio pulse Actualizar ahora. Las pruebas con datos fueron exclusivamente locales.
