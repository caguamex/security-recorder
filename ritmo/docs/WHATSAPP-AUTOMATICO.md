# WhatsApp automático y anticipo: especificación

Estado: aprobada por Antonio el 27 de octubre de 2026, **con WhatsApp vinculado como en FiNeCi** (código de 8 dígitos) en un servicio de Railway.
- Prototipo: `ritmo/cuentas/index.html`, en la cita (Anticipo, Mensajes de WhatsApp, Ver la conversación), en Ajustes → Mensajes de WhatsApp (Vincular WhatsApp) y en «Pedir cita» del perfil público.
- Captura: `ritmo/imagenes/whatsapp-anticipo.png`.

## Decisión de Antonio sobre la conexión no oficial

Antonio eligió conectar WhatsApp como **dispositivo vinculado** («Vincular con número de teléfono», código de 8 dígitos), igual que en su proyecto FiNeCi, donde le ha funcionado sin problemas. Así no hay costo por mensaje ni trámite con Meta. Esto **reemplaza** la regla anterior «nunca uses librerías no oficiales de WhatsApp Web» para Agendappx.

Antonio lo autorizó conociendo el riesgo: las condiciones de WhatsApp no permiten automatizar con clientes no oficiales, y WhatsApp puede bloquear el número vinculado. Por eso las protecciones de la sección 2 son obligatorias, y el envío se programa detrás de una interfaz (`Remitente`) para poder cambiar a la Cloud API oficial sin rehacer los mensajes. Codex: actualiza `ritmo/AGENTS.md` y `ritmo/docs/BELLEZA.md` en tu rama con esta decisión.

## 0. Dónde corre

**Railway: servicio nuevo `agendappx-whatsapp`**, en un proyecto propio, separado de FiNeCi. **No toques FiNeCi.**
- Plan Hobby de Antonio: 1.20 USD usados en 12 días, con un estimado de 2.25 USD de los 5 incluidos, y un límite de gasto de 10 USD compartido con FiNeCi.
- Es un proceso Node/TypeScript **siempre prendido** (1 réplica) que mantiene la conexión de WhatsApp. Usa una librería de dispositivo vinculado mantenida (por ejemplo Baileys), con la versión fijada. Si FiNeCi ya usa una, toma la misma para repetir lo que ya funciona.
- Hace todo lo de WhatsApp:
  - vincula el número;
  - revisa la cola **cada minuto** y manda los mensajes de la sección 1;
  - recibe respuestas y comprobantes;
  - informa el estado de la conexión.
- **Sesión de WhatsApp**: se guarda **cifrada** (AES-256-GCM, llave `WA_SESSION_KEY` en Railway) en una tabla de Supabase `whatsapp_sesiones` por negocio. Así no hace falta volumen y sobrevive a reinicios.
- **Supabase**: rol propio `agendappx_whatsapp` con permisos mínimos:
  - lee citas, clientas, servicios, ajustes y miembros;
  - escribe la cola, entradas, contactos, sesiones, el estado de la vinculación y los campos de estado, anticipo y respuesta de la cita, y la bitácora.
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
| 3 | El día de la cita a las 09:00 (configurable) | Hoy es tu cita, «responde 1 o 2» |
| 4 | 60 min antes (30, 60 o 120, configurable) | Te esperamos, con la dirección |
| 5 | La cita cambia de día u hora | Tu cita cambió |

Textos base:

- **1a**: «Hola {nombre}, apartamos tu cita de {servicio} el {fecha} a las {hora} con {especialista} en {salón}. Para confirmarla, envía tu anticipo de {anticipo} antes de {limite}: Banco: {banco} · CLABE: {clabe} · A nombre de: {titular}. Cuando lo envíes, manda aquí tu comprobante.»
- **1b**: «Hola {nombre}, tu cita de {servicio} quedó agendada para el {fecha} a las {hora} con {especialista} en {salón}. Te recordaremos el día de tu cita.»
- **2**: «¡Gracias, {nombre}! Recibimos tu anticipo de {anticipo}. Tu cita de {servicio} el {fecha} a las {hora} está confirmada. Restan {resto} que pagas en el salón.»
- **3**: «Buenos días, {nombre}. Hoy es tu cita de {servicio} a las {hora} con {especialista}. Responde *1* para confirmar o *2* si necesitas cambiarla.»
- **4**: «{nombre}, te esperamos en {tiempo}, a las {hora}, para tu {servicio}. 📍 {dirección}. Si vas con retraso, avísanos por aquí.»
- **5**: «Hola {nombre}, tu cita de {servicio} cambió al {fecha} a las {hora} con {especialista}. Si no te queda, responde a este mensaje.»

No se usan botones interactivos, porque en dispositivos vinculados no son confiables. Se responde con «1» o «2».

## 2. Reglas de envío y protecciones (obligatorias)

- **Consentimiento**: solo se envía si `clienta.whatsappOptIn === true`.
  - En el perfil público, la casilla «Acepto recibir por WhatsApp…» es obligatoria.
  - Cuando el equipo crea la clienta, marca el permiso al pedirle su número.
- **Solo mensajes de citas**: nunca promociones masivas ni mensajes a números sin cita.
- **Ritmo humano**:
  - pausa aleatoria de 20 a 60 segundos entre mensajes;
  - «escribiendo…» de 2 a 5 segundos antes de cada uno;
  - máximo 30 por hora y 150 por día por número (configurable hacia abajo).
  - Lo que no alcance a salir espera a la siguiente vuelta, respetando los horarios de la cita: si un #4 ya no tiene sentido, se omite.
- **Horario silencioso**: nada entre 21:00 y 08:00 (hora de Ciudad de México). Lo que caiga ahí espera a las 08:00, salvo el #4, que se omite.
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
- **Comprobante**: si la clienta manda una imagen o PDF mientras su cita tiene anticipo pendiente, el servicio lo descarga, lo guarda privado (Supabase Storage o R2) y lo adjunta a la cita como «Comprobante por revisar».
  - **Nunca confirma solo**: Admin o Recepción revisa y toca «Marcar anticipo recibido», lo que dispara el #2.
- **Vencido**: al terminar el plazo se avisa a Admin y Recepción («El anticipo de Daniela venció: ¿liberar el horario?»). El horario **no se libera solo**.
- **Futuro**: un link de pago de Mercado Pago que marque el anticipo como recibido automáticamente.

## 4. Respuestas de la clienta

- «1» (o «sí», «confirmo»): la cita queda `confirmada`.
- «2» (o «cambiar»): queda `solicitaCambio: true` y aparece arriba en la Agenda con aviso para el salón.
- Cualquier otro texto se muestra en la cita para responder a mano.
- Se mantiene la lógica actual de cita inequívoca: si la clienta tiene varias citas próximas, no se adivina.
- Como es el mismo WhatsApp del número vinculado, la conversación también se ve en el teléfono, donde se puede contestar normalmente.

## 5. Lo que necesita Antonio

1. El teléfono con el número que mandará los avisos, con WhatsApp o WhatsApp Business instalado. Puede ser el principal o uno aparte (recomendado).
2. Vincularlo una vez con el código de 8 dígitos desde Ajustes, y volver a hacerlo si la app avisa que se desconectó.
3. Nada en Meta, sin plantillas y sin tarjeta.
4. Para Codex: secretos solo en Railway (`DATABASE_URL` del rol `agendappx_whatsapp`, `WA_SESSION_KEY` y `TZ=America/Mexico_City`) y la bandera en Cloudflare. Nunca en Git.

## 6. Pruebas mínimas

- Ningún envío sin consentimiento, en horario silencioso, a números sin cita, ni pasados los topes por hora y por día.
- Las pausas entre mensajes se respetan (prueba con reloj simulado).
- El #3 se omite al agendar el mismo día con menos de 3 h; el #4 se omite con menos de 90 min.
- Mover una cita invalida los pendientes, manda el #5 y reprograma los recordatorios. Cancelar invalida todo.
- Un comprobante recibido no confirma la cita; «Marcar anticipo recibido» sí, y manda el #2 una sola vez.
- Un mensaje entrante repetido no duplica entradas ni cambios.
- Reiniciar el servicio no pierde la sesión ni repite mensajes. Con la sesión cerrada, la app muestra «desconectado» y nada queda «enviado» por error.
- El freno de emergencia detiene todo ante errores de bloqueo.
- La sesión guardada no se puede leer sin `WA_SESSION_KEY`.
- Una Especialista no ve CLABE, comprobantes ni el estado de vinculación.
- Con `WHATSAPP_REMITENTE=vinculado`, Cloudflare no envía nada.
