# WhatsApp automático y anticipo: especificación

Estado: propuesta para Agendappx, pendiente de que Antonio la apruebe.
- Prototipo: `ritmo/cuentas/index.html`, en la cita (Anticipo, Mensajes de WhatsApp, Ver la conversación), en Ajustes → Mensajes de WhatsApp y en «Pedir cita» del perfil público.
- Captura: `ritmo/imagenes/whatsapp-anticipo.png`.

Se construye sobre lo que ya existe en `ritmo/servidor/src/whatsapp.ts`: el cron de Cloudflare cada 5 minutos, la cola `belleza_whatsapp_cola` con huella idempotente, el webhook con firma, los estados de entrega y el bloqueo de reenvíos inciertos. **No usa Railway.** Con las cuentas, todas las tablas llevan `negocio_id` (ver `CUENTAS.md`).

## 1. Los mensajes

| # | Cuándo | Plantilla Meta (categoría Utilidad) | Botones |
|---|---|---|---|
| 1a | Al crear la cita, si el servicio pide anticipo | `cita_apartada_anticipo` | — |
| 1b | Al crear la cita, sin anticipo | `cita_agendada` | — |
| 2 | Cuando el salón marca el anticipo como recibido | `anticipo_recibido` | — |
| 3 | El día de la cita a las 09:00 (configurable) | `recordatorio_dia` | «Sí, ahí estaré» · «Necesito cambiarla» |
| 4 | 60 min antes (30, 60 o 120, configurable) | `recordatorio_antes` | — |
| 5 | La cita cambia de día u hora | `cita_cambiada` | — |

Textos (las variables `{{n}}` se llenan en el servidor):

- **cita_apartada_anticipo**: «Hola {{1}}, apartamos tu cita de {{2}} el {{3}} a las {{4}} con {{5}} en {{6}}. Para confirmarla, envía tu anticipo de {{7}} antes de {{8}}: Banco: {{9}} · CLABE: {{10}} · A nombre de: {{11}}. Cuando lo envíes, manda aquí tu comprobante.»
- **cita_agendada**: «Hola {{1}}, tu cita de {{2}} quedó agendada para el {{3}} a las {{4}} con {{5}} en {{6}}. Te recordaremos el día de tu cita.»
- **anticipo_recibido**: «¡Gracias, {{1}}! Recibimos tu anticipo de {{2}}. Tu cita de {{3}} el {{4}} a las {{5}} está confirmada. Restan {{6}} que pagas en el salón.»
- **recordatorio_dia**: «Buenos días, {{1}}. Hoy es tu cita de {{2}} a las {{3}} con {{4}}. ¿Nos confirmas?»
- **recordatorio_antes**: «{{1}}, te esperamos en {{2}}, a las {{3}}, para tu {{4}}. 📍 {{5}}. Si vas con retraso, avísanos por aquí.»
- **cita_cambiada**: «Hola {{1}}, tu cita de {{2}} cambió al {{3}} a las {{4}} con {{5}}. Si no te queda, responde a este mensaje.»

Antonio da de alta las plantillas en el Administrador de WhatsApp de Meta; Codex le da los textos listos para copiar. La aprobación tarda de minutos a un día.

## 2. Reglas de envío

- **Consentimiento**: solo se envía si `clienta.whatsappOptIn === true`.
  - En el perfil público, la casilla «Acepto recibir por WhatsApp…» es obligatoria.
  - Cuando el equipo crea la clienta, marca el permiso al pedirle su número.
- **Horario silencioso**: nada entre 21:00 y 08:00 (hora de Ciudad de México). Lo que caiga ahí espera a las 08:00, salvo el #4, que se omite si ya no tiene sentido.
- **#3 el día**:
  - si la cita empieza antes de las 10:00, sale la noche anterior a las 19:00;
  - se **omite** si la cita se agendó menos de 3 horas antes de esa hora, o si ya se mandó el #1 o el #2 en las últimas 3 horas.
- **#4 antes**: se omite si la cita se agendó menos de 90 minutos antes.
- **Cancelada o movida**: los pendientes de la cita se invalidan, porque la huella incluye fecha y hora. Si se mueve, se manda el #5 y se reprograman el #3 y el #4.
- **Ventana gratuita**: si la clienta escribió en las últimas 24 h, se manda como mensaje de servicio (gratis), igual que hoy. Si no, se usa la plantilla aprobada (con costo).
- **Límite mensual** configurable (por defecto 600). Al llegar al límite se detienen los automáticos, se avisa a Admin y el envío manual sigue disponible. Se conserva el tope diario actual.
- Los reintentos solo se hacen ante errores que Meta marca como temporales. Un estado incierto nunca se reenvía solo.

## 3. Anticipo

- **Configuración (Admin)**:
  - pedir anticipo: sí o no;
  - porcentaje: 20, 30 o 50 % (por defecto 30), redondeado a decenas;
  - solo servicios desde cierto precio (por defecto $300);
  - plazo: 24 h, o 2 h antes de la cita si eso es antes;
  - datos de transferencia: banco, CLABE (18 dígitos, validada con su dígito de control) y titular.
- **En la cita**: `data.anticipo = { monto, estado: 'pendiente' | 'recibido' | 'vencido' | 'no_aplica', recibidoEn, recibidoPor, metodo, comprobante }`.
  - La cita queda «Apartada» hasta recibir el anticipo y pasa a «Confirmada» al recibirlo.
- **Comprobante**: si la clienta manda una imagen o PDF por WhatsApp dentro de una cita con anticipo pendiente, el webhook lo descarga de Meta, lo guarda privado (R2) y lo adjunta a la cita como «Comprobante por revisar».
  - **Nunca confirma solo**: Admin o Recepción revisa y toca «Marcar anticipo recibido», lo que dispara el #2.
- **Vencido**: al terminar el plazo se avisa a Admin y Recepción («El anticipo de Daniela venció: ¿liberar el horario?»). El horario **no se libera solo**.
- **Futuro**: un link de pago de Mercado Pago con webhook que marque el anticipo como recibido automáticamente.

## 4. Respuestas de la clienta

- «Sí, ahí estaré» (o «1»): la cita queda `confirmada`.
- «Necesito cambiarla» (o «2»): queda `solicitaCambio: true` y aparece arriba en la Agenda con aviso para el salón.
- Cualquier otro texto se muestra en la cita y en el WhatsApp del salón para responder a mano. Se mantiene la lógica actual de cita inequívoca.

## 5. Lo que necesita Antonio

1. Una cuenta de Meta Business y su número en la plataforma de WhatsApp Business (Cloud API). Si su número ya usa la app WhatsApp Business, Meta permite conectarlo sin dejar de usar la app (coexistencia), sujeto a que su número sea elegible.
2. **Un método de pago en Meta** para las plantillas fuera de la ventana gratuita. Referencia: unos US$0.0085 por mensaje de utilidad en México (≈ 16 centavos), según fuentes no oficiales; la tarifa oficial está en la página de precios de Meta y puede cambiar cada trimestre.
   - Una cita con anticipo usa de 3 a 4 mensajes, unos 50 a 65 centavos.
   - 300 citas al mes son unos $150 a $200 MXN.
3. Dar de alta las 6 plantillas con los textos de la sección 1.
4. Las variables `WHATSAPP_TOKEN` (token permanente de usuario del sistema), `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` y `WHATSAPP_APP_SECRET`, como secretos de Cloudflare.

## 6. Pruebas mínimas

- Ningún envío sin consentimiento, en horario silencioso ni pasado el límite mensual.
- El #3 se omite al agendar el mismo día con menos de 3 h; el #4 se omite con menos de 90 min.
- Mover una cita invalida los pendientes, manda el #5 y reprograma los recordatorios. Cancelar invalida todo.
- Un comprobante recibido no confirma la cita; «Marcar anticipo recibido» sí, y manda el #2 una sola vez.
- Un webhook repetido no duplica entradas ni cambios.
- Una Especialista no ve CLABE ni comprobantes de citas ajenas.
