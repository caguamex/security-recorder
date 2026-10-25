# Prompts para construir Ritmo

Cópialos tal cual. Están pensados para Claude Code (o Antigravity, Cursor, etc.) abierto en este repositorio, que ya tiene el prototipo funcional en `ritmo/prototipo/` y las imágenes en `ritmo/imagenes/`.

Orden recomendado: 1 → 2 → 3 → 4 → 5 → 6. Cada fase deja una app que funciona.

---

## 0. Prompt de arranque (pégalo primero en cualquier sesión nueva)

```text
Vas a construir "Ritmo", una app de agenda en español para México: la más intuitiva y simple de usar.
Lee primero, en este orden:
1. ritmo/docs/ESPECIFICACION.md (qué hace y cómo se ve)
2. ritmo/docs/PLAN.md (fases, stack y decisiones)
3. ritmo/prototipo/ (prototipo web funcional: es la referencia de comportamiento y diseño)
4. ritmo/imagenes/ (capturas de referencia de cada pantalla)
No cambies el diseño ni el comportamiento del prototipo sin decírmelo antes.
Resume en 10 líneas lo que entendiste y la lista de pantallas antes de escribir código.
```

## 1. Fase 1 — App móvil local (sin cuentas)

```text
Crea la app móvil de Ritmo en ritmo/app/ con Expo (React Native + TypeScript, Expo Router).
Requisitos:
- Copia la lógica pura del prototipo a TypeScript sin cambiar su comportamiento:
  ritmo/prototipo/core.js → src/core/ (fechas, repeticiones, festivos de México, ICS/CSV)
  ritmo/prototipo/parser.js → src/core/parser.ts (frases en español)
  Porta también las pruebas de ritmo/pruebas/ a Jest y haz que pasen todas.
- Guarda los datos en el teléfono con expo-sqlite (tabla items con el mismo modelo de la especificación).
- Pantallas: Agenda (inicio), Día, Semana, Mes, Editor (hoja inferior), Buscar, Ajustes.
- Barra fija abajo "Escribe: Dentista mañana 5pm" con vista previa en vivo, igual que el prototipo.
- Colores, tipografías (Archivo y Atkinson Hyperlegible Next con expo-font) y espaciados de la especificación. Tema claro y oscuro.
- Deshacer en cada acción (aviso inferior con "Deshacer").
Al terminar: corre las pruebas, corre `npx expo-doctor` y dime cómo abrirla en mi teléfono con Expo Go.
```

## 2. Fase 2 — Recordatorios y widgets

```text
Agrega a Ritmo:
- Recordatorios con expo-notifications: por defecto 10 minutos antes de cada evento con hora y a las 9:00 a.m. para pendientes del día. Campo "Recordarme" en el editor (sin aviso, a la hora, 10 min, 30 min, 1 h, 1 día antes).
- Al marcar un pendiente desde la notificación, se marca hecho sin abrir la app.
- Reprograma notificaciones al editar, borrar o repetir eventos (máximo 60 programadas, las más próximas).
- Widget de iOS y Android "Hoy": número del día con el marcatextos, lo siguiente y pendientes. Usa la imagen ritmo/imagenes/app-agenda.png como referencia.
Explícame qué permisos pide la app y en qué momento.
```

## 3. Fase 3 — Cuenta y sincronización

```text
Agrega cuentas y sincronización a Ritmo con Supabase:
- Inicio de sesión con Apple, Google y correo (enlace mágico). La app sigue funcionando sin cuenta.
- Tabla items con row level security: cada persona solo ve sus filas.
- Sincronización local primero: SQLite es la verdad en el teléfono; se sube y baja con updated_at y borrado lógico (deleted_at). Resolver conflictos con "gana el último cambio" por elemento.
- Al crear cuenta, sube lo que ya había en el teléfono.
- Exportar/importar .ics, .csv (Google Calendar) y respaldo .json, igual que el prototipo.
- Pantalla "Tus datos" con estado de sincronización y botón "Borrar mi cuenta" (lo exige Apple).
Dame la lista de variables de entorno que necesito y dónde las consigo.
```

## 4. Fase 4 — Calendarios del teléfono

```text
Conecta Ritmo con los calendarios del teléfono usando expo-calendar:
- En Ajustes, "Mostrar mis calendarios" permite elegir cuáles (Google, iCloud, Outlook) se muestran en Ritmo.
- Sus eventos se ven en todas las vistas con un estilo de solo lectura y el nombre del calendario.
- "Guardar también en mi calendario" opcional al crear un evento.
- Nunca borres ni edites eventos externos sin confirmación.
```

## 5. Fase 5 — Asistente con IA

```text
Agrega el asistente de Ritmo usando la API de Claude (modelo rápido para interpretar frases, modelo normal para preguntas) a través de una función en el servidor (Supabase Edge Function); la llave nunca va en la app.
- Botón ✨ en la barra: si el intérprete local no entiende la frase, la manda a Claude y muestra la vista previa antes de guardar. Reutiliza el prompt de aiParsePrompt en ritmo/prototipo/app.js.
- Hoja "Pregúntale a tu agenda" igual que el prototipo (askPrompt): responde y propone eventos que la persona agrega con un toque.
- Límite de uso por persona y mensajes claros cuando se alcance.
- Nunca mandes datos de la agenda sin que la persona use el asistente.
```

## 6. Fase 6 — Publicación

```text
Prepara Ritmo para publicarse:
- Configura EAS Build y EAS Submit para iOS y Android (perfiles development, preview, production).
- Ícono: ritmo/imagenes/icono-1024.png. Pantalla de inicio: fondo #1F3FD1 con el ícono.
- Capturas de tienda: ritmo/imagenes/tienda-1.png a tienda-5.png (1290×2796).
- Gráfico de Google Play: ritmo/imagenes/grafico-play-1024x500.png.
- Escribe el aviso de privacidad (México) y los textos de tienda en español usando ritmo/docs/PLAN.md.
- Dame la lista exacta de pasos que debo hacer yo en App Store Connect y Google Play Console.
```

---

## Prompts para diseño (Figma, Google Stitch, v0, Uizard)

```text
Diseña la app móvil "Ritmo", una agenda en español para México, intuitiva y simple.
Estilo: hoja de agenda. Fondo papel frío #F6F7F9, tarjetas blancas, texto grafito #131A25,
acciones en tinta azul de pluma #1F3FD1, "hoy" resaltado con marcatextos amarillo #FFE15A.
Categorías: Trabajo #0A8790, Personal #7448D6, Salud #1B9454, Familia #D9700F, Estudio #CF367C, Otro #657185.
Tipografía: Archivo condensada y gruesa para números y títulos; Atkinson Hyperlegible Next para texto.
Pantallas: Agenda (número del día grande con marcatextos, tarjeta "Lo siguiente", lista por días),
Día (línea de tiempo con línea roja de "ahora"), Semana (tarjetas por día), Mes (cuadrícula con puntos de color),
Editor en hoja inferior, Ajustes. Barra fija abajo para escribir "Dentista mañana 5pm" con vista previa en chips.
Usa como referencia las imágenes adjuntas (ritmo/imagenes/app-*.png).
```

## Prompts para imágenes (Midjourney, Imagen, GPT Image, Nano Banana)

Ícono alternativo:
```text
App icon, flat vector, a white rounded calendar page with two dark blue binder rings on a vivid ultramarine blue (#1F3FD1) background, a bold blue heartbeat/rhythm line crossing the page over a yellow highlighter stroke (#FFE15A), minimal, no text, centered, iOS app icon style, 1024x1024
```

Foto de estilo de vida para redes:
```text
Lifestyle photo, a young Mexican professional holding a smartphone showing a clean calendar app with a big "27" highlighted in yellow, warm morning light in a Mexico City café, shallow depth of field, natural colors, no visible brand logos
```

Fondo para anuncios:
```text
Minimal background for an app ad, ultramarine blue (#1F3FD1) with a subtle paper texture and a single hand-drawn yellow highlighter stroke, lots of empty space for text, 9:16
```

## Prompts de revisión (úsalos al final de cada fase)

```text
Revisa Ritmo como si fueras una persona de 60 años que nunca ha usado una agenda digital.
Intenta: agregar una cita con el doctor, una que se repite cada martes, marcar un pendiente como hecho,
borrar algo por error y recuperarlo. Dime cada momento de duda y propone el cambio mínimo para quitarlo.
```

```text
Revisa la accesibilidad de Ritmo: contraste en tema claro y oscuro, tamaños de toque (mínimo 44 px),
lectores de pantalla (VoiceOver y TalkBack) y texto grande del sistema. Arregla lo que falle.
```
