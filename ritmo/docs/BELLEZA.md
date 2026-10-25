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

### WhatsApp automático (en tu servidor de Railway)
- Usa la **API oficial de WhatsApp Business (Cloud API de Meta)**. Necesitas una cuenta de Meta Business, un número dedicado y **plantillas aprobadas** (confirmación, recordatorio, gracias).
- Railway corre un servidor (Node.js) que: guarda las citas en Postgres, programa los recordatorios (por ejemplo, cada 5 minutos busca citas en 24 h) y recibe las respuestas de las clientas por webhook ("1 = confirmo", "2 = cambiar").
- Meta cobra por mensaje de plantilla. Revisa la tarifa actual para México antes de lanzar.
- No uses librerías no oficiales que imitan WhatsApp Web: WhatsApp puede bloquear el número del negocio.

### Apple Calendar y Google Calendar
- **Sencillo (recomendado al inicio):** Railway publica un enlace de calendario `.ics` privado con tus citas. Te suscribes una vez desde el iPhone (Ajustes › Calendario › Cuentas › Agregar calendario suscrito) o desde Google Calendar (Otros calendarios › Desde URL). Apple lo actualiza seguido; Google puede tardar varias horas.
- **Completo:** en la app nativa de iPhone, EventKit escribe las citas directo en el Calendario de Apple; para Google, la API de Google Calendar con inicio de sesión de Google sincroniza en ambos sentidos.

### Grupos de Facebook, uno por uno
- Facebook ya no permite que las apps publiquen en grupos por API, así que la publicación siempre la haces tú.
- La app guarda tu lista de grupos. Al tocar **Publicar**, copia el texto de la promo, guarda la imagen y abre ese grupo en la app de Facebook. Pegas, publicas y regresas; el grupo queda marcado **✓ Listo** y pasas al siguiente.
- En tu cuenta de Claude ya tienes la skill "publicar-grupos-facebook-ab", que hace este recorrido desde el navegador con tu confirmación en cada grupo.

## Prompts

### Backend en Railway
```text
En ritmo/servidor/ crea el backend de Ritmo Belleza para desplegar en Railway (Node.js + TypeScript + Fastify + Postgres).
Modelos: clientas (nombre, teléfono con lada 52), servicios (nombre, categoría, duración, precio, foto), promociones (título, texto, imagen, vigencia), citas (clienta, servicio, inicio, fin, estado, avisos enviados), grupos_facebook (nombre, url, último envío).
- API REST con token para la app.
- WhatsApp Cloud API: enviar plantillas "cita_confirmada", "recordatorio_24h" y "gracias_resena"; webhook para respuestas 1 (confirmar) y 2 (reprogramar). Tarea programada cada 5 minutos para recordatorios.
- Calendario .ics privado en /calendario/<token>.ics con todas las citas.
- Variables: DATABASE_URL, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN, APP_TOKEN.
Incluye pruebas, un README de despliegue en Railway y la lista de plantillas que debo registrar en Meta con su texto en español.
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
