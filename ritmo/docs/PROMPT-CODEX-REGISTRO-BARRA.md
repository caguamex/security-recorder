# Mensaje para Codex: primera entrada con publicaciones, registro, barra con el ＋ al centro y correcciones de Neutro iOS

Pégalo completo en el chat de Codex. Reemplaza la versión anterior de este mensaje (la de la pantalla de bienvenida).

```
Hola Codex. Revisé la vista Neutro iOS (PR #11). Está bien; agrega y
corrige esto en la vista y después en la app real.

MODELO: ritmo/ios/inicio.html y su captura
ritmo/imagenes/app-ios-inicio.png (rama claude/es-posible-esto-tjimmb,
último commit). Pantallas 1 a 8. Ya NO hay pantalla de bienvenida con
botones: lo primero son las publicaciones.

1. PRIMERA ENTRADA, SIN SESIÓN (pantalla 1)
   - Arriba: logo Agendappx y botón de vidrio «Entrar» (para quien ya
     tiene cuenta).
   - Buscador «Cejas, uñas, barbería…» con micrófono, y chips: Cerca de
     ti, Cejas, Pestañas, Uñas, Barbería…
   - Debajo, el feed de Comunidad: publicaciones de los negocios ya
     registrados, cercanos primero. Cada una con negocio, ✔︎, tipo y
     distancia, «Seguir», la foto con la tarjeta de vidrio (servicio,
     precio, duración, próximo lugar y botón negro «Agendar»), me gusta,
     comentar, compartir y guardar.
   - Barra de abajo para visitantes: SOLO el botón Inicio (círculo de
     vidrio de 62 px) y, en el resto del ancho, una cápsula negra con
     ícono de tienda, «¿Tienes un salón?» y «Regístralo gratis ›».
     Ese botón abre el registro (paso 1).
   - Si alguien entra por el link de un salón (/ab-beauty-room), abre
     directo el perfil de ese salón, con la misma barra.

2. BUSCAR (pantalla 2): al escribir, por ejemplo «cejas», primero
   «Locales que hacen cejas» (tarjetas que se deslizan con foto,
   calificación, distancia y próximo lugar) y abajo la cuadrícula de
   trabajos con su precio. Sin importar acentos, mayúsculas ni plural.

3. AGENDAR SIN CUENTA (pantalla 3): al tocar «Agendar» en una foto, una
   hoja con el servicio y precio, horas libres de hoy en chips, nombre y
   WhatsApp, y «Pedir cita». Crea la cita `solicitada`; el salón la
   confirma por WhatsApp. (Mientras Explorar/Social reales no estén
   listos, déjalo como en la demostración de Comunidad.)

4. REGISTRO EN 3 PASOS (pantallas 4 a 6), con barrita de avance arriba
   y botón ‹ para regresar. Usa el registro por WhatsApp que ya
   publicaste (PR #10); solo cambia la apariencia y el orden:
   - Paso 1 «Registra tu salón»: +52 fijo, teclado numérico y «Enviar
     código por WhatsApp».
   - Paso 2 «Escribe el código»: 6 cuadros, a qué número llegó, vence en
     10 minutos y «Reenviar en 0:42».
   - Paso 3 «Crea tu salón»: tu nombre, negocio, colonia o ciudad, tipo
     de negocio en chips (Salón de belleza, Barbería, Uñas, Cejas y
     pestañas, Spa), aviso «30 días gratis, sin tarjeta» y «Crear mi
     salón». Turnstile y el consentimiento siguen igual.
   - Las invitaciones de equipo saltan el paso 3.

5. SALÓN LISTO (pantalla 7): «¡Listo, {nombre}!» y una lista para
   empezar: Crear tu salón (palomeado), Agrega tus servicios y precios,
   Pon tu horario, Vincula tu WhatsApp, Sube fotos de tus trabajos e
   Invita a tu equipo. Cada fila lleva a su pantalla y se palomea sola.
   Botón «Ir a mi agenda». La lista también queda en Mi negocio hasta
   completarla.

6. BARRA DEL NEGOCIO · OPCIÓN A (pantalla 8): Hoy · Agenda · ＋ ·
   Clientas · Negocio, todo en la misma cápsula de vidrio. El ＋ va al
   centro, dentro de la barra: círculo negro de 50 px (blanco en Dark).
   Al tocarlo abre un menú de vidrio con Nueva cita, Publicar trabajo,
   Nueva promoción y Bloquear horario, y el ＋ cambia a ✕ (como en
   ritmo/ios/registro.html, pantalla 8). Reemplaza al círculo separado
   de la derecha.

7. CORRECCIONES DE LA VISTA ACTUAL
   a. Horas siempre en 24 h (13:00, no 01:00 p. m.). No uses input
      type="time": en iPhone sale con a. m./p. m. Usa los selectores de
      24 h de Mi horario, también en apertura y cierre.
   b. Nueva cita como ritmo/ios/index.html (pantalla 5): servicio en
      tarjetas con foto que se deslizan, fecha y hora como pastillas
      grises y «Confirmar por WhatsApp» con interruptor verde, no
      casilla.
   c. Quita el botón ◐ de cada pantalla. White/Dark va solo en Mi
      negocio → Apariencia (y en el perfil de la clienta cuando entre).
   d. Agenda: especialistas como chips visibles (Todas · Alejandra ·
      Sofía), semana de lunes a domingo y citas a la misma hora lado a
      lado (ritmo/ios/index.html, pantalla 4).

Actualiza primero la vista previa publicada (neutro-ios) y mándame
capturas a 390 px en White y Dark de las 8 pantallas, del menú del ＋,
de Nueva cita y de Agenda. Después sigue con la etapa 1 en la app real.
No despliegues la app real sin mi confirmación.
```
