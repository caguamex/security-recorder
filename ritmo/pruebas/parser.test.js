// Pruebas del intérprete de frases. Ejecuta: node --test ritmo/pruebas/
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../prototipo/parser.js');

const HOY = '2026-10-25'; // domingo
const opts = { today: HOY, nowMin: 10 * 60 };

// [frase, campos esperados]
const CASOS = [
  ['Dentista mañana a las 5pm', { title: 'Dentista', type: 'event', date: '2026-10-26', start: '17:00', end: '18:00', category: 'salud' }],
  ['Junta con el equipo el viernes de 10 a 11:30', { title: 'Junta con el equipo', date: '2026-10-30', start: '10:00', end: '11:30', category: 'trabajo' }],
  ['Comida con Ana el 3 de noviembre a las 14:00', { title: 'Comida con Ana', date: '2026-11-03', start: '14:00', end: '15:00', category: 'personal' }],
  ['Pagar la luz el 15', { title: 'Pagar la luz', type: 'task', date: '2026-11-15', start: null }],
  ['Gym lunes, miércoles y viernes 7am', { title: 'Gym', date: '2026-10-26', start: '07:00', repeat: { freq: 'weekly', interval: 1, days: [1, 3, 5] }, category: 'salud' }],
  ['Cumpleaños de mamá 12 de diciembre cada año', { title: 'Cumpleaños de mamá', type: 'event', allDay: true, date: '2026-12-12', repeat: { freq: 'yearly', interval: 1 }, category: 'familia' }],
  ['Clase de inglés todos los martes a las 6 pm', { title: 'Clase de inglés', date: '2026-10-27', start: '18:00', repeat: { freq: 'weekly', interval: 1, days: [2] }, category: 'estudio' }],
  ['Llamar al banco', { title: 'Llamar al banco', type: 'task', date: HOY }],
  ['Cita médica hoy 16:30 en Hospital Ángeles', { title: 'Cita médica', date: HOY, start: '16:30', end: '17:30', location: 'Hospital Ángeles', category: 'salud' }],
  ['Vacaciones del 20 al 27 de diciembre', { title: 'Vacaciones', allDay: true, date: '2026-12-20', days: 8 }],
  ['Reunión de padres el 5 de nov 8:00', { title: 'Reunión de padres', date: '2026-11-05', start: '08:00', category: 'familia' }],
  ['Pagar tarjeta cada quincena', { title: 'Pagar tarjeta', type: 'task', date: '2026-10-31', repeat: { freq: 'monthly', interval: 1, monthDays: [15, -1] } }],
  ['Junta de equipo el segundo martes de cada mes a las 9', { title: 'Junta de equipo', date: '2026-11-10', start: '09:00', repeat: { freq: 'monthly', interval: 1, nth: 2, wd: 2 } }],
  ['Correr diario 6:30', { title: 'Correr', date: HOY, start: '06:30', repeat: { freq: 'daily', interval: 1 } }],
  ['Cena con amigos el sábado a las 8', { title: 'Cena con amigos', date: '2026-10-31', start: '20:00' }],
  ['Examen de cálculo el jueves', { title: 'Examen de cálculo', type: 'event', allDay: true, date: '2026-10-29', category: 'estudio' }],
  ['Entregar reporte el lunes #chamba', { title: 'Entregar reporte', type: 'task', date: '2026-10-26', category: 'trabajo' }],
  ['Café @ Starbucks Reforma mañana 9am', { title: 'Café', date: '2026-10-26', start: '09:00', location: 'Starbucks Reforma' }],
  ['Yoga los martes y jueves de 7 a 8 am', { title: 'Yoga', start: '07:00', end: '08:00', repeat: { freq: 'weekly', interval: 1, days: [2, 4] }, date: '2026-10-27' }],
  ['Doctor en 2 semanas', { title: 'Doctor', allDay: true, date: '2026-11-08', category: 'salud' }],
  ['Junta mañana en la mañana', { title: 'Junta', date: '2026-10-26', start: '09:00' }],
  ['Partido de futbol esta noche', { title: 'Partido de futbol', date: HOY, start: '20:00' }],
  ['Curso del 3 al 7 de noviembre de 9 a 14', { title: 'Curso', date: '2026-11-03', start: '09:00', end: '14:00', repeat: { freq: 'daily', interval: 1, until: '2026-11-07' } }],
  ['Renovar pasaporte 30/11', { title: 'Renovar pasaporte', type: 'task', date: '2026-11-30' }],
  ['Cumple de Luis el 2 de febrero', { title: 'Cumple de Luis', allDay: true, date: '2027-02-02' }],
  ['Llamada con cliente 10:30-11', { title: 'Llamada con cliente', date: HOY, start: '10:30', end: '11:00', category: 'trabajo' }],
  ['Tarea: estudiar para el examen', { title: 'Estudiar para el examen', type: 'task', date: HOY, category: 'estudio' }],
  ['Comprar regalo para mamá el viernes', { title: 'Comprar regalo para mamá', type: 'task', date: '2026-10-30', category: 'familia' }],
  ['Cita con la nutrióloga el próximo lunes a las 11', { title: 'Cita con la nutrióloga', date: '2026-10-26', start: '11:00', category: 'salud' }],
  ['Clase de piano los lunes a las 5 y media', { title: 'Clase de piano', start: '17:30', repeat: { freq: 'weekly', interval: 1, days: [1] } }],
  ['Reunión 3pm por 2 horas', { title: 'Reunión', date: HOY, start: '15:00', end: '17:00' }],
  ['Dentista el martes de la próxima semana 4pm', { title: 'Dentista', date: '2026-10-27', start: '16:00' }],
  ['Aniversario 14 feb', { title: 'Aniversario', allDay: true, date: '2027-02-14' }],
  ['Ir al súper', { title: 'Ir al súper', type: 'task', date: HOY }],
  ['Pago de renta el 1 de cada mes', { title: 'Pago de renta', type: 'task', date: '2026-11-01', repeat: { freq: 'monthly', interval: 1, monthDays: [1] } }],
  ['Mañana 5pm doctor', { title: 'Doctor', date: '2026-10-26', start: '17:00' }],
  ['a las 10 desayuno con Pedro', { title: 'Desayuno con Pedro', date: HOY, start: '10:00' }],
  ['Boda de Luis y Ana el sábado 14 de noviembre', { title: 'Boda de Luis y Ana', allDay: true, date: '2026-11-14' }],
  ['Gym lunes y miércoles a las 7 hasta el 15 de diciembre', { title: 'Gym', start: '19:00', repeat: { freq: 'weekly', interval: 1, days: [1, 3], until: '2026-12-15' } }],
  ['Comida en casa de mi mamá el domingo 2pm', { title: 'Comida', location: 'Casa de mi mamá', date: HOY, start: '14:00', category: 'familia' }],
  ['Junta 9:00 hrs en Zoom', { title: 'Junta', start: '09:00', location: 'Zoom' }],
  ['Cena el viernes 8 de la noche', { title: 'Cena', date: '2026-10-30', start: '20:00' }],
  ['Terapia cada 2 semanas los jueves 6pm', { title: 'Terapia', start: '18:00', repeat: { freq: 'weekly', interval: 2, days: [4] }, date: '2026-10-29' }],
  ['Pagar la renta el último día de cada mes', { title: 'Pagar la renta', type: 'task', date: '2026-10-31', repeat: { freq: 'monthly', interval: 1, monthDays: [-1] } }],
  ['Comprar 2 mayonesas', { title: 'Comprar 2 mayonesas', type: 'task', date: HOY }],
  ['La próxima semana el jueves revisar contrato', { title: 'Revisar contrato', type: 'task', date: '2026-10-29' }],
  ['Mudanza la semana que viene', { title: 'Mudanza', allDay: true, date: '2026-10-26' }],
];

for (const [frase, esperado] of CASOS) {
  test(frase, () => {
    const r = P.parse(frase, opts);
    for (const [k, v] of Object.entries(esperado)) assert.deepEqual(r[k], v, `${k} en «${frase}»: ${JSON.stringify(r)}`);
  });
}

test('si la hora ya pasó y no hay fecha, se agenda para mañana', () => {
  const r = P.parse('Dentista 5pm', { today: HOY, nowMin: 18 * 60 });
  assert.equal(r.date, '2026-10-26');
});

test('inferCategory reconoce palabras con acentos', () => {
  assert.equal(P.inferCategory('Cita con el psicólogo'), 'salud');
  assert.equal(P.inferCategory('Entrega de cotización'), 'trabajo');
});
