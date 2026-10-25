// Genera las imágenes de referencia a partir de la app real.
// Uso: node ritmo/herramientas/empaquetar.mjs && node ritmo/herramientas/capturas.mjs
// Requiere Playwright con Chromium.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const salida = join(raiz, 'imagenes');
mkdirSync(salida, { recursive: true });
const app = pathToFileURL(join(raiz, 'dist', 'ritmo.html')).href;
const AHORA = new Date('2026-10-27T10:40:00-06:00'); // martes

// Una semana realista (ficticia) alrededor del martes 27 de octubre de 2026.
const E = (o, i) => Object.assign({ id: 'd' + i, type: 'event', allDay: false, start: null, end: null, days: 1, repeat: null, category: 'personal', location: '', notes: '', exdates: [], doneDates: [], done: false }, o);
const DATOS = [
  { title: 'Gym', date: '2026-10-26', start: '07:00', end: '08:00', category: 'salud', location: 'Smart Fit', repeat: { freq: 'weekly', interval: 1, days: [1, 3, 5] } },
  { title: 'Dejar a los niños en la escuela', date: '2026-10-26', start: '07:40', end: '08:10', category: 'familia', repeat: { freq: 'weekly', interval: 1, days: [1, 2, 3, 4, 5] } },
  { title: 'Junta semanal de ventas', date: '2026-10-26', start: '09:30', end: '10:30', category: 'trabajo', location: 'Sala 3', repeat: { freq: 'weekly', interval: 1, days: [1] } },
  { title: 'Revisión de presupuesto', date: '2026-10-27', start: '10:00', end: '11:00', category: 'trabajo', location: 'Zoom' },
  { title: 'Llamada con Grupo Norte', date: '2026-10-27', start: '11:30', end: '12:15', category: 'trabajo', location: 'Google Meet' },
  { title: 'Comida con Mariana', date: '2026-10-27', start: '14:00', end: '15:30', location: 'El Cardenal' },
  { title: 'Dentista', date: '2026-10-27', start: '17:00', end: '18:00', category: 'salud', location: 'Consultorio Dra. Ruiz' },
  { title: 'Clase de inglés', date: '2026-10-27', start: '19:00', end: '20:30', category: 'estudio', repeat: { freq: 'weekly', interval: 1, days: [2, 4] } },
  { type: 'task', title: 'Enviar cotización a Grupo Norte', date: '2026-10-27', category: 'trabajo' },
  { type: 'task', title: 'Comprar regalo para Luis', date: '2026-10-27', done: true },
  { type: 'task', title: 'Renovar licencia de manejo', date: '2026-10-27' },
  { type: 'task', title: 'Llevar el coche al servicio', date: '2026-10-24' },
  { title: 'Entrega de reporte trimestral', date: '2026-10-28', start: '09:00', end: '10:00', category: 'trabajo' },
  { title: 'Junta de padres', date: '2026-10-28', start: '18:30', end: '19:30', category: 'familia', location: 'Colegio Montessori' },
  { title: 'Terapia', date: '2026-10-29', start: '16:00', end: '17:00', category: 'salud', repeat: { freq: 'weekly', interval: 2, days: [4] } },
  { title: 'Cena de cumpleaños de Luis', date: '2026-10-30', start: '20:30', end: '23:00', location: 'La Docena' },
  { title: 'Fútbol de Diego', date: '2026-10-31', start: '10:00', end: '11:30', category: 'familia', location: 'Deportivo Las Águilas' },
  { type: 'task', title: 'Pagar tarjeta', date: '2026-10-31', repeat: { freq: 'monthly', interval: 1, monthDays: [15, -1] } },
  { title: 'Ofrenda en casa de la abuela', date: '2026-11-01', start: '17:00', end: '20:00', category: 'familia' },
  { title: 'Examen de certificación', date: '2026-11-05', allDay: true, category: 'estudio' },
  { title: 'Viaje a Guadalajara', date: '2026-11-12', allDay: true, days: 3 },
  { title: 'Junta de equipo', date: '2026-11-10', start: '09:00', end: '10:00', category: 'trabajo', repeat: { freq: 'monthly', interval: 1, nth: 2, wd: 2 } },
].map(E);

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
async function abrir({ ancho, alto, escala, oscuro, vista, datos = true }) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: escala, isMobile: ancho < 700, hasTouch: ancho < 700, timezoneId: 'America/Mexico_City', locale: 'es-MX', colorScheme: oscuro ? 'dark' : 'light' });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(AHORA);
  await p.addInitScript(([items, v]) => {
    localStorage.setItem('ritmo.v1.items', JSON.stringify(items));
    localStorage.setItem('ritmo.v1.view', JSON.stringify(v));
  }, [datos ? DATOS : [], vista || 'agenda']);
  await p.goto(app);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  return p;
}
const foto = async (p, nombre) => { await p.screenshot({ path: join(salida, nombre) }); console.log('✓', nombre); };
const tel = { ancho: 390, alto: 844, escala: 3 };

let p = await abrir({ ...tel });
await foto(p, 'app-agenda.png');
await p.fill('#qinput', 'Cena con Ana el viernes a las 8 en Polanco');
await p.waitForTimeout(250);
await foto(p, 'app-escribe-como-hablas.png');
await p.fill('#qinput', 'Gym lunes, miércoles y viernes 7am');
await p.waitForTimeout(250);
await foto(p, 'app-repeticiones.png');
await p.fill('#qinput', '');
await p.evaluate(() => document.querySelector('[data-open="d6"]').click());
await p.waitForTimeout(350);
await foto(p, 'app-editor.png');
await p.context().close();

p = await abrir({ ...tel, oscuro: true, vista: 'dia' });
await foto(p, 'app-dia-oscuro.png');
await p.context().close();
p = await abrir({ ...tel, vista: 'semana' });
await foto(p, 'app-semana.png');
await p.context().close();
p = await abrir({ ...tel, vista: 'mes' });
await foto(p, 'app-mes.png');
await p.context().close();
p = await abrir({ ...tel, datos: false });
await foto(p, 'app-primera-vez.png');
await p.context().close();

const esc = { ancho: 1440, alto: 900, escala: 2 };
p = await abrir({ ...esc, vista: 'semana' });
await foto(p, 'escritorio-semana.png');
await p.context().close();
p = await abrir({ ...esc, oscuro: true, vista: 'mes' });
await foto(p, 'escritorio-mes-oscuro.png');
await p.context().close();
p = await abrir({ ...esc, vista: 'agenda' });
await foto(p, 'escritorio-agenda.png');
await p.context().close();

// Imágenes para tienda (1290×2796) e ícono, a partir de plantillas HTML
const plantilla = pathToFileURL(join(raiz, 'herramientas', 'tienda.html')).href;
const TIENDA = [
  ['tienda-1.png', 'app-escribe-como-hablas.png', 'Escribe como hablas', '«Dentista mañana 5pm» y listo.'],
  ['tienda-2.png', 'app-agenda.png', 'Tu día de un vistazo', 'Lo siguiente, lo pendiente y lo que viene.'],
  ['tienda-3.png', 'app-semana.png', 'Eventos y pendientes juntos', 'Una sola lista para lo que haces y lo que debes.'],
  ['tienda-4.png', 'app-mes.png', 'Todo tu mes, claro', 'Con los días festivos de México.'],
  ['tienda-5.png', 'app-dia-oscuro.png', 'De día y de noche', 'Tema oscuro que cuida tus ojos.'],
];
const ctx = await browser.newContext({ viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 1 });
const tp = await ctx.newPage();
for (const [nombre, captura, titulo, sub] of TIENDA) {
  const q = new URLSearchParams({ img: pathToFileURL(join(salida, captura)).href, t: titulo, s: sub });
  await tp.goto(plantilla + '?' + q);
  await tp.evaluate(() => document.fonts.ready);
  await tp.waitForTimeout(300);
  await foto(tp, nombre);
}
for (const [nombre, w, h, modo] of [['icono-1024.png', 1024, 1024, 'icono'], ['grafico-play-1024x500.png', 1024, 500, 'grafico']]) {
  await tp.setViewportSize({ width: w, height: h });
  const q = new URLSearchParams({ modo, img: pathToFileURL(join(salida, 'app-agenda.png')).href });
  await tp.goto(plantilla + '?' + q);
  await tp.evaluate(() => document.fonts.ready);
  await tp.waitForTimeout(300);
  await foto(tp, nombre);
}
await browser.close();
