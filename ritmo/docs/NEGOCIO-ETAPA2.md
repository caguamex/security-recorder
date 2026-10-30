# Modo negocio — etapa 2

Rama codex/agendappx-negocio-etapa2, desde b0b5963 del PR #12. Antonio autorizó publicar todas las etapas; la migración de esta etapa recibió además «Sí, respalda y aplica esta migración». La aprobación no habilita cobros, avisos de citas/promociones ni nuevas vinculaciones.

## Implementación

- Cuatro pestañas Hoy, Agenda, Clientas y Negocio. El círculo Crear abre Nueva cita, Publicar trabajo y Nueva promoción. Se conservan Servicios, buscador, fotos, promociones y Facebook dentro de Mi negocio. White/Dark solo en Apariencia.
- Hoy usa datos de la agenda autorizada, sin cifras inventadas: citas del día, estimación por precios actuales, solicitudes, anticipos y próximas citas. Recepción no ve ingresos; Especialista solo muestra cifras propias. Solicitudes se aceptan con confirmación de pantalla y pasan a confirmada/apartada; Otra hora conserva solicitada. La escritura conserva el protocolo de versiones/conflictos y la cola sin conexión. Los envíos reales siguen deshabilitados.
- Mi negocio tiene portada a partir de una fotografía ya subida por el salón, acceso a catálogo, fotos, equipo, horarios, WhatsApp, conexiones, promociones y apariencia. No se inventan sellos, seguidores ni reseñas. Perfil público, reseñas reales, publicar trabajos y Mi plan se conectan en etapas 3–4; mientras tanto sus pantallas explican que están pendientes. Comunidad sigue siendo demo hasta la etapa 4.
- Estadísticas consultadas en servidor solo para Admin con MFA y membresía vigente. Ingresos estimados del día/mes y citas completadas reales. Sin falsas visitas/me gusta antes de contar eventos públicos.
- Mi horario: semana de lunes a domingo, selectores HH:mm, descanso, comida y días especiales. Cada integrante edita solo su horario; Admin puede editar el de cualquier miembro activo. Sin editar citas existentes ni cambiarlas al modificar turnos. Guardado explícito y validación tanto en API como en SQL.
- Asignaciones de servicios y permiso Ver agenda de todas desde Equipo, únicamente Admin con MFA. La API impide cambiar rol mediante este formulario y rechaza servicios de otro salón. La lista conserva la proyección de teléfonos existente.
- Nueva cita permite especialista, disponibilidad por turno/comida/día especial y excepción explícita fuera de turno solo Admin. Validación del servidor serializada por salón impide empalmes por persona incluso con una excepción. Las fechas/horas ya guardadas permanecen intactas. Agenda muestra fuera de turno rayado al filtrar una persona.
- Detalle de cada cita conserva Google y añade Apple mediante .ics de esa cita, sin teléfonos ni notas. La suscripción privada sigue en Conexiones.
- Mensajero: solicitada no crea avisos antes de ser aceptada, ni al reintentar; aceptar produce una sola confirmación pendiente si en el futuro se autorizan envíos. No se cambia ninguna bandera ni sesión de WhatsApp.

## Migración aplicada con aprobación

Archivo supabase/migrations/20261029204424_negocio_horarios_etapa2.sql: tabla horario_especial vacía y función privada guardar_horario. RLS forzada, sin acceso anon/authenticated/mensajero. La función solo cambia horario y días especiales del miembro autorizado, y no concede UPDATE general a Especialista.

El conector de migraciones falló dos veces con Invalid or expired requestState; no llegó a ejecutar SQL. Se aplicó desde el editor oficial de Supabase con la sesión ya existente y la aprobación recibida, y se registró como versión 20261029204424, nombre negocio_horarios_etapa2. No volver a ejecutarla. Verificación posterior por consultas de lectura: tabla/función presentes, RLS activa y forzada, cero excepciones y permisos anónimos cerrados; asesores sin advertencias nuevas.

Respaldo privado fuera de Git: C:/Users/dellv/.config/ritmo-belleza/respaldo-horarios-etapa2-20261029.json. SHA256 f7d2232fcdfd2824f16f8957ff50fe4fb9b69fee2b5f0b23271311c1eeb18320. Las siete tablas originales conservaron exactamente sus huellas y filas: negocios 1, miembros 1, estado 1, objetos 23, mutaciones 42, bitácora 0 y enlaces 0. No se exportaron secretos, calendarios privados ni credenciales/sesiones de WhatsApp.

## Verificación local

232 pruebas automáticas aprobadas. Incluyen roles reales no propietarios, revocación, conservación de registros/versiones, horario propio/ajeno, fechas/horas inválidas, comida/descanso, empalmes, excepción de Admin, asignaciones por salón y solicitudes sin mensajes.

Navegador: Hoy con datos locales, aceptación, menú, guardado de horarios y cuatro pestañas, White/Dark a 390/768/1440; regresiones de 5 temas, login/MFA, registro e invitaciones, fotos con 2 dispositivos/offline, calendario Apple, buscador, sincronización y actualización/borrador. Proveedores y datos de navegador aislados; no se enviaron mensajes reales ni datos de prueba a producción. Cloudflare dry-run con 84 archivos.

Capturas en ../imagenes/negocio-etapa2/. Las imágenes de fixtures no son datos del salón.

## Publicación

Autorizada por Antonio; registrar los identificadores y comprobaciones reales después de publicar. No declarar etapas 3–4 terminadas por haber preparado la etapa 2. No cambiar planes, límites ni servicios de FiNeCi.


### Publicada y verificada

Fuente 2e8ee48e6a897f45673f0dc3af05538a54f29f59, PR #13 (https://github.com/caguamex/security-recorder/pull/13), base PR #12. Worker ffdfd164-e182-43d0-b50b-b9569412925c; paquete combinado de 84 archivos con keep-vars. Salud/configuración/Comunidad 200, contexto y gestión de horarios sin identidad 401. SHA256 de negocio.js público idéntico al archivo construido. No se realizaron escrituras de prueba en la agenda real.

Railway 4d3e6c3d-6d04-4326-b626-05d7e0bb347e SUCCESS en el servicio existente agendappx-whatsapp. Publicado desde una carpeta aislada de 46 archivos de código, sin secretos ni archivos de FiNeCi. Conserva una réplica, 0.1 vCPU y 500000000 bytes. Los códigos de acceso permanecen habilitados; las vinculaciones nuevas y los envíos automáticos siguen apagados. Presupuesto compartido consultado antes de publicar: 1.567831769012531 USD consumidos, Hobby, límite duro 10 USD, sin sobrepaso, ciclo 14 oct.–14 nov. de 2026. Consumo no equivale a factura: el mínimo Hobby incluye recursos, no sumarlo dos veces. No se aumentaron recursos ni límites.

El inicio real del seguimiento semanal continúa siendo 2026-10-27T19:11:09.551883275Z. No reiniciar por este despliegue.
