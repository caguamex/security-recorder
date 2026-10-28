# Explorar: directorio de salones para clientas

Estado: propuesta para Agendappx, pendiente de que Antonio la apruebe.
- Prototipo: `ritmo/explorar/index.html` (publicado como «Agendappx Explorar»).
- Captura: `ritmo/imagenes/explorar-salones.png`.

Idea: un «Facebook» de salones. Cualquier persona entra, busca lo que necesita (cejas, pestañas, depilación…) y ve los salones registrados en Agendappx, **mejor calificados y más cercanos primero**. De ahí entra al salón: fotos de trabajos, precios, citas disponibles y reseñas. Puede pedir cita sin cuenta.

Se apoya en lo que ya está especificado: el perfil público de cada salón (`CUENTAS.md` 1b), su horario (1d), el inicio de sesión con WhatsApp (1) y los mensajes automáticos (`WHATSAPP-AUTOMATICO.md`).

## Pantallas

1. **Explorar (inicio)**:
   - «¿Qué te quieres hacer hoy?», buscador y 8 categorías (Cejas, Pestañas, Uñas, Depilación, Cabello, Maquillaje, Facial, Barbería);
   - «Mejor calificados cerca de ti» y la invitación «¿Tienes un salón? Súmate».
2. **Resultados** (al buscar o tocar una categoría):
   - tarjetas con 3 fotos, nombre, ✔︎ verificado, ⭐ calificación (número de reseñas), distancia, «Abierto · cierra 20:00»;
   - los servicios que coinciden con precio y duración, y el **próximo lugar** («Hoy 13:30»);
   - orden: Recomendados, Calificación, Cercanía o Precio;
   - filtros: «Con lugar hoy» y «Abierto en la noche».
3. **Perfil del salón**, con 4 pestañas:
   - **Precios**, con la categoría buscada primero y resaltada;
   - **Fotos** de trabajos;
   - **Disponibles**: días y horas libres;
   - **Reseñas**: promedio, barras por estrella y comentarios.
   - Botones «Agendar cita», ❤️ favorito e «Ir» (abre Google Maps o Apple Maps).
4. **Agendar**: servicio, día, hora, nombre y WhatsApp, con permiso para mensajes. Crea una cita `solicitada` en la agenda del salón; el salón la confirma y salen los WhatsApp automáticos.
5. **Mis citas**, **Favoritos** y **Perfil** («Entrar con WhatsApp» para ver sus citas en cualquier celular y dejar reseñas).

## Búsqueda y orden

- La búsqueda es por categoría, nombre de servicio o nombre del salón, sin importar acentos, mayúsculas ni plural (igual que el buscador de Servicios).
- **Recomendados** = 70 % calificación ajustada + 30 % cercanía.
  - Calificación ajustada (promedio bayesiano): `(reseñas × promedio + 20 × 4.5) / (reseñas + 20)`. Así un salón con 3 reseñas de 5 ★ no gana a uno con 200 reseñas de 4.8.
  - Cercanía: `1 / (1 + km / 3)`.
  - Sin pagos por aparecer arriba (por ahora).
- **Ubicación**: la app pide permiso de ubicación una vez. Si no lo da, la clienta elige ciudad o colonia. Solo se usa para calcular distancias y no se guarda la ubicación exacta.
- **Próximo lugar** y **Disponibles** salen de los horarios reales del salón (`CUENTAS.md` 1d) y de sus citas, sin mostrar datos de nadie.

## Reseñas confiables

- Solo puede reseñar quien **tuvo una cita completada** en ese salón (marca «✔︎ Cita verificada»).
- Después de la cita, el WhatsApp del salón manda «¿Cómo te fue? Califica aquí: link». Es un mensaje más de los automáticos, opcional y apagable.
- El salón puede responder reseñas, pero no borrarlas. Una reseña ofensiva se reporta y la revisa Antonio.

## Qué publica cada salón

- Aparecer en Explorar es **opcional** («Mostrar mi salón en Agendappx», encendido por defecto al registrarse).
- Se muestra: nombre, logo, fotos de trabajos, categorías, servicios con precio y duración, horario, dirección aproximada (colonia) con botón «Ir», calificación y reseñas.
- **Verificado ✔︎**: Antonio lo marca a mano al confirmar que el salón existe (dirección y WhatsApp).
- **Fotos**: cada salón sube las suyas desde su app, hasta 30, con compresión automática. Pueden reportarse.

## Fuera de alcance por ahora

Pagos en línea, anuncios o posiciones pagadas, chat dentro de la app y mapa con todos los salones.

## Pruebas mínimas

- Buscar «cejas», «pestaña», «depilacion» y el nombre de un salón da los resultados correctos.
- El orden «Recomendados» respeta la fórmula. Un salón con pocas reseñas no rebasa injustamente a uno con muchas.
- Un salón con «Mostrar mi salón» apagado no aparece.
- Las horas libres coinciden con la agenda real. Nunca se muestran clientas, teléfonos ni citas.
- No se puede reseñar sin una cita completada.
