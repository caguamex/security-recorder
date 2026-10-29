# Prompt para Codex: diseño estilo iPhone (Neutro iOS)

Pégalo completo en el chat de Codex.

```
Hola Codex. Cambia la apariencia de Agendappx al diseño «Neutro iOS»: el
mismo diseño Neutro (blanco, negro y gris, sin rosa) pero con las piezas
de una app nativa de iPhone (iOS 26). Es solo apariencia: no cambies
datos, lógica, rutas ni funciones.

REFERENCIA (rama claude/es-posible-esto-tjimmb, último commit):
- ritmo/ios/index.html: lámina con 8 pantallas; copia de ahí medidas y
  estilos (está en CSS normal, sin librerías).
- ritmo/imagenes/app-ios-nativa.png: captura de la lámina.
- ritmo/docs/DISENO.md: colores y reglas del diseño Neutro.
- Para las pantallas que no salen en la lámina, usa ritmo/negocio/,
  ritmo/explorar/, ritmo/social/ y ritmo/planes/ con este mismo estilo.

QUÉ CAMBIA
1. Letra del sistema: -apple-system, BlinkMacSystemFont, "SF Pro Text",
   Inter, system-ui, sans-serif (en iPhone se ve San Francisco).
2. Fondo agrupado como Ajustes del iPhone:
   - White: fondo #F2F2F7, celdas #FFFFFF;
   - Dark: fondo #000000, celdas #1C1C1E.
3. Títulos grandes: 33 px, peso 700, a la izquierda, con subtítulo gris
   (por ejemplo «Hoy» y «Martes 27 de octubre»). Arriba a la derecha, los
   botones son círculos de vidrio de 38 px.
4. Listas agrupadas: bloques con esquinas de 22 px y márgenes de 14 px.
   - Filas de 46 px mínimo y separadores de 0.5 px que empiezan después
     del ícono: rgba(60,60,67,.16) en White y rgba(84,84,88,.6) en Dark.
   - Títulos de sección en mayúsculas, 12.5 px, gris.
   - Flecha «›» gris a la derecha cuando la fila abre algo.
   - Íconos de fila en cuadros de 30 px con esquinas de 8 px, negros o
     grises, como en Ajustes.
5. Vidrio (Liquid Glass) en la barra de pestañas, los botones redondos
   y la barra de regresar:
   - White: fondo rgba(255,255,255,.72), backdrop-filter blur(18px)
     saturate(180%), borde interior de 0.5 px blanco y sombra
     0 6px 20px rgba(0,0,0,.10);
   - Dark: fondo rgba(30,30,32,.72).
   - Si el navegador no soporta backdrop-filter, usa la tarjeta sólida.
6. Barra de pestañas flotante (estilo iOS 26):
   - una cápsula de vidrio de 60 px de alto, a 12 px de los lados y a
     22 px del borde de abajo, más el área segura;
   - la pestaña activa lleva un fondo gris muy suave rgba(0,0,0,.07);
   - a la derecha, un círculo aparte de 60 px.
   - Negocio: Hoy · Agenda · Clientas · Negocio, y el círculo es el ＋
     negro (abre Nueva cita, Publicar trabajo y Nueva promoción).
   - Clientas (Explorar/Social): Explorar · Mis citas · Favoritos ·
     Perfil, y el círculo de vidrio es Buscar.
   - El contenido pasa por debajo de la barra (deja espacio abajo para
     que lo último se pueda leer).
7. Regresar: botón de vidrio en cápsula con «‹ Mi negocio» (el nombre de
   la pantalla anterior), arriba a la izquierda.
8. Hojas (Nueva cita, ficha de clienta, detalle de cita, filtros):
   - suben desde abajo con esquinas de 34 px y una rayita para jalar;
   - fondo agrupado y el resto de la pantalla oscurecido al 25 %;
   - arriba: ✕ en círculo de vidrio, título al centro y ✓ en círculo
     negro para guardar;
   - se cierran deslizando hacia abajo.
9. Controles del sistema:
   - interruptores verdes #34C759 de 51 × 31 px;
   - fecha y hora como pastillas grises rgba(118,118,128,.12) que abren
     el selector nativo del celular;
   - control segmentado gris con la opción elegida en blanco y sombra
     (por ejemplo Precios · Fotos · Horarios · Reseñas);
   - buscador gris con lupa y micrófono para dictar.
10. Botones: los principales son cápsulas negras con letra blanca
    (blancas con letra negra en Dark) y los secundarios, cápsulas grises
    rgba(118,118,128,.12). En el perfil del salón, «Agendar cita» va
    flotando abajo, en cápsula negra de 52 px.
11. Agenda como el Calendario del iPhone:
    - semana con el día elegido en círculo negro;
    - horas a la izquierda;
    - citas con fondo del color del servicio al 13 % y una raya de 3.5 px
      del color a la izquierda;
    - línea roja #FF3B30 de la hora actual con su etiqueta.
12. Perfil del salón: foto grande arriba, que se estira al bajar, con
    botones de vidrio encima (regresar, favorito, compartir) y el logo
    redondo encimado.
13. Ícono de la app (PWA): cuadro negro con el calendario blanco, igual que
    en la lámina. Actualiza manifest e íconos.

LO QUE NO CAMBIA
- Colores de Neutro (DISENO.md): sin rosa. Verde, ámbar y rojo solo para
  estados. Las estrellas van en #F5A623.
- White/Dark desde Ajustes → Apariencia; en Dark usa los valores de arriba.
- Todo lo que ya funciona: sin conexión, sincronización, calendario,
  fotos, grupos de Facebook y lo de cuentas y WhatsApp.

FUERA DE ALCANCE (solo se puede en una app nativa; no lo intentes en la
web): widgets en la pantalla de inicio y Live Activity en la pantalla
bloqueada. Los avisos sí: usa las notificaciones push de la PWA (iOS 16.4
o más nuevo, con la app agregada a la pantalla de inicio).

CÓMO TRABAJAR
- Rama y PR nuevos. Haz los cambios con variables de CSS (tokens) para
  que White y Dark salgan de los mismos estilos.
- Respeta el área segura (env(safe-area-inset-*)) arriba y abajo.
- Accesibilidad: contraste suficiente sobre el vidrio, áreas de toque de
  44 px mínimo, y si el celular tiene «Reducir transparencia» o
  prefers-reduced-transparency, usa fondos sólidos.
- Corre las pruebas que ya existen. Revisa todo a 390 px en White y Dark
  y compáralo con app-ios-nativa.png. Mándame capturas de Hoy, Agenda,
  Nueva cita, Clientas, Mi negocio, Explorar y el perfil del salón.
- Pídeme confirmación antes de desplegar.

Antes de empezar, dime qué pantallas vas a cambiar y cuánto tardarás.
```
