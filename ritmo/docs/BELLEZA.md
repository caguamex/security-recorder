# Ritmo Belleza: salón de belleza

Imágenes: `ritmo/imagenes/diseno-1.png` a `diseno-5.png` (elige uno) y `belleza-referencia.png`.

| # | Diseño | Para quién |
|---|---|---|
| 1 | Clásico iOS | Se siente como una app de Apple desde el primer día |
| 2 | Rosa champaña | Salón cálido y femenino |
| 3 | Negro y dorado | Salón de lujo, modo oscuro |
| 4 | Ritmo | La identidad de la agenda original |
| 5 | Cristal pastel | Moderno, degradados y efecto cristal |

## Pantallas

1. **Agenda:** semana arriba, día con citas (servicio, clienta, precio, estado de WhatsApp), total del día, huecos libres y botón **+** flotante.
2. **Nueva cita (+):** clienta, servicio (tarjetas que se deslizan), horarios libres según la duración del servicio, interruptores de WhatsApp y calendario.
3. **Servicios y promociones:** promociones en tarjetas con swipe y botón "Publicar"; servicios con foto, categoría, duración y precio. Se agregan con **+**.
4. **Conexiones:** Apple Calendar, Google Calendar, mensajes automáticos de WhatsApp y publicación en grupos de Facebook, uno por uno.
5. **Menú:** barra inferior (Agenda, Clientas, Servicios, Promos, Más) y menú lateral que se abre deslizando.

## Cómo funciona cada conexión

### WhatsApp automático — dispositivo vinculado y solo envíos (27 de octubre de 2026)

Encargo vigente de Antonio, posterior a cuentas: [WHATSAPP-AUTOMATICO.md](WHATSAPP-AUTOMATICO.md), commit de Claude `dc15fe5`. Su aceptación expresa del riesgo de bloqueo reemplaza la regla antigua de usar exclusivamente Meta. FiNeCi usa Baileys a través de Evolution API; se reutiliza esa librería de conexión con una versión corregida y fijada, sin acceder ni modificar su infraestructura, instancias o credenciales.

- Un servicio Node/TypeScript permanente `agendappx-whatsapp`, una réplica, en un proyecto Railway separado. Revisión de cola cada minuto en el mismo proceso. No mensajero cron independiente ni Redis/volumen por defecto.
- Ajustes → Mensajes de WhatsApp: Admin con MFA introduce su número de México, obtiene el código temporal de ocho caracteres, lo confirma en WhatsApp y ve el número efectivamente vinculado. Aviso si se cierra la sesión o lleva más de diez minutos desconectado; conexión manual por WhatsApp siempre disponible.
- Sesión cifrada AES-256-GCM por negocio en Supabase, llave WA_SESSION_KEY solo en Railway, rol limitado agendappx_whatsapp y TLS verificado. La preparación anterior del PR #3 requiere adaptación: guardar una sesión persistente sin cifrar no cumple este encargo.
- Solo envía mensajes de citas autorizadas. No chatbot ni procesamiento/almacenamiento de respuestas, historial, contactos, comprobantes recibidos o marcas de leído. Las respuestas y comprobantes se atienden en el teléfono. El anticipo se confirma manualmente en la app por Admin o Recepción.
- Pausas aleatorias de 20–60 s, escribiendo 2–5 s, máximo 30/h y 150/día por número, silencio 21:00–08:00 CDMX, idempotencia y freno persistente ante bloqueo. La sección 2 define los casos de omisión de recordatorios y cancelación/cambio de cita. Conservar el límite mensual previamente aprobado de 600 hasta que Antonio lo cambie expresamente.
- Cloudflare dejará de enviar con WHATSAPP_REMITENTE=vinculado. Meta se conserva deshabilitado; no deben quedar dos remitentes activos ni un webhook de Meta modificando citas mientras rige este modo.
- Anticipo predeterminado **20 %**, según la instrucción directa anterior de Antonio; la cifra de 30 % en el documento de Claude queda señalada como discrepancia. No liberar el horario automáticamente al vencer.

No se ha creado ni desplegado el servicio. Pedir confirmación antes de migrar, desplegar, vincular el número y realizar el primer mensaje real. Costos y estado: [SIGUIENTE-WHATSAPP.md](SIGUIENTE-WHATSAPP.md). El presupuesto compartido sigue en 10 USD; no activar cargos ni aumentar límites por suposición.

### Apple Calendar y Google Calendar
- **Sencillo (recomendado al inicio):** Cloudflare publica un enlace de calendario `.ics` privado con tus citas. Te suscribes una vez desde el iPhone (Ajustes › Calendario › Cuentas › Agregar calendario suscrito) o desde Google Calendar (Otros calendarios › Desde URL). Apple lo actualiza seguido; Google puede tardar varias horas.
- **Completo:** en la app nativa de iPhone, EventKit escribe las citas directo en el Calendario de Apple; para Google, la API de Google Calendar con inicio de sesión de Google sincroniza en ambos sentidos.

### Grupos de Facebook, uno por uno
- Facebook ya no permite que las apps publiquen en grupos por API, así que la publicación siempre la haces tú.
- La app guarda tu lista de grupos. Al tocar **Publicar**, copia el texto de la promo, guarda la imagen y abre ese grupo en la app de Facebook. Pegas, publicas y regresas; el grupo queda marcado **✓ Listo** y pasas al siguiente.
- En tu cuenta de Claude ya tienes la skill "publicar-grupos-facebook-ab", que hace este recorrido desde el navegador con tu confirmación en cada grupo.

## Prompts

### Servicio de WhatsApp en Railway — prioridad actual de Antonio
```text
Implementar ritmo/docs/WHATSAPP-AUTOMATICO.md del commit dc15fe5 con la precisión de alcance de ritmo/docs/SIGUIENTE-WHATSAPP.md.
Conservar Agendappx y el diseño aprobado. Servicio nuevo agendappx-whatsapp, permanente y una réplica, con Baileys, sesión AES-256-GCM en Supabase y rol mínimo exclusivo; no tocar FiNeCi. Un solo proceso revisa la cola cada minuto y solo envía. Descartar entradas sin guardar ni marcar como leídas. Cloudflare deja de enviar con WHATSAPP_REMITENTE=vinculado. Preservar consentimiento, límites por número, horarios, omisiones, idempotencia, bloqueo de emergencia y anticipo confirmado manualmente. El porcentaje predeterminado sigue siendo 20 % por la instrucción directa de Antonio.
Completar primero WhatsApp con el acceso mínimo firmado de Admin y MFA; el resto de cuentas y equipo sigue después, por la prioridad nueva de Antonio. Ejecutar toda la sección 6 y documentar cada resultado: no afirmar que las pruebas anteriores del proveedor cubren la automatización nueva. Preparar y verificar sin desplegar ni vincular. Solicitar confirmaciones de migración, publicación, vinculación y primer mensaje real; mantener el máximo compartido de 10 USD sin nuevos servicios facturables no autorizados.
```

### App de iPhone
```text
Crea Ritmo Belleza para iPhone con Expo (React Native + TypeScript) usando el diseño de ritmo/imagenes/diseno-N.png (N = el que elegí).
Debe sentirse nativa: títulos grandes, barra inferior con 5 pestañas, hojas que suben desde abajo, interruptores de iOS, gestos de deslizar y vibración ligera al confirmar.
Pantallas: Agenda (semana + día, botón + flotante), Nueva cita, Clientas, Servicios y Promociones (tarjetas con swipe), Conexiones.
Conéctala al backend de ritmo/servidor/. Usa expo-calendar para escribir las citas en el Calendario de Apple.
Publicar en grupos de Facebook: copia el texto, guarda la imagen y abre el grupo (enlace fb://group/<id> con respaldo a la URL web), y marca el grupo como listo al regresar.
Reutiliza el intérprete de frases de ritmo/prototipo/parser.js para escribir citas como "Mariana uñas viernes 4pm".
```


Entrega local del 27 de octubre: ver `../whatsapp/README.md` para acceso temporal de Admin, despliegue separado y confirmaciones; `WHATSAPP-PRUEBAS.md` para resultados por criterio. La página publicada todavía no incluye este servicio. El prototipo de referencia no es evidencia de que un teléfono esté vinculado.

## Alcance vigente del 28 de octubre de 2026

Ver SIGUIENTE-VERSION.md, CUENTAS.md y WHATSAPP-AUTOMATICO.md, fuentes f743ccf. Antonio autorizó el dispositivo vinculado conociendo el riesgo; reemplaza la prohibición histórica de bibliotecas no oficiales. Usar Baileys actualizado y fijado, aislado de FiNeCi. Se permite sincronizar únicamente nombres y números de contactos; no mensajes entrantes ni lecturas. La decisión posterior «los códigos a cualquier hora, citas y promociones también» elimina las ventanas nocturnas de la siguiente versión. Se mantienen consentimiento, límites, pausas, idempotencia, prioridades y freno. El login telefónico usa el número de plataforma en una sesión propia; los mensajes de cada salón salen solo de su propio número. No desplegar, migrar ni vincular sin la confirmación respectiva.
