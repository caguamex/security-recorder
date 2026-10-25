# Especificación de Ritmo

Referencia de comportamiento: `ritmo/prototipo/`. Referencia visual: `ritmo/imagenes/`.

## Pantallas

| Pantalla | Qué muestra | Imagen |
|---|---|---|
| Agenda (inicio) | Número del día con marcatextos, día de la semana, conteo de eventos y pendientes, tarjeta "Ahora / Lo siguiente", vencidos con "Pasar a hoy", lista por días (hoy y mañana siempre visibles), festivos | `app-agenda.png` |
| Día | Tira de 7 días con puntos de color; lista de todo el día y pendientes; línea de tiempo con línea roja de "ahora"; toca un hueco para crear a esa hora | `app-dia-oscuro.png` |
| Semana | Teléfono: tarjetas por día. Pantalla ancha: rejilla de 7 columnas con fila "Todo el día" | `app-semana.png`, `escritorio-semana.png` |
| Mes | Cuadrícula con puntos (teléfono) o chips (ancha); festivos oficiales subrayados en rojo; lista del día elegido debajo | `app-mes.png`, `escritorio-mes-oscuro.png` |
| Barra para escribir | Siempre abajo. Vista previa en vivo con chips (fecha, hora, repetición, lugar, categoría). Enter guarda | `app-escribe-como-hablas.png`, `app-repeticiones.png` |
| Editor | Hoja inferior: Evento / Pendiente, título, fecha, todo el día, horas, repetir, días de la semana, fin de repetición, categoría, lugar, notas; "Toda la serie / Solo este día" en repeticiones | `app-editor.png` |
| Primera vez | Ejemplos marcados como tales que desaparecen al agregar algo propio | `app-primera-vez.png` |
| Buscar | Por título, lugar o notas; resultados por próxima fecha | — |
| Ajustes | Semana empieza en domingo/lunes, formato de hora, festivos, categorías visibles, exportar/importar, borrar todo, atajos | — |
| Pregúntale a tu agenda | Sugerencias, respuesta breve y propuestas con "Agregar" | — |

## Modelo de datos

```ts
type Item = {
  id: string;
  type: 'event' | 'task';
  title: string;
  date: string;            // 'AAAA-MM-DD', fecha local (inicio de la serie si se repite)
  allDay: boolean;
  start: string | null;    // 'HH:MM'
  end: string | null;      // si es menor que start, termina al día siguiente
  days: number;            // eventos de todo el día de varios días
  repeat: null | {
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    days?: number[];       // semanal: 0 = domingo … 6 = sábado
    monthDays?: number[];  // mensual: [15, -1] = quincena; -1 = último día
    nth?: number; wd?: number; // mensual: "segundo martes" → nth 2, wd 2; nth -1 = último
    until?: string;
  };
  exdates: string[];       // ocurrencias borradas
  doneDates: string[];     // pendientes repetidos hechos por ocurrencia
  done: boolean;           // pendientes sin repetición
  category: 'trabajo' | 'personal' | 'salud' | 'familia' | 'estudio' | 'otro';
  location: string;
  notes: string;
  createdAt: string; updatedAt: string;
};
```

## Reglas del intérprete de frases

- Horas sin a.m./p.m.: de 1 a 7 son de la tarde, de 8 a 11 de la mañana; "cena", "fiesta", "comida" sugieren tarde; "desayuno", "correr" sugieren mañana.
- Sin fecha y con una hora que ya pasó hoy: se agenda para mañana.
- Sin hora: si empieza con verbo de acción (pagar, comprar, llamar…) es pendiente; si tiene fecha, evento de todo el día.
- Entiende: hoy, mañana, pasado mañana, el viernes, el próximo lunes, el martes de la próxima semana, en 2 semanas, el 15, 3 de noviembre, 30/11, del 20 al 27 de diciembre, esta noche, en la mañana, de 10 a 11:30, 5 y media, por 2 horas, diario, entre semana, los martes y jueves, cada 2 semanas, cada quincena, el segundo martes de cada mes, el último día de cada mes, cada año, hasta el 15 de diciembre, @lugar, en Lugar Con Mayúsculas, en casa de mi mamá, #trabajo.
- Lo que no entiende queda en el título; la vista previa siempre muestra el resultado antes de guardar.

## Diseño

| Token | Claro | Oscuro |
|---|---|---|
| Papel | #F6F7F9 | #0D1219 |
| Hoja | #FFFFFF | #151B24 |
| Tinta | #131A25 | #E9EEF5 |
| Pluma (acciones) | #1F3FD1 | #8FA3FF |
| Marcatextos (hoy) | #FFE15A | #E8CE48 |
| Ahora | #E5484D | #FF6B6E |

Categorías (claro / oscuro): Trabajo #0A8790 / #35C0C7 · Personal #7448D6 / #A98BFA · Salud #1B9454 / #4CCB8B · Familia #D9700F / #F4A04B · Estudio #CF367C / #F06BAA · Otro #657185 / #98A3B5.

Tipografía: **Archivo** (ancho condensado, 700–900) para números, fechas y títulos; **Atkinson Hyperlegible Next** para todo el texto. Toques mínimos de 44 px. Respetar "reducir movimiento".

## Festivos de México

Descanso obligatorio (art. 74 LFT): 1 ene, primer lunes de febrero, tercer lunes de marzo, 1 may, 16 sep, 1 oct cada seis años (2030, 2036…), tercer lunes de noviembre, 25 dic. Fechas que se celebran: Jueves y Viernes Santo, Día del Niño, Día de las Madres (10 may), Día del Padre (tercer domingo de junio), Día de Muertos, Virgen de Guadalupe, Nochebuena.
