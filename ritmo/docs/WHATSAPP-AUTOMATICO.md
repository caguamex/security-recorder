# WhatsApp automático y anticipo: especificación

Estado: aprobada por Antonio el 27 de octubre de 2026, **con WhatsApp vinculado como en FiNeCi** (código de 8 dígitos) en un servicio de Railway que **solo envía**.
- Prototipo: `ritmo/cuentas/index.html`, en la cita (Anticipo, Mensajes de WhatsApp, Ver la conversación), en Ajustes → Mensajes de WhatsApp (Vincular WhatsApp) y en «Pedir cita» del perfil público.
- Captura: `ritmo/imagenes/whatsapp-anticipo.png`.

## Decisión de Antonio sobre la conexión no oficial

Antonio eligió conectar WhatsApp como **dispositivo vinculado** («Vincular con número de teléfono», código de 8 dígitos), igual que en su proyecto FiNeCi, donde le ha funcionado sin problemas. Así no hay costo por mensaje ni trámite con Meta. Esto **reemplaza** la regla anterior «nunca uses librerías no oficiales de WhatsApp Web» para Agendappx.

Antonio lo autorizó conociendo el riesgo: las condiciones de WhatsApp no permiten automatizar con clientes no oficiales, y WhatsApp puede bloquear el número vinculado. Por eso las protecciones de la sección 2 son obligatorias, y el envío se programa detrás de una interfaz (`Remitente`) para poder cambiar a la Cloud API oficial sin rehacer los mensajes. Codex: actualiza `ritmo/AGENTS.md` y `ritmo/docs/BELLEZA.md` en tu rama con esta decisión.

## 0. Dónde corre

**Railway: servicio nuevo `agendappx-whatsapp`**, en un proyecto propio, separado de FiNeCi. **No toques FiNeCi.**
- Plan Hobby de Antonio: 1.20 USD usados en 12 días, con un estimado de 2.25 USD de los 5 incluidos, y un límite de gasto de 10 USD compartido con FiNeCi.
- Es un proceso Node/TypeScript **siempre prendido** (1 réplica) que mantiene la conexión de WhatsApp. Usa una librería de dispositivo vinculado mantenida (por ejemplo Baileys), con la versión fijada. Si FiNeCi ya usa una, toma la misma para repetir lo que ya funciona.
- **Solo envía** (decisión de Antonio). No es un chatbot. Lo único que lee son los **contactos** (sección 7):
  - vincula el número;
  - revisa la cola **cada minuto** y manda los mensajes de la sección 1;
  - informa el estado de la conexión.
  - **manda los códigos de inicio de sesión desde el número de Agendappx, +52 866 124 1483** (el mismo de FiNeCi). Es una sesión vinculada **propia y separada**: otro dispositivo vinculado de ese número, sin tocar la sesión ni el servicio de FiNeCi. WhatsApp permite hasta 4 dispositivos vinculados por número; Codex verifica cuántos usa FiNeCi antes de vincular. Esta sesión de plataforma se vincula una sola vez con un comando de operación que muestra el código de 8 dígitos a Antonio (no desde la app de un salón). Variable `WA_NUMERO_CODIGOS=528661241483` en Railway. Por ese número salen solo códigos: ni recordatorios ni promociones de salones.
  - **endpoint de códigos**: expone `POST /hook/codigo` para el «Send SMS Hook» de Supabase Auth (firma verificada con el secreto del hook). Solo acepta `{telefono, codigo}` y manda el texto fijo del código (ver `CUENTAS.md`, sección 1). Los códigos tienen prioridad sobre todo lo demás y no cuentan en los topes. Si el número no está vinculado, responde error y la app ofrece el correo.
- **No lee, no guarda y no procesa mensajes entrantes.** Los eventos de mensajes recibidos se descartan sin guardarlos. Tampoco envía confirmaciones de lectura ni marca chats como leídos, para que el salón vea las respuestas como no leídas en su teléfono.
- **Sesión de WhatsApp**: se guarda **cifrada** (AES-256-GCM, llave `WA_SESSION_KEY` en Railway) en una tabla de Supabase `whatsapp_sesiones` por negocio. Así no hace falta volumen y sobrevive a reinicios.
- **Supabase**: rol propio `agendappx_whatsapp` con permisos mínimos:
  - lee citas, clientas, servicios, ajustes y miembros;
  - escribe la cola, sesiones, el estado de la vinculación, el estado de envío de cada mensaje y la lista de contactos sincronizados (sección 7).
  - TLS verificado.
- **Cloudflare** deja de enviar (`WHATSAPP_REMITENTE=vinculado`). El webhook de Meta y su código se conservan, pero quedan apagados.
- **Costo esperado**: unos 1.5 a 3 USD al mes por estar prendido (unos 150 a 250 MB de RAM). Sumado a lo actual queda cerca de los 5 USD incluidos y lejos del límite de 10. Configura en Railway una alerta de uso. Codex: informa el consumo real después de una semana.

**Vincular desde la app (Ajustes → Mensajes de WhatsApp):**
1. Admin escribe el número que va a mandar los avisos (10 dígitos de México) y toca «Vincular WhatsApp».
2. La API de Cloudflare crea una solicitud. El servicio de Railway pide el código de vinculación para ese número y lo guarda.
3. La app muestra el **código de 8 caracteres** (por ejemplo `K7QM-29XA`) con las instrucciones: en el teléfono, WhatsApp → Dispositivos vinculados → Vincular un dispositivo → **Vincular con número de teléfono** → escribir el código. El código vence en unos minutos; hay un botón «Pedir otro código».
4. Al vincular, la app muestra «🟢 Conectado · 55 •••• 1234 · desde hoy 12:40» y el botón «Desvincular».
5. Si WhatsApp cierra la sesión o pasan más de 10 minutos sin conexión, la app avisa a Admin: «WhatsApp desconectado: vuelve a vincular». Mientras tanto, cada cita muestra el botón manual «Escribirle por WhatsApp», que abre el chat con el texto listo.

Recomendación a Antonio (decisión suya): usar **un número aparte solo para avisos**, para que su WhatsApp principal del salón no corra riesgo.

## 1. Los mensajes

Son mensajes normales de texto (no hay plantillas de Meta). Cada uno tiene **2 o 3 variantes de redacción** que se alternan, y siempre lleva los datos de la clienta, para que no salgan idénticos.

| # | Cuándo | Mensaje |
|---|---|---|
| 1a | Al crear la cita, si el servicio pide anticipo | Cita apartada y datos del anticipo |
| 1b | Al crear la cita, sin anticipo | Cita agendada |
| 2 | Cuando el salón marca el anticipo como recibido | Anticipo recibido |
| 3 | El día de la cita a las 09:00 (configurable) | Hoy es tu cita |
| 4 | 60 min antes (30, 60 o 120, configurable) | Te esperamos, con la dirección |
| 5 | La cita cambia de día u hora | Tu cita cambió |

Textos base:

- **1a**: «Hola {nombre}, apartamos tu cita de {servicio} el {fecha} a las {hora} con {especialista} en {salón}. Para confirmarla, envía tu anticipo de {anticipo} antes de {limite}: Banco: {banco} · CLABE: {clabe} · A nombre de: {titular}. Cuando lo envíes, manda aquí tu comprobante.»
- **1b**: «Hola {nombre}, tu cita de {servicio} quedó agendada para el {fecha} a las {hora} con {especialista} en {salón}. Te recordaremos el día de tu cita.»
- **2**: «¡Gracias, {nombre}! Recibimos tu anticipo de {anticipo}. Tu cita de {servicio} el {fecha} a las {hora} está confirmada. Restan {resto} que pagas en el salón.»
- **3**: «Buenos días, {nombre}. Hoy es tu cita de {servicio} a las {hora} con {especialista}. Si necesitas cambiarla, escríbenos por aquí.»
- **4**: «{nombre}, te esperamos en {tiempo}, a las {hora}, para tu {servicio}. 📍 {dirección}. Si vas con retraso, avísanos por aquí.»
- **5**: «Hola {nombre}, tu cita de {servicio} cambió al {fecha} a las {hora} con {especialista}. Si no te queda, responde a este mensaje.»

No hay botones ni respuestas automáticas. Si la clienta contesta, lo lee y responde una persona del salón desde el teléfono.

## 2. Reglas de envío y protecciones (obligatorias)

- **Consentimiento**: solo se envía si `clienta.whatsappOptIn === true`.
  - En el perfil público, la casilla «Acepto recibir por WhatsApp…» es obligatoria.
  - Cuando el equipo crea la clienta, marca el permiso al pedirle su número.
- **Mensajes de citas** solo a clientas con cita. **Promociones** solo con las reglas de la sección 7.
- **Ritmo humano**:
  - pausa aleatoria de 20 a 60 segundos entre mensajes;
  - «escribiendo…» de 2 a 5 segundos antes de cada uno;
  - máximo 30 por hora y 150 por día por número (configurable hacia abajo).
  - Lo que no alcance a salir espera a la siguiente vuelta, respetando los horarios de la cita: si un #4 ya no tiene sentido, se omite.
- **Horario de envío: las 24 horas**, por decisión posterior expresa de Antonio del 28 de octubre de 2026. Aplica a códigos de acceso, avisos de citas y promociones. No posponer ni omitir un mensaje por ser de noche; conservar el momento programado, caducidad de recordatorios, consentimiento, pausas, prioridades y topes.
- **#3 el día**:
  - si la cita empieza menos de 2 horas después de esa hora (con 09:00, antes de las 11:00), sale la noche anterior a las 19:00 como «Mañana es tu cita», para no juntarse con el #4;
  - se **omite** si la cita se agendó menos de 3 horas antes de esa hora, o si ya se mandó el #1 o el #2 en las últimas 3 horas.
- **#4 antes**: se omite si la cita se agendó menos de 90 minutos antes.
- **Puntualidad**: el servicio revisa cada minuto. Un mensaje nunca sale antes de su hora, y puede salir unos minutos después por las pausas.
- **Cancelada o movida**: los pendientes de la cita se invalidan, porque la huella incluye fecha y hora. Si se mueve, se manda el #5 y se reprograman el #3 y el #4.
- **Sin duplicados**: se conserva la cola con huella idempotente y el bloqueo `procesando`. Un envío incierto nunca se reenvía solo.
- **Freno de emergencia**: si WhatsApp responde con errores de bloqueo o de demasiados mensajes, se detienen todos los envíos, se avisa a Admin y no se reintenta hasta que Admin lo reactive.

## 3. Anticipo

- **Configuración (Admin)**:
  - pedir anticipo: sí o no;
  - porcentaje: 20, 30 o 50 % (por defecto 30), redondeado a decenas;
  - solo servicios desde cierto precio (por defecto $300);
  - plazo: 24 h, o 2 h antes de la cita si eso es antes;
  - datos de transferencia: banco, CLABE (18 dígitos, validada con su dígito de control) y titular.
- **En la cita**: `data.anticipo = { monto, estado: 'pendiente' | 'recibido' | 'vencido' | 'no_aplica', recibidoEn, recibidoPor, metodo, comprobante }`.
  - La cita queda «Apartada» hasta recibir el anticipo y pasa a «Confirmada» al recibirlo.
- **Comprobante**: la clienta lo manda al chat y el salón lo ve en su teléfono. El servicio no lo lee.
  - Admin o Recepción revisa la transferencia y toca «Marcar anticipo recibido» en la cita, lo que dispara el #2. Opcional: adjuntar a mano una foto del comprobante a la cita.
- **Vencido**: al terminar el plazo se avisa a Admin y Recepción («El anticipo de Daniela venció: ¿liberar el horario?»). El horario **no se libera solo**.
- **Futuro**: un link de pago de Mercado Pago que marque el anticipo como recibido automáticamente.

## 4. Respuestas de la clienta

- El servicio **no las lee**: llegan al WhatsApp del número vinculado y el salón las contesta a mano desde el teléfono.
- Confirmar, cambiar o cancelar una cita lo hace el equipo en la app, con lo que la clienta le diga.
- Si después se quiere confirmar con «1» o «2», se agrega como opción aparte. Por ahora está fuera de alcance.

## 5. Lo que necesita Antonio

1. El teléfono con el número que mandará los avisos, con WhatsApp o WhatsApp Business instalado. Puede ser el principal o uno aparte (recomendado).
2. Vincularlo una vez con el código de 8 dígitos desde Ajustes, y volver a hacerlo si la app avisa que se desconectó.
3. Nada en Meta, sin plantillas y sin tarjeta.
4. Para Codex: secretos solo en Railway (`DATABASE_URL` del rol `agendappx_whatsapp`, `WA_SESSION_KEY` y `TZ=America/Mexico_City`) y la bandera en Cloudflare. Nunca en Git.

## 7. Contactos de WhatsApp y promociones

Antonio quiere sincronizar los contactos del WhatsApp vinculado, como en FiNeCi, para crear promociones y elegir a quién mandarlas. Se maneja con moderación.

**Contactos (Ajustes → Mensajes de WhatsApp → Contactos de WhatsApp, solo Admin):**
- Al vincular y con «Sincronizar», el servicio lee **solo nombre y número** de los contactos del WhatsApp vinculado (lo que la librería expone de la libreta y los chats). Los guarda en `whatsapp_contactos(negocio_id, telefono, nombre, ultimo_chat)`. **Nunca lee ni guarda mensajes.**
- La app muestra los **nuevos** (los que no están en Clientas) con casillas. Admin elige quién pasa a Clientas; no se importa nada solo.
- Al importarlas se marca «Acepta promociones», que Admin puede cambiar después.
- Cada clienta tiene `promosOptIn` (sí o no, con fecha y origen: link, importada o a mano). En el perfil público, «Pedir cita» ofrece la casilla opcional «Quiero recibir promociones».

**Enviar promoción (solo Admin):**
1. Elige una promoción de las que ya existen en la app (o escribe el texto). El mensaje usa `{nombre}` y lleva al final: «Si no quieres recibir promociones, respóndenos BAJA».
2. Elige a quién, **solo entre clientas con `promosOptIn`**: todas, por categoría de servicio que se han hecho, «no vienen hace 30+ días» o una por una.
3. La app muestra el plan antes de confirmar: «Se enviará a 79 clientas: 40 hoy, 39 mañana».
4. «Programar envío» crea una campaña. El servicio la manda poco a poco:
   - **máximo 40 promociones al día** por número (configurable solo hacia abajo);
   - a cualquier hora, con pausas de 1 a 3 minutos (cambio expreso de Antonio del 28 de octubre de 2026);
   - 2 o 3 variaciones del texto;
   - **nunca** dos promociones a la misma clienta en menos de 7 días.
5. En Mensajes de WhatsApp se ve el avance de cada campaña («40 de 79»), con botones para pausar o cancelar.

**Prioridad y frenos:**
- Los mensajes de citas siempre salen primero y no cuentan en el tope de promociones.
- Si WhatsApp rechaza mensajes o desconecta el número durante una campaña, **se pausan todas las campañas**, se avisa a Admin y solo se reanudan a mano.
- **BAJA**: el servicio no lee mensajes, así que Admin la marca a mano en la ficha de la clienta («Quitar de promociones»). Eso la saca de inmediato de las campañas pendientes.

## 6. Pruebas mínimas

- Ningún aviso de cita sin consentimiento, sin cita vigente ni pasados los topes por hora y por día. Comprobar también avisos nocturnos sin posponerlos hasta las 08:00.
- Las pausas entre mensajes se respetan (prueba con reloj simulado).
- El #3 se omite al agendar el mismo día con menos de 3 h; el #4 se omite con menos de 90 min.
- Mover una cita invalida los pendientes, manda el #5 y reprograma los recordatorios. Cancelar invalida todo.
- «Marcar anticipo recibido» manda el #2 una sola vez.
- Un mensaje entrante no se guarda, no cambia ninguna cita y no se marca como leído.
- Reiniciar el servicio no pierde la sesión ni repite mensajes. Con la sesión cerrada, la app muestra «desconectado» y nada queda «enviado» por error.
- El freno de emergencia detiene todo ante errores de bloqueo.
- La sesión guardada no se puede leer sin `WA_SESSION_KEY`.
- Una Especialista no ve CLABE, comprobantes ni el estado de vinculación.
- Con `WHATSAPP_REMITENTE=vinculado`, Cloudflare no envía nada.
- La sincronización guarda solo nombre y número; ningún mensaje.
- Una promoción nunca llega a quien no tiene `promosOptIn`, ni a la misma clienta dos veces en 7 días.
- Se respeta el tope de 40 promociones al día y las pausas de 1 a 3 min; la campaña puede avanzar también por la noche, por instrucción posterior de Antonio.
- Quitar el permiso saca a la clienta de las campañas pendientes.
- Un error de WhatsApp pausa todas las campañas.

## Precedencia de la aclaración del 28 de octubre

Los documentos del commit f743ccf sustituyen los encargos anteriores. Después Antonio autorizó códigos, citas y promociones a cualquier hora. Por ello, las referencias antiguas a silencio 21–08 o promociones 10–19 quedan sustituidas. Permanecen los límites de 30/h y 150/día por número para avisos, 40 promociones/día, separación de siete días, consentimiento, prioridad códigos → citas → promociones y freno ante bloqueo. Esto es la especificación de la siguiente versión, no un cambio ya publicado en el servicio existente.
