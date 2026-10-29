# Prompt para Codex: diseño Neutro iOS en toda la app (negocio, agenda, Social, Explorar y planes)

Pégalo completo en el chat de Codex. Junta en un solo encargo `PROMPT-DISENO-IOS.md` con las partes 3 y 4 de `PROMPT-CODEX.md` y la pantalla de planes.

```
Hola Codex. El registro por WhatsApp ya quedó (PR #10). Sigue el cambio de
diseño de TODA la app de Agendappx. Este mensaje manda sobre los
anteriores en lo que se refiera a diseño.

DE DÓNDE PARTIR
- Crea una rama nueva desde codex/agendappx-registro-whatsapp (último
  commit del PR #10) y abre PRs nuevos por etapa, encadenados sobre esa
  rama. No partas de ramas viejas.
- Primero dame un resumen corto: qué falta de los PRs #1 a #10 para
  unirlos y qué pantallas existen hoy en la app y en /comunidad/.

REFERENCIAS (rama claude/es-posible-esto-tjimmb, último commit)
- ritmo/docs/DISENO.md: colores y reglas del diseño Neutro.
- ritmo/docs/PROMPT-DISENO-IOS.md: medidas del estilo iPhone (léelo
  completo; aquí va resumido).
- Prototipos aprobados, que son el modelo de cada pantalla:
  - ritmo/ios/index.html: estilo iPhone (8 pantallas);
  - ritmo/negocio/index.html: modo negocio;
  - ritmo/explorar/index.html: Explorar;
  - ritmo/social/index.html: Social / Comunidad;
  - ritmo/planes/index.html: planes y Mi plan.
  Ignora la franja negra «Demostración» y sus selectores: no van en la app.
- Capturas en ritmo/imagenes/: app-ios-nativa.png,
  modo-negocio-neutro.png, explorar-social-neutro.png, planes-precios.png
  y app-iphone-android.png.
- Especificaciones: ritmo/docs/NEGOCIO.md, EXPLORAR.md y SOCIAL.md.

EL DISEÑO: «NEUTRO iOS»
- Blanco, negro y gris, sin rosa. Verde, ámbar y rojo solo para estados;
  estrellas en #F5A623; fotos reales de los trabajos.
- Piezas de iPhone (iOS 26):
  - letra del sistema (-apple-system, SF Pro, Inter);
  - fondo agrupado #F2F2F7 con celdas blancas (Dark: #000 y #1C1C1E);
  - títulos grandes de 33 px;
  - listas agrupadas con esquinas de 22 px y separadores de 0.5 px;
  - botones redondos y barra de pestañas flotante de vidrio (blur), con
    un círculo aparte a la derecha;
  - hojas que suben desde abajo con ✕ y ✓;
  - interruptores verdes, selector de fecha y hora nativo, control
    segmentado y buscador con micrófono.
- Botón principal: cápsula negra (blanca en Dark). Secundario: cápsula
  gris.
- White/Dark desde Ajustes → Apariencia. Respeta el área segura y
  «Reducir transparencia».
- Ícono de la app (PWA): cuadro negro con el calendario blanco.

ETAPA 1 · APARIENCIA DE LO QUE YA EXISTE (solo diseño)
Cambia al estilo nuevo, sin tocar datos, seguridad ni lógica:
- agenda, nueva cita, clientas, servicios (con su buscador),
  promociones y grupos de Facebook;
- inicio de sesión y registro con WhatsApp, MFA, invitaciones, equipo,
  Mi horario, perfil público del salón y ajustes de WhatsApp;
- Comunidad (/comunidad/), con el modelo de ritmo/social/.
Agenda como el Calendario del iPhone: semana con el día en círculo negro,
citas con fondo del color del servicio al 13 % y raya de color a la
izquierda, y línea roja de la hora actual.

ETAPA 2 · MODO NEGOCIO (NEGOCIO.md, modelo ritmo/negocio/)
- Pestañas: Hoy · Agenda · Clientas · Negocio, y el ＋ negro aparte
  (Nueva cita, Publicar trabajo y Nueva promoción).
- Hoy (nuevo): cifras del día, «Solicitudes desde la app» con Aceptar /
  Otra hora, «Siguen hoy» y la semana. Las solicitudes son citas en
  estado `solicitada`.
- Mi negocio: portada, Ver como cliente, Servicios y precios, Fotos de
  trabajos, Estadísticas (solo Admin), Reseñas con Responder, Equipo,
  Horarios, WhatsApp, Conexiones, Mi plan y Apariencia.
- Google/Apple Calendar en el detalle de cada cita.

ETAPA 3 · PLANES (modelo ritmo/planes/)
- Pantalla «Planes» para salones nuevos: Solo $249, Salón $449
  (recomendado) y Pro $799 MXN al mes, IVA incluido; Mensual/Anual con 2
  meses gratis; precio de fundadora $199 de por vida para los primeros 20
  salones; tabla para comparar y preguntas frecuentes.
- «Mi plan» dentro de Mi negocio: plan actual, días de prueba, lo que se
  usa (personas, Admin, WhatsApp, mensajes), pagos y datos de factura.
- Prueba gratis de 30 días al registrarse, sin tarjeta.
- Límites por plan (personas y Admin) aplicados en el servidor; al pasar
  el límite, invitar a subir de plan sin borrar nada.
- TODAVÍA NO conectes cobros reales: deja «Agregar tarjeta» como
  «Próximamente». Antes de cobrar, propónme Mercado Pago o Stripe con
  costos, facturación y cómo se cancela, y espera mi decisión.

ETAPA 4 · EXPLORAR Y SOCIAL REALES (EXPLORAR.md y SOCIAL.md)
- Para clientas: pestañas Explorar · Mis citas · Favoritos · Perfil, con
  el círculo de búsqueda aparte.
- Explorar: buscador, categorías con foto, «mejor calificados cerca»
  con la fórmula de EXPLORAR.md, perfil del salón (Precios, Fotos,
  Horarios, Reseñas) y «Agendar» que crea una cita `solicitada` real en
  la agenda del salón. «Mostrar mi salón» se puede apagar.
- Social: pasa Comunidad de demostración a real. Publicar solo negocios
  registrados, con cada foto ligada a un servicio; seguir, me gusta,
  guardar y comentar con sesión de WhatsApp; reportes y moderación para
  mí.
- Reseñas solo de citas completadas. Fotos comprimidas y sin ubicación.
- Las fotos de Pexels de ritmo/fotos/ son solo de ejemplo: no las uses en
  producción.

FUERA DE ALCANCE (solo en una app nativa): widgets y Live Activity. Los
avisos sí, con push de la PWA.

REGLAS
- Un PR por etapa. No mezcles diseño con seguridad.
- Conserva todo lo que funciona: registro y login por WhatsApp, MFA,
  RLS, sin conexión, sincronización, calendario, fotos, Facebook y
  FiNeCi sin tocar.
- WhatsApp sigue solo de envío; no actives citas, promociones ni nuevas
  vinculaciones sin que yo lo pida.
- Secretos fuera de Git.
- Pruebas: las que ya existen más las «Pruebas mínimas» de EXPLORAR.md y
  SOCIAL.md. Revisa todo a 390 px en White y Dark, compáralo con las
  capturas y mándame capturas de cada etapa.
- Pídeme confirmación antes de cada migración y de cada despliegue.

Antes de empezar, dime el plan por etapas, cuánto tardará cada una y si
necesitas algo de mí.
```
