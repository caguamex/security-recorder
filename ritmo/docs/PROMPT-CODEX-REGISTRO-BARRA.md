# Mensaje para Codex: bienvenida con registro, barra con el ＋ al centro y correcciones de la vista Neutro iOS

Pégalo completo en el chat de Codex.

```
Hola Codex. Revisé la vista Neutro iOS (PR #11). Está bien; agrega y
corrige esto en la vista y después en la app real.

MODELO: ritmo/ios/registro.html y su captura
ritmo/imagenes/app-ios-registro.png (rama claude/es-posible-esto-tjimmb,
último commit). Pantallas 1 a 6.

1. BIENVENIDA (pantalla 1): lo primero que ve alguien sin sesión.
   - Fotos de trabajos arriba (usa las de AB' Beauty Room), logo
     Agendappx, «Tu salón y tu agenda en un solo lugar» y una línea
     corta de para qué sirve.
   - Botón negro «Regístrate gratis», botón gris «Solo quiero agendar
     una cita» (lleva a Explorar sin cuenta) y abajo «¿Ya tienes cuenta?
     Inicia sesión».
   - Si alguien entra por el link de un salón (/ab-beauty-room), NO
     muestres la bienvenida: abre directo el perfil del salón.

2. EXPLORAR SIN CUENTA (pantalla 2): botón de vidrio «Entrar» arriba a
   la derecha y una tarjeta negra «¿Tienes un salón o barbería?
   Regístralo gratis 30 días» con botón «Regístrate».

3. REGISTRO EN 3 PASOS (pantallas 3 a 5), con barrita de avance arriba
   y botón ‹ para regresar. Usa el registro por WhatsApp que ya
   publicaste (PR #10); solo cambia la apariencia y el orden:
   - Paso 1 «Tu WhatsApp»: +52 fijo, teclado numérico y «Enviar código
     por WhatsApp».
   - Paso 2 «Escribe el código»: 6 cuadros, «Reenviar en 0:42» y
     «Prefiero recibirlo por correo» (déjalo oculto mientras el correo
     siga pendiente).
   - Paso 3 «Crea tu salón»: tu nombre, nombre del negocio, colonia o
     ciudad, tipo de negocio en chips (Salón de belleza, Barbería, Uñas,
     Cejas y pestañas, Spa), aviso «30 días gratis, sin tarjeta» y botón
     «Crear mi salón». Turnstile y el consentimiento siguen igual.
   - Al terminar, a Hoy. Las invitaciones de equipo saltan el paso 3.

4. BARRA DE ABAJO · OPCIÓN A (pantalla 6), para el modo negocio:
   Hoy · Agenda · ＋ · Clientas · Negocio, todo en la misma cápsula de
   vidrio. El ＋ va al centro, dentro de la barra: círculo negro de
   50 px (blanco en Dark). Al tocarlo abre un menú de vidrio arriba de
   la barra con Nueva cita, Publicar trabajo, Nueva promoción y
   Bloquear horario, y el ＋ cambia a ✕ (pantalla 8). Esto reemplaza al
   círculo separado a la derecha. La barra de clientas no cambia.

5. CORRECCIONES DE LA VISTA ACTUAL
   a. Horas siempre en 24 h (13:00, no 01:00 p. m.). No uses input
      type="time": en iPhone sale con a. m./p. m. Usa los selectores de
      24 h de Mi horario, también en apertura y cierre.
   b. Nueva cita como ritmo/ios/index.html (pantalla 5): servicio en
      tarjetas con foto que se deslizan, fecha y hora como pastillas
      grises y «Confirmar por WhatsApp» con interruptor verde, no
      casilla.
   c. Quita el botón ◐ de cada pantalla. White/Dark va solo en Mi
      negocio → Apariencia (y en Perfil para clientas).
   d. Agenda: especialistas como chips visibles (Todas · Alejandra ·
      Sofía), semana de lunes a domingo y citas a la misma hora lado a
      lado (ritmo/ios/index.html, pantalla 4).

Actualiza primero la vista previa publicada (neutro-ios) y mándame
capturas a 390 px en White y Dark de: bienvenida, los 3 pasos, Hoy con
la barra nueva, el menú del ＋, Nueva cita y Agenda. Después sigue con
la etapa 1 en la app real. No despliegues la app real sin mi
confirmación.
```
