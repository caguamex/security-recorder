# Plan y logística de Ritmo

## La idea en una frase

Una agenda en español donde **escribes como hablas** ("Dentista mañana 5pm", "Gym lunes, miércoles y viernes 7am", "Pagar tarjeta cada quincena") y todo queda acomodado, con eventos y pendientes en una sola lista.

## Principios (deciden cualquier duda de diseño)

1. **Una barra, cero formularios.** Lo normal se agrega escribiendo una frase; el editor completo es opcional.
2. **Lo siguiente primero.** Al abrir, ves el día, lo que sigue y lo que tienes pendiente.
3. **Todo se puede deshacer.** Ninguna acción pide "¿estás seguro?" salvo borrar series o la agenda completa.
4. **Hecha para México.** Español natural, quincenas, días festivos oficiales, formato 5:00 p.m., semana que empieza en domingo.
5. **Funciona sin cuenta y sin internet.** La cuenta solo sirve para tener lo mismo en todos tus dispositivos.

## Qué ya existe (hecho en esta sesión)

| Pieza | Dónde | Estado |
|---|---|---|
| Prototipo web funcional | `ritmo/prototipo/` y enlace privado en Claude | Listo |
| Versión de un solo archivo (abre con doble clic) | `ritmo/dist/ritmo.html` | Lista |
| Intérprete de frases en español | `ritmo/prototipo/parser.js` | 47 frases probadas |
| Repeticiones, festivos de México, exportar/importar .ics/.csv/.json | `ritmo/prototipo/core.js` | Probado |
| Pruebas automáticas | `ritmo/pruebas/` (`node --test ritmo/pruebas/`) | 62 de 62 pasan |
| Imágenes de referencia, tienda, ícono y gráfico de Play | `ritmo/imagenes/` | Listas |
| Prompts por fase | `ritmo/docs/PROMPTS.md` | Listos |

## Cómo competir

| App | Fuerte en | Dónde gana Ritmo |
|---|---|---|
| Google Calendar | Gratis, en todos lados | Frases en español natural, pendientes en la misma lista, más simple |
| Calendario de Apple | Integrado al iPhone | Funciona igual en Android y web; quincenas y festivos de México |
| Fantastical | Lenguaje natural | Precio local, español primero, Android |
| TickTick / Todoist | Tareas | Agenda con horas y vista de día real |

Antes de lanzar, verifica que el nombre "Ritmo" esté libre en App Store, Google Play y en el IMPI (marcanet.impi.gob.mx). Alternativas: Pauta, Agendín, Mi Ritmo.

## Stack recomendado

- **App:** Expo (React Native + TypeScript). Un solo código para iPhone, Android y web; compilas en la nube con EAS, sin necesidad de Mac.
- **Datos en el teléfono:** expo-sqlite (funciona sin internet).
- **Cuentas y sincronización:** Supabase (Postgres + inicio de sesión + funciones).
- **Notificaciones:** expo-notifications. **Calendarios del teléfono:** expo-calendar.
- **IA:** API de Claude desde una función de Supabase (la llave nunca en la app).

## Fases y tiempos estimados

| Semana | Fase | Resultado |
|---|---|---|
| 1–2 | 1. App local | Ritmo en tu teléfono con Expo Go, todo guardado en el teléfono |
| 3 | 2. Recordatorios y widget | Avisos antes de cada evento, widget "Hoy" |
| 4–5 | 3. Cuenta y sincronización | Mismos datos en celular, tablet y web |
| 6 | 4. Calendarios del teléfono | Ver Google/iCloud dentro de Ritmo |
| 7 | 5. Asistente | ✨ para frases difíciles y "Pregúntale a tu agenda" |
| 8 | 6. Publicación | Beta (TestFlight / prueba interna de Play) y luego tiendas |

Los tiempos suponen trabajar unas horas al día con un agente de código. Cada fase termina con una app usable.

## Costos (verifica precios actuales antes de pagar)

| Concepto | Costo aproximado | Cuándo |
|---|---|---|
| Apple Developer Program | 99 USD al año | Antes de TestFlight (fase 6) |
| Google Play Console | 25 USD, un solo pago | Antes de la prueba interna (fase 6) |
| Expo / EAS | Plan gratuito con compilaciones limitadas; planes de pago si compilas mucho | Desde la fase 1 |
| Supabase | Plan gratuito suficiente para empezar | Fase 3 |
| API de Claude | Pago por uso; interpretar una frase cuesta centavos | Fase 5 |
| Dominio (ritmo.app o similar) | 10–40 USD al año | Antes de lanzar |

## Lo que necesito de ti (y cuándo)

- **Ahora:** nada. Todo está en el repositorio, en la rama `claude/es-posible-esto-tjimmb`.
- **Fase 1:** una cuenta gratuita de Expo (expo.dev) e instalar **Expo Go** en tu teléfono.
- **Fase 3:** una cuenta de Supabase y pegar sus llaves en los secretos del entorno.
- **Fase 6:** cuentas de Apple Developer y Google Play a tu nombre o al de tu empresa.

No necesitas tener la computadora encendida: puedes pedir cada fase desde Claude Code en la web o el celular con este mismo repositorio.

## Modelo de negocio sugerido

- **Gratis:** agenda completa, frases en español, festivos, exportar, un dispositivo.
- **Ritmo Plus (≈ 49 MXN al mes o 399 MXN al año):** sincronización entre dispositivos, asistente con IA, widgets extra y temas.
- Sin anuncios. La confianza vale más que unos centavos por anuncio en una agenda personal.

## Textos de tienda

- **Nombre:** Ritmo: agenda en español
- **Subtítulo:** Escribe como hablas
- **Descripción corta:** Tu agenda y tus pendientes en un solo lugar. Escribe «Dentista mañana 5pm» y listo.
- **Descripción:**
  Ritmo es la agenda más fácil de usar. Escribe como hablas: «Junta el viernes de 10 a 11:30», «Gym lunes, miércoles y viernes 7am» o «Pagar tarjeta cada quincena», y Ritmo lo acomoda solo.
  • Eventos y pendientes en una sola lista
  • Vistas de agenda, día, semana y mes
  • Repeticiones: cada semana, entre semana, cada quincena, el segundo martes de cada mes…
  • Días festivos de México
  • Deshacer en todo
  • Tema claro y oscuro
  • Exporta a Google Calendar, Apple y Outlook
- **Palabras clave:** agenda, calendario, citas, pendientes, recordatorios, planificador, organizador, quincena, español

## Privacidad (México)

- Publica un aviso de privacidad conforme a la ley mexicana de protección de datos personales vigente. Pide a un abogado que lo revise antes de lanzar.
- Sin cuenta, los datos nunca salen del teléfono. Con cuenta, se guardan cifrados en tránsito y solo los ve su dueño.
- El asistente solo envía datos cuando la persona lo usa, y se dice claramente.
- Botón para borrar la cuenta y todos los datos (requisito de Apple).

## Métricas para saber si vamos bien

- Retención: personas que vuelven al día 1, 7 y 30.
- Elementos agregados por semana por persona.
- Porcentaje agregado con la barra de frases (meta: más del 70 %).
- Frases que el intérprete no entendió (para mejorarlo).

## Lista de lanzamiento

- [ ] Nombre verificado en tiendas e IMPI
- [ ] Pruebas automáticas pasando
- [ ] Prueba con 5 personas reales (usa el prompt de revisión en PROMPTS.md)
- [ ] Aviso de privacidad publicado en una página web
- [ ] Ícono, capturas y gráfico subidos
- [ ] Formulario de seguridad de datos (Play) y etiquetas de privacidad (App Store)
- [ ] Beta en TestFlight y prueba interna de Google Play
- [ ] Publicación
