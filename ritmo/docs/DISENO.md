# Diseño de Agendappx: Neutro

Estado: **aprobado por Antonio**. Sustituye al «minimalista 3D con acento rosa» en toda la app: modo negocio, Explorar, Social, cuentas y bienvenida.

- **Prototipos:** `ritmo/negocio/`, `ritmo/explorar/` y `ritmo/social/`. Abren en Neutro. El selector «Diseño» de la franja de demostración es solo para comparar con Rosa 3D y **no va en la app real**.
- **Capturas:** `ritmo/imagenes/modo-negocio-neutro.png`, `explorar-social-neutro.png` y `app-iphone-android.png`.

## Idea

- **Color:** blanco, negro y grises. El color lo ponen las fotos de los trabajos y de los servicios.
- **Relieve:** casi nada. Las tarjetas llevan una línea fina y una sombra muy suave, y los botones son planos.
- **Temas:** White y Dark, que se eligen en Ajustes → Apariencia. Los 5 temas de color se quedan como opción en Apariencia, pero el que viene por defecto es Neutro.

## Colores

| Uso | White | Dark |
|---|---|---|
| Fondo | `#F6F6F8` | `#000000` |
| Tarjeta | `#FFFFFF` | `#111114` |
| Texto principal (acento) | `#0B0B0F` | `#F5F5F7` |
| Texto secundario | `#3C3C43` | `#C7C7CC` |
| Texto tenue | `#8A8A8E` | `#8A8A90` |
| Líneas | `#EAEAEE` | `#1F1F23` |
| Fondo de íconos y fichas | `#F1F1F4` | `#17171B` |
| Texto sobre botón principal | `#FFFFFF` | `#0B0B0F` |

Estos colores se conservan solo para lo que indican:
- verde `#1E9E4A` / `#34C759`: abierto y confirmado;
- ámbar `#C27C0E` / `#E8B54A`: pendiente;
- rojo `#E5383B` / `#FF6B5E`: cancelado y errores;
- estrellas `#F5A623`.

En la agenda, cada servicio conserva su color, pero suave: 9 % del color sobre la tarjeta, sin sombra.

## Componentes

- **Tarjetas:**
  - esquinas de 16 px;
  - sombra `0 0 0 1px línea, 0 1px 2px rgba(0,0,0,.04)` en White y solo la línea en Dark.
- **Botón principal** («Agendar cita», «Aceptar», «Publicar»…):
  - fondo del color de texto principal (negro en White, blanco en Dark), con la letra al revés;
  - sin sombra.
- **Botón secundario:** tarjeta con línea fina.
- **Seleccionados** (día, hora, especialista, filtro): mismo estilo que el botón principal.
- **Barra de abajo:** íconos de línea. La pestaña activa va en texto principal. El ＋ es un círculo negro de 46 px.
- **Enlaces** («Ver todo», «Cancelar»): texto principal subrayado con línea tenue.
- **Íconos:** de línea, 1.8 px, sin emojis.
- **Insignias:** el ✔︎ de verificado va en texto principal, sin azul. Los contadores son círculos en texto principal.
- **Fotos:** las categorías de Explorar son tarjetas con foto y nombre en blanco sobre degradado oscuro, sin sombra.
- **Historias de Social:** el aro es negro (blanco en Dark) y, cuando ya se vieron, gris.
- **Ícono de la app:** cuadro negro con el calendario blanco, como en `herramientas/app-movil.html`.
- **Letra:** Inter, con pesos 400 a 800.
