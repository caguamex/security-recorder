# Agendappx Social: red de trabajos de belleza

Estado: propuesta, pendiente de que Antonio la apruebe.
- Prototipo: `ritmo/social/index.html` (publicado como «Agendappx Social»).
- Captura: `ritmo/imagenes/social-belleza.png`.

Idea: un «Facebook» o «Instagram» para salones de belleza, barberías, uñas, cejas y pestañas. Los negocios que usan la agenda de Agendappx **publican fotos de sus trabajos**. La gente sigue negocios, busca («cortes», «barberías», «uñas»…), ve los locales que hacen eso y **agenda desde la misma foto**. Extiende `EXPLORAR.md`: Explorar es el buscador y Social es el feed.

## Pantallas

1. **Inicio**: historias de los negocios que sigue y feed de trabajos. Cada publicación lleva:
   - negocio, ✔︎ verificado, tipo y distancia, y el botón «Seguir»;
   - la foto, con una tarjeta encima que dice el servicio, precio, duración y botón **«Agendar»**;
   - me gusta, comentarios, compartir y guardar;
   - descripción, etiquetas (#fade #unas) y fecha.
2. **Buscar**:
   - buscador y categorías: Cortes, Barbería, Uñas, Cejas, Pestañas y Color;
   - al buscar, primero **«Locales que hacen cortes»**, ordenados por calificación y cercanía, y abajo la cuadrícula de **trabajos** con precio y me gusta;
   - sin búsqueda, los trabajos más populares cerca.
3. **Perfil del negocio**:
   - número de trabajos, seguidores, calificación y reseñas;
   - botones «Agendar», «Seguir» y WhatsApp;
   - destacados por categoría;
   - 3 pestañas: cuadrícula de **trabajos**, **servicios y precios** (cada uno con «Agendar») y **reseñas** verificadas.
4. **Ver un trabajo**: foto grande, la tarjeta para agendar y comentarios.
5. **Agendar desde la foto**: ya trae el servicio y el precio; la persona elige la hora y deja su WhatsApp. Crea una cita `solicitada` en la agenda del negocio, y salen los WhatsApp automáticos.
6. **Publicar** (botón + del negocio):
   - foto (cámara o galería);
   - **«¿Qué servicio es?»**, que liga la foto a un servicio de su agenda con su precio;
   - descripción y «Publicar».
   - Aparece en su perfil, en el inicio de sus seguidores y en las búsquedas.

## Reglas

- **Solo publican negocios** registrados en Agendappx (Admin o quien Admin autorice). Las clientas comentan, dan me gusta, guardan y siguen.
- **Cada foto se liga a un servicio** de la agenda. Así el precio y la duración siempre son los reales, y «Agendar» abre ese servicio.
- El orden del inicio es: negocios que sigues, luego popular cerca de ti, y siempre lo más reciente primero dentro de cada grupo.
- **Comentarios**:
  - los negocios pueden ocultarlos o borrarlos;
  - cualquiera puede reportar una foto o un comentario;
  - Antonio modera los reportes.
- **Fotos**:
  - se comprimen y se quitan los datos de ubicación del archivo;
  - con caras de clientas, el negocio confirma al publicar que tiene su permiso;
  - máximo 10 publicaciones al día por negocio.
- **Reseñas**: solo de citas completadas (ver `EXPLORAR.md`).
- Comentar, seguir y guardar requieren entrar con WhatsApp. Ver trabajos y agendar no.

## Fuera de alcance por ahora

Mensajes privados dentro de la app (se usa WhatsApp), videos o reels, anuncios pagados y venta de productos.

## Pruebas mínimas

- Una foto sin servicio ligado no se puede publicar.
- «Agendar» desde una foto abre ese servicio con el precio actual de la agenda.
- La búsqueda «cortes» muestra barberías y sus trabajos de corte, sin uñas ni cejas.
- Un comentario reportado 3 veces se oculta hasta que se revise.
- Al quitar la ubicación de una foto subida no queda ningún dato GPS en el archivo.
