// Pruebas del núcleo: repeticiones, festivos, exportar e importar.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../prototipo/core.js');

const starts = (it, a, b) => C.occurrenceStarts(it, a, b);

test('fechas: sumar días, meses y día de la semana', () => {
  assert.equal(C.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(C.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(C.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(C.weekday('2026-10-25'), 0);
  assert.equal(C.startOfWeek('2026-10-29', 1), '2026-10-26');
  assert.equal(C.startOfWeek('2026-10-29', 0), '2026-10-25');
  assert.equal(C.nthWeekday(2026, 11, 2, 2), '2026-11-10');
  assert.equal(C.nthWeekday(2026, 10, 5, -1), '2026-10-30');
});

test('repetición semanal con varios días y cada 2 semanas', () => {
  const gym = { date: '2026-10-26', repeat: { freq: 'weekly', interval: 1, days: [1, 3, 5] } };
  assert.deepEqual(starts(gym, '2026-10-25', '2026-11-01'), ['2026-10-26', '2026-10-28', '2026-10-30']);
  const terapia = { date: '2026-10-29', repeat: { freq: 'weekly', interval: 2, days: [4] } };
  assert.deepEqual(starts(terapia, '2026-10-25', '2026-11-30'), ['2026-10-29', '2026-11-12', '2026-11-26']);
});

test('repetición mensual: día fijo, quincena, n-ésimo día y meses cortos', () => {
  const renta = { date: '2026-01-31', repeat: { freq: 'monthly', interval: 1 } };
  assert.deepEqual(starts(renta, '2026-01-01', '2026-05-31'), ['2026-01-31', '2026-03-31', '2026-05-31']);
  const quincena = { date: '2026-10-31', repeat: { freq: 'monthly', interval: 1, monthDays: [15, -1] } };
  assert.deepEqual(starts(quincena, '2026-10-01', '2026-12-31'), ['2026-10-31', '2026-11-15', '2026-11-30', '2026-12-15', '2026-12-31']);
  const junta = { date: '2026-11-10', repeat: { freq: 'monthly', interval: 1, nth: 2, wd: 2 } };
  assert.deepEqual(starts(junta, '2026-11-01', '2027-01-31'), ['2026-11-10', '2026-12-08', '2027-01-12']);
});

test('repetición diaria con fin, anual y fechas excluidas', () => {
  const curso = { date: '2026-11-03', repeat: { freq: 'daily', interval: 1, until: '2026-11-05' } };
  assert.deepEqual(starts(curso, '2026-11-01', '2026-11-30'), ['2026-11-03', '2026-11-04', '2026-11-05']);
  const cumple = { date: '2024-02-29', repeat: { freq: 'yearly', interval: 1 } };
  assert.deepEqual(starts(cumple, '2025-01-01', '2028-12-31'), ['2028-02-29']);
  const conHueco = { date: '2026-10-26', repeat: { freq: 'daily', interval: 1 }, exdates: ['2026-10-27'] };
  assert.deepEqual(starts(conHueco, '2026-10-26', '2026-10-28'), ['2026-10-26', '2026-10-28']);
});

test('un evento de varios días aparece en cada día', () => {
  const viaje = { type: 'event', allDay: true, days: 3, date: '2026-11-12' };
  assert.deepEqual(C.occurrences(viaje, '2026-11-13', '2026-11-20').map(o => o.date), ['2026-11-13', '2026-11-14']);
});

test('columnas para eventos encimados', () => {
  const evs = C.layoutColumns([{ s: 600, e: 660 }, { s: 630, e: 690 }, { s: 700, e: 760 }]);
  assert.deepEqual(evs.map(e => [e.col, e.cols]), [[0, 2], [1, 2], [0, 1]]);
});

test('días festivos de México 2026', () => {
  const h = Object.fromEntries(C.holidaysMX(2026).map(x => [x.title, x.date]));
  assert.equal(h['Día de la Constitución'], '2026-02-02');
  assert.equal(h['Natalicio de Benito Juárez'], '2026-03-16');
  assert.equal(h['Viernes Santo'], '2026-04-03');
  assert.equal(h['Revolución Mexicana'], '2026-11-16');
  assert.equal(h['Transmisión del Poder Ejecutivo'], undefined);
  assert.ok(C.holidaysMX(2030).some(x => x.title === 'Transmisión del Poder Ejecutivo'));
});

test('describe repeticiones en español', () => {
  assert.equal(C.describeRepeat({ freq: 'weekly', interval: 1, days: [1, 3, 5] }, '2026-10-26'), 'Cada semana: lun, mié, vie');
  assert.equal(C.describeRepeat({ freq: 'monthly', interval: 1, nth: 2, wd: 2 }, '2026-11-10'), 'Cada mes el segundo martes');
  assert.equal(C.describeRepeat({ freq: 'monthly', interval: 1, monthDays: [15, -1] }, '2026-10-31'), 'Cada quincena (15 y fin de mes)');
  assert.equal(C.describeRepeat({ freq: 'weekly', interval: 1, days: [1, 2, 3, 4, 5], until: '2026-12-15' }, '2026-10-26'), 'Entre semana (lun a vie), hasta el 15 dic');
});

const MUESTRA = [
  { id: 'a1', type: 'event', title: 'Gym; pierna, glúteo', date: '2026-10-26', allDay: false, start: '07:00', end: '08:00', days: 1,
    repeat: { freq: 'weekly', interval: 1, days: [1, 3, 5], until: '2026-12-15' }, exdates: ['2026-10-28'], category: 'salud', location: 'Smart Fit', notes: 'Llevar toalla\ny agua' },
  { id: 'a2', type: 'event', title: 'Vacaciones en Oaxaca', date: '2026-12-20', allDay: true, start: null, end: null, days: 8, repeat: null, category: 'personal', location: '', notes: '' },
  { id: 'a3', type: 'task', title: 'Pagar tarjeta', date: '2026-10-31', allDay: false, start: null, end: null, days: 1,
    repeat: { freq: 'monthly', interval: 1, monthDays: [15, -1] }, category: 'personal', location: '', notes: '' },
  { id: 'a4', type: 'event', title: 'Junta de equipo', date: '2026-11-10', allDay: false, start: '09:00', end: '10:00', days: 1,
    repeat: { freq: 'monthly', interval: 1, nth: 2, wd: 2 }, category: 'trabajo', location: 'Sala 3', notes: '' },
  { id: 'a5', type: 'event', title: 'Fiesta', date: '2026-10-31', allDay: false, start: '22:00', end: '02:00', days: 1, repeat: null, category: 'personal', location: '', notes: '' },
];

test('exportar a .ics e importarlo de vuelta conserva los datos', () => {
  const ics = C.toICS(MUESTRA, { tz: 'America/Mexico_City', now: new Date(Date.UTC(2026, 9, 25, 12)) });
  assert.ok(ics.includes('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261215T235959'));
  assert.ok(ics.includes('EXDATE:20261028T070000'));
  assert.ok(ics.includes('SUMMARY:Gym\\; pierna\\, glúteo'));
  assert.ok(ics.includes('RRULE:FREQ=MONTHLY;BYDAY=2TU'));
  assert.ok(ics.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75));
  const back = C.parseICS(ics);
  assert.equal(back.length, 5);
  const gym = back[0];
  assert.equal(gym.title, 'Gym; pierna, glúteo');
  assert.equal(gym.start, '07:00');
  assert.equal(gym.end, '08:00');
  assert.deepEqual(gym.repeat, { freq: 'weekly', interval: 1, days: [1, 3, 5], until: '2026-12-15' });
  assert.deepEqual(gym.exdates, ['2026-10-28']);
  assert.equal(gym.notes, 'Llevar toalla\ny agua');
  assert.equal(gym.category, 'salud');
  assert.equal(back[1].allDay, true);
  assert.equal(back[1].days, 8);
  assert.equal(back[2].type, 'task');
  assert.deepEqual(back[2].repeat, { freq: 'monthly', interval: 1, monthDays: [15, -1] });
  assert.deepEqual(back[3].repeat, { freq: 'monthly', interval: 1, nth: 2, wd: 2 });
  assert.equal(back[4].end, '02:00');
});

test('importar .ics con zona horaria, UTC y COUNT', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT', 'SUMMARY:Llamada', 'DTSTART;TZID=America/Mexico_City:20261103T170000', 'DTEND;TZID=America/Mexico_City:20261103T173000',
    'RRULE:FREQ=DAILY;COUNT=3', 'BEGIN:VALARM', 'TRIGGER:-PT10M', 'END:VALARM', 'END:VEVENT',
    'BEGIN:VEVENT', 'SUMMARY:Vuelo', 'DTSTART:20261110T150000Z', 'DURATION:PT2H', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const [llamada, vuelo] = C.parseICS(ics);
  // 17:00 en Ciudad de México (UTC-6 en noviembre) son las 23:00 UTC; se convierte a la hora del equipo.
  const local = d => [C.toKey(d), C.pad(d.getHours()) + ':' + C.pad(d.getMinutes())];
  const [fecha, hora] = local(new Date(Date.UTC(2026, 10, 3, 23, 0)));
  assert.equal(llamada.date, fecha);
  assert.equal(llamada.start, hora);
  assert.equal(C.toMin(llamada.end) - C.toMin(llamada.start), 30);
  assert.equal(llamada.repeat.until, C.addDays(fecha, 2));
  // La hora del vuelo depende de la zona del equipo que corre la prueba: comprobamos la duración.
  assert.equal(C.toMin(vuelo.end) - C.toMin(vuelo.start), 120);
});

test('zip: lo que se escribe se puede leer', async () => {
  const z = C.zip([{ name: 'ritmo.ics', data: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n' }, { name: 'léeme.txt', data: 'Hola, ñandú' }]);
  const files = await C.unzip(z);
  assert.deepEqual(files.map(f => f.name), ['ritmo.ics', 'léeme.txt']);
  assert.equal(new TextDecoder().decode(files[1].bytes), 'Hola, ñandú');
});

test('CSV para Google Calendar expande repeticiones', () => {
  const csv = C.toGoogleCSV(MUESTRA, '2026-10-25', '2026-11-01');
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'Subject,Start Date,Start Time,End Date,End Time,All Day Event,Description,Location,Private');
  assert.ok(lines.includes('"Gym; pierna, glúteo",10/26/2026,7:00 AM,10/26/2026,8:00 AM,False,"Llevar toalla\ny agua",Smart Fit,True'));
  assert.ok(!lines.some(l => l.includes('10/28/2026') && l.startsWith('"Gym')));
  assert.ok(lines.some(l => l.startsWith('Pendiente: Pagar tarjeta,10/31/2026')));
  assert.ok(lines.some(l => l.startsWith('Fiesta,10/31/2026,10:00 PM,11/01/2026,2:00 AM')));
});

test('sanitizeItem valida lo que propone Claude', () => {
  const it = C.sanitizeItem({ title: '  Junta  ', type: 'event', date: '2026-13-01', start: '25:00', category: 'x', repeat: { freq: 'weekly', days: [1, 9] } }, '2026-10-25');
  assert.equal(it.title, 'Junta');
  assert.equal(it.date, '2026-10-25');
  assert.equal(it.allDay, true);
  assert.equal(it.category, 'personal');
  assert.deepEqual(it.repeat, { freq: 'weekly', interval: 1, days: [1] });
  assert.equal(C.sanitizeItem({ title: '' }, '2026-10-25'), null);
});
