# Prompt para Codex: cuentas, equipo y WhatsApp de Agendappx

Pégalo completo en el chat de Codex.

```
Hola Codex. Este es el encargo completo para la siguiente versión de Agendappx.
Reemplaza a todos los mensajes anteriores sobre cuentas y WhatsApp.

TODO ESTÁ EN LA RAMA claude/es-posible-esto-tjimmb (commit 9b603e1):
- ritmo/docs/CUENTAS.md: cuentas, roles, equipo, bienvenida, perfil público,
  dos Admin y «Mi horario»
- ritmo/docs/WHATSAPP-AUTOMATICO.md: WhatsApp vinculado, anticipo,
  mensajes automáticos, contactos y promociones
- Prototipo aprobado: ritmo/cuentas/index.html
  (vista navegable: https://claude.ai/artifact/BV5xqvaHhdosQnkvcQ7i8i;
  usa la franja «Demostración» de arriba para recorrerlo)
- Capturas en ritmo/imagenes/: cuentas-equipo.png, registro-correo.png,
  bienvenida-perfil-publico.png, whatsapp-anticipo.png y whatsapp-vincular.png
Lee los dos documentos completos antes de empezar. Si algo de este mensaje
no coincide con ellos, mandan los documentos.

REGLAS GENERALES
- Nombre visible: Agendappx. No renombres infraestructura ni compres dominios.
- Conserva el diseño publicado (3D, barra minimal, White/Dark) y todo lo que
  ya funciona: sin conexión, fotos, sincronización, calendario.
- Trabaja en una rama y un PR nuevos, por etapas.
- Secretos solo en Cloudflare, Railway o Supabase, nunca en Git.
- Pídeme confirmación antes de migrar mis datos, antes de cada despliegue
  y antes de vincular mi número de WhatsApp.

PARTE 1 · CUENTAS Y EQUIPO (CUENTAS.md)
1. Inicio de sesión solo con código de 6 dígitos por correo, sin contraseñas.
   Google y Apple quedan pospuestos (deja el código listo, sin botones).
   Conecta un SMTP gratuito (Resend o Brevo) y dime paso a paso cómo crear
   la cuenta. Verificación en dos pasos (app autenticadora) obligatoria
   para Admin.
2. Multi-salón desde el inicio (negocio_id en todo, reglas RLS). Por ahora
   solo AB' Beauty Room; mis datos actuales pasan a ese salón.
3. Roles Admin, Recepción y Especialista según la tabla de CUENTAS.md.
   Las especialistas ven solo lo suyo y los teléfonos les llegan ocultos
   desde el servidor.
4. Equipo: invitaciones por enlace de un solo uso (48 h); al aceptarla,
   la persona pone su correo, el código y confirma su perfil. «Quitar
   del equipo» corta el acceso al momento. El equipo entra SOLO por invitación.
5. Agenda por especialista (lista y columnas) e historial de cada cita.
6. DOS ADMIN EN EL MISMO SALÓN (sección 1c): la dueña y yo, cada quien con
   su correo. Lo que uno agenda, mueve o cancela le aparece al otro al
   momento (Supabase Realtime) y le llega un aviso en el celular (push de
   la PWA), por ejemplo: «Dueña del salón agendó una cita · Paola Vega ·
   hoy 15:30 con Karla».
7. MI HORARIO (sección 1d): cada persona pone qué días trabaja, de qué hora
   a qué hora, su hora de comida y días especiales (día libre, vacaciones,
   sale temprano). La agenda lo muestra rayado, Nueva cita solo ofrece esas
   horas (Admin puede agendar fuera con confirmación) y el link público
   solo muestra horas en que trabaja.
8. Bienvenida para quien entra por primera vez: ejemplo de agenda,
   servicios de prueba marcados como ejemplo y botones «Iniciar sesión» y
   «Registrarse». Registrarse sirve para que otras dueñas creen su salón.
9. Perfil público del salón (/ab-beauty-room): servicios, precios,
   duración, horarios libres de 7 días y «Pedir cita» sin cuenta, con
   casilla de permiso para WhatsApp. Nunca muestra datos de otras clientas.
   En Ajustes: «Tu link para clientas» con Copiar.
10. Respaldo diario y calendario .ics por persona.

PARTE 2 · WHATSAPP COMO EN FINECI (WHATSAPP-AUTOMATICO.md)
Autorizo usar la conexión de dispositivo vinculado (código de 8 dígitos),
como en FiNeCi, que me ha funcionado bien. Lo manejaremos con moderación.
Esto reemplaza la regla «nunca uses librerías no oficiales»; actualiza
AGENTS.md y BELLEZA.md. Si FiNeCi ya usa una librería para esto, usa la misma.

11. Servicio nuevo en Railway «agendappx-whatsapp», en un proyecto aparte,
    siempre prendido, 1 réplica. NO toques FiNeCi. La sesión va cifrada en
    Supabase (sin volumen). Cloudflare deja de enviar.
    Tengo plan Hobby con límite de 10 USD; llevo 1.20 USD en 12 días.
    Dime cuánto gastará y avísame el consumo real después de una semana.
12. Vincular desde la app: Ajustes → Mensajes de WhatsApp → escribo el
    número → la app me da el código de 8 dígitos → lo escribo en mi
    teléfono → «Vinculado». Si se desconecta, me avisa.
13. SOLO ENVÍA. No es chatbot: no lee, no guarda y no procesa mensajes
    entrantes, y no los marca como leídos. Las respuestas las veo yo en
    mi teléfono.
14. Mensajes automáticos:
    - al agendar (con los datos del anticipo si aplica);
    - anticipo recibido (cuando yo lo marco en la app);
    - el día de la cita a las 9:00 (o la noche anterior a las 19:00 si
      la cita es antes de las 11:00);
    - una hora antes, con la dirección (configurable: 30 min, 1 h o 2 h);
    - aviso si la cita cambia.
15. Anticipo: 30 % por defecto (20/30/50), solo servicios desde $300,
    plazo de 24 h, datos de transferencia configurables. Yo reviso el
    comprobante en mi teléfono y lo marco en la app. Si vence, avísame;
    no liberes el horario sin mi permiso.
16. Contactos y promociones (sección 7):
    - sincronizar nombre y número de los contactos del WhatsApp vinculado
      (nunca mensajes); yo elijo cuáles pasan a Clientas;
    - cada clienta tiene permiso de promociones;
    - «Enviar promoción»: elijo la promo, el mensaje con {nombre} y a quién
      (todas, por servicio, las que no vienen hace 30+ días o una por una);
    - envío programado: máximo 40 al día, de 10:00 a 19:00, con pausas de
      1 a 3 min, sin repetir a la misma clienta en 7 días, con avance
      visible y opción de pausar;
    - las bajas las marco yo a mano.
17. Moderación en todo: solo clientas con cita o con permiso, pausas de
    20 a 60 s entre recordatorios, máximo 30 por hora y 150 al día, nada
    entre 21:00 y 8:00, los recordatorios siempre antes que las promociones,
    y pausa automática de todo si WhatsApp rechaza mensajes.

ORDEN SUGERIDO
1) Cuentas, roles, equipo y migración de mis datos (pídeme confirmación).
2) Dos Admin con avisos, Mi horario, bienvenida y perfil público.
3) Servicio de WhatsApp en Railway, vinculación y mensajes automáticos.
4) Contactos y promociones.
Despliega cada etapa por separado, con mi confirmación.

PRUEBAS
Corre las «Pruebas mínimas» de CUENTAS.md y de WHATSAPP-AUTOMATICO.md, más
las que ya existen, y revisa todo a 390 px en White y Dark.

Antes de empezar, dime el plan por etapas, cuánto crees que tarda cada
una y qué necesitas de mí: cuenta de correo SMTP, número de WhatsApp, etc.
```
