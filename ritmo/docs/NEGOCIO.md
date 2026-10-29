# Modo negocio de Agendappx

Estado: propuesta de diseño, pendiente de que Antonio la apruebe.
- Prototipo: `ritmo/negocio/index.html` (publicado como «Agendappx Negocio»).
- Capturas: `ritmo/imagenes/modo-negocio.png` y `modo-negocio-dark.png`.

Es la misma app, en el modo del dueño de un salón o barbería. Usa el estilo de Explorar y Social: minimalista 3D con acento rosa, fotos reales y White/Dark. **Sustituye la apariencia de la app actual del salón, pero conserva todo lo que ya funciona** y agrega lo ya especificado en `CUENTAS.md`, `WHATSAPP-AUTOMATICO.md`, `EXPLORAR.md` y `SOCIAL.md`.

## Barra de abajo

**Hoy · Agenda · ＋ · Clientas · Mi negocio**

1. **Hoy** (nuevo):
   - saludo y fecha;
   - 4 cifras con relieve: citas de hoy, ingresos estimados, **solicitudes nuevas** y anticipos pendientes;
   - **Solicitudes desde la app**: las citas pedidas desde Explorar o Social, con foto del servicio, clienta, hora, especialista, anticipo y de dónde vino. Botones **Aceptar** (manda confirmación y anticipo por WhatsApp) y **Proponer otra hora**;
   - **Siguen hoy**: las próximas citas con foto, especialista y estado;
   - **Tu semana en Agendappx**: visitas al perfil, citas por la app y me gusta.
2. **Agenda** (ya funciona, con el nuevo estilo):
   - semana con puntos en los días que tienen citas;
   - filtro por especialista;
   - día con bloques de color por servicio y la línea de «ahora»;
   - al tocar una cita: foto, clienta, especialista, estado, WhatsApp, **Google Calendar / Apple Calendar** y mover de horario.
3. **＋**: Nueva cita (ya funciona; ahora con tarjetas de servicio con foto, especialista, horas libres y WhatsApp con anticipo), **Publicar trabajo** (`SOCIAL.md`) y **Nueva promoción**. La promoción se publica en **grupos de Facebook uno por uno**, como ya funciona, y se puede enviar por WhatsApp a clientas con permiso.
4. **Clientas** (ya funciona): buscador, total gastado, última visita y permiso de promociones. La ficha muestra historial, «Agendar cita» y WhatsApp. El ícono de arriba lleva a los contactos de WhatsApp.
5. **Mi negocio**:
   - portada con fotos, logo, ✔︎ verificado, calificación y seguidores;
   - **Ver como cliente** (su perfil público) y **Modo cliente** (para buscar en otros negocios);
   - tarjetas: **Servicios y precios** (con fotos y buscador), **Fotos de trabajos**, **Estadísticas**, **Reseñas** (con «Responder»), **Equipo**, **Horarios**, **WhatsApp** y **Conexiones**;
   - Conexiones: Google y Apple Calendar, grupos de Facebook, WhatsApp vinculado y el link para clientas;
   - **Apariencia**: White/Dark y los 5 temas.

## Notas para implementar

- Los datos son los mismos de hoy (servicios, clientas, citas, promociones y grupos) más los de cuentas y WhatsApp. No hay migración de datos por el cambio de diseño.
- Las **fotos de servicios** ya existen en la app (Codex las agregó). Las tarjetas las usan; sin foto, el servicio muestra su color.
- «Solicitudes» son citas en estado `solicitada` (`EXPLORAR.md`). Aceptar las pasa a `apartada` o `confirmada` según el anticipo.
- Las estadísticas cuentan visitas al perfil, citas con origen Explorar o Social, e ingresos de esas citas. Son por negocio y se ven solo con rol Admin.
- Recepción y Especialista ven el mismo modo con las restricciones de `CUENTAS.md`: Especialista sin ingresos ajenos ni estadísticas.
