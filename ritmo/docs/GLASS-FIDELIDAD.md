# Corrección de fidelidad de Liquid Glass · 1 de noviembre de 2026

Antonio mostró en su iPhone Hoy y Agenda vacíos: el material publicado en el PR #25 se veía plano, con bordes uniformes. Pidió realizar los cambios y después continuar la comprobación pendiente. Rama `codex/agendappx-glass-fidelidad` desde `adbf5b0`, implementación `938c86c`, [PR #26](https://github.com/caguamex/security-recorder/pull/26). **Preparado localmente, sin publicar.** La versión pública sigue siendo `191c09ee-040a-4795-98a2-9d47032f7089`.

## Alcance

Referencia aprobada: https://agendappx-vista-glass-colores.antonio-t-22.workers.dev/ . Se midió su material en el HTML autónomo ya publicado y se trasladaron sus valores a la app real, sin copiar datos, cuentas ni acciones simuladas del prototipo.

- Tarjetas con transparencia en degradado, borde superior luminoso, laterales más discretos y reflejo interior suave. Black conserva gris/negro neutro; White usa el fondo `#eef2f4` de la referencia y luz mint/gris azulada.
- Fondo con halos estáticos centrados en el contenido, visibles también con cero citas y sin fotografías. Se retira la franja opaca de la navegación superior.
- La medida de las tarjetas reales en Edge coincide con la referencia en degradado, borde superior/inferior y filtro: Black `blur(24px) saturate(0.5)`, White `blur(24px) saturate(1.1)`. Los JSON de medición permiten contrastarlo. Esto acredita el material; no afirma que la composición de la app sea idéntica a la demostración.
- Se conserva la composición real, el contenido, el contraste de formularios, las áreas seguras, el ＋ dentro de la barra y los colores por ID de clienta. No se añade perspectiva, rotación o animación 3D.
- Las hojas de captura mantienen un fondo casi opaco para leerlas. Las capturas esperan a que termine su animación de apertura: fotografiarla a media transición hacía parecer transparente el formulario completo.
- La opción Reducir transparencia elimina tanto filtros como degradados. El material compartido sigue en todos los HTML de producción y las hojas heredan sus variables.

## Verificación

- `npm test`: **289/289**, cero omitidas.
- `liquid-glass-navegador.mjs`: Edge/WebKit, White/Black, 320/390/768/1440; gradiente presente y bordes direccionales, Hoy/Agenda vacíos y con citas, Nueva cita con fotos, demás secciones, páginas públicas, colores por clienta entre servicios/especialistas, solapamientos, filtros, recarga y modo sin conexión, datos y pendientes conservados. Cero conexiones externas o errores JavaScript. Capturas finales sin animaciones transitorias.
- Empaquetado desde fuentes y compilación de Cloudflare `--dry-run`, sin publicar. No se modifica el comportamiento del Worker.
- La última revisión automática de la sesión anterior no pudo ejecutarse por un límite de uso. Después de que Antonio pidió continuar, la revisión permitió ejecutar la comprobación final. No se eludió el control ni se activaron créditos de pago.
- Capturas reales de la app local a390px en `imagenes/glass-fidelidad/`, incluidas pantallas sin registros. Las que muestran personas o citas son datos ficticios locales. Las capturas de referencia son material de la demostración aprobada, no de usuarios reales.

## Pendiente

Mostrar las capturas y solicitar confirmación de publicación conforme a `ritmo-confirmar-deploy`. Si Antonio confirma, actualizar únicamente el Worker existente con `--keep-vars`, comparar recursos publicados y ejecutar `liquid-glass-publicado.mjs` con `AGENDAPPX_WORKER_VERSION` de ese despliegue. Su expectativa White ya está preparada para el fondo corregido. No interpretar el informe JSON de publicación anterior como comprobación de este ajuste.

Sin migraciones, escrituras reales, códigos, vinculaciones, cambios de recursos/costos o modificaciones de Railway y FiNeCi. No borrar cuentas, sesión o almacenamiento para mostrar el acabado nuevo. La prueba en iPhone físico queda para después de la publicación autorizada.
