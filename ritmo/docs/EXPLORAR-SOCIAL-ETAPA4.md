# Explorar y Social reales — etapa 4

Rama `codex/agendappx-explorar-social-etapa4`, encadenada a Planes / PR #14. Publicación incluida en «Publica todas las etapas». La migración nueva requiere autorización separada. Este registro describe preparación local: no confundir con disponibilidad en producción.

## Directorio y perfil

`/comunidad/` usa datos de Supabase mediante proyecciones explícitas del backend. No usa negocios, cifras, citas ni fotos de Pexels de la demostración. Las categorías sin fotos reales muestran un espacio vacío. Búsqueda por nombre/categoría/negocio, acentos y plural; orden por recomendación bayesiana aprobada, calificación, cercanía y precio, filtros de hoy/noche. Sin reseñas se muestra «Sin reseñas», nunca el prior matemático como una calificación real.

Ubicación de clientas solo en memoria para calcular distancias. Ciudad/colonia elegida puede recordarse; GPS exacto no se guarda. El negocio puede publicar su dirección y un punto aproximado, redondeado a tres decimales, y opcionalmente su WhatsApp público. No se toma de una sesión privada de WhatsApp. Apple Maps abre la dirección elegida por el negocio.

Perfil `/<slug>`: Precios, Fotos, Horarios y Reseñas, seguir/favorito y Agendar. Las horas libres de los próximos siete días salen de servicios asignados a personas activas, apertura/cierre, turno, comida, excepciones y citas reales. Se ordenan por fecha y hora. Un día especial puede abrir un día normalmente libre; se aplica también al validador y a la vista de negocio. Nunca se publican citas, nombres de clientas, notas ni teléfonos privados.

Mostrar mi salón es opcional. **Los salones existentes quedan ocultos hasta que Admin guarde y active su perfil**; los nuevos nacen con visibilidad encendida y sin datos copiados. Admin configura el enlace desde Mi negocio → Ver como cliente. No se renombra Worker, proyecto, infraestructura ni dominio.

## Reservas

Pedir cita sin cuenta requiere CAPTCHA, nombre, WhatsApp y autorización de compartir esos datos con el salón. El permiso para avisos de WhatsApp es un interruptor separado, apagado inicialmente. La disponibilidad se vuelve a comprobar dentro de una transacción y un bloqueo de agenda. Solo se crea una solicitud `solicitada`, con servicio/precio/duración de servidor. No acepta precios ni estados del navegador. Reintentos ligados al mismo contenido son idempotentes; otro contenido o un hueco ocupado no sobrescriben nada.

Topes durables: tres solicitudes por teléfono/salón en 24 h y diez por IP en 24 h. IP/teléfono usados para límites se guardan como HMAC; los datos de contacto de la solicitud quedan únicamente en la agenda privada del salón. La auditoría admite actor nulo solo para las dos inserciones exactas de una reserva interna ya identificada. No se simula un Admin ni se abre escritura pública en tablas.

El salón acepta la solicitud desde Hoy. No se activan mensajes de citas, promociones, nuevos dispositivos ni pagos. No se liberan horarios de anticipos vencidos. El mensajero publicado en etapa 2 ya excluye las solicitudes antes de aceptarse.

## Clientas y Social

Registro de clienta con CAPTCHA y **código de WhatsApp nuevo** usando el intermediario y proxy existentes. Verificación de teléfono, sesión y OTP en servidor; no registro anónimo, contraseñas ni llaves Admin en navegador. Una clienta no recibe salón, membresía, rol Admin, prueba ni cupo de fundadora. El registro de salones e invitaciones mantiene MFA obligatorio para Admin. Se reutiliza el mismo SDK y almacenamiento de sesión.

Mis citas se filtra por el teléfono confirmado que el servidor lee de Auth; no por un teléfono que manda el navegador. Favoritos, seguir, me gusta y comentarios exigen esa sesión vigente. No hay chat ni lectura de mensajes entrantes.

Solo Admin o una persona activa autorizada por Admin publica. Cada trabajo exige servicio válido, foto propia y consentimiento de las personas que aparecen. Precio y duración se leen del servicio actual; si deja de estar activo, no se ofrece otra reserva silenciosamente. Hasta diez publicaciones por día y treinta fotos por negocio. Feed de hasta doscientos trabajos recientes; los perfiles consultan su galería propia. Seguidos primero, después populares cercanos y recientes, con fecha descendente dentro de los grupos. Favoritos se recuperan por identidad, también si quedaron fuera del feed reciente.

El canvas comprime la foto y descarta metadatos; el servidor retira APPn/EXIF/GPS/XMP y comentarios JPEG, incluso entre escaneos de un JPEG progresivo. No depende de confiar en el navegador.

Una reseña exige una cita realmente completada y el mismo WhatsApp confirmado. Solo una por cita. El salón responde sin borrar opiniones. Reportes con CAPTCHA para visitantes o sesión verificada para clientas; límite de veinte por reportante y día. Tres reportes distintos ocultan un comentario hasta revisión. El salón puede ocultar comentarios visibles, nunca restaurar uno en revisión. Moderación y verificación manual de negocios solo para el UUID de Antonio expresamente aprobado, sesión vigente y MFA; no para cualquier Admin.

Mi negocio conecta perfil, publicación, galería, permisos de publicación, reseñas/respuesta y cifras reales de visitas/me gusta. Las demás pantallas conservan el flujo publicado.

## Avisos PWA voluntarios

Web Push estándar con `web-push` 3.6.7 fijado y cifrado. Claves VAPID únicamente como secretos de Cloudflare, fuera de Git. Cada dispositivo se suscribe deliberadamente desde Perfil o Perfil público del negocio y puede desactivarse. En iPhone se requiere abrir la app añadida a la pantalla de inicio; no un programa de desarrolladores de pago. Referencia: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers

Solo aviso general «Hay una novedad en tu agenda», sin datos de la cita en pantalla bloqueada. Cola ligada a suscripción/cita/versión, identidad, sesión activa y permisos comprobados nuevamente al tomar el envío. Clientas solo para su propio teléfono, equipo solo para su negocio/agenda permitida. Sin reenvío automático de resultados inciertos. Endpoints limitados a Apple, Google y Mozilla; no destinos arbitrarios ni redes privadas.

Usa la tarea de Cloudflare que ya existía cada cinco minutos; no crea procesos, cron de Railway, réplicas ni planes nuevos. Lote máximo de dos y tope global de trescientos intentos diarios para limitar CPU/solicitudes. Cola puede demorar varios ciclos según pendientes; avisos vencen al día. No equivale a entrega inmediata garantizada. Configurar VAPID y activar la opción en cada dispositivo son pasos separados; sin suscripciones no se envía nada. WhatsApp permanece con sus banderas actuales.

## Migración y seguridad

`supabase/migrations/20261029233337_explorar_social_etapa4.sql`: tablas privadas para perfiles, publicaciones/interacciones, reseñas/reportes, reservas/visitas y avisos, funciones acotadas y registro de clientas. RLS forzada; cero permisos directos de anon/authenticated o mensajero. Las tablas internas sin políticas están cerradas deliberadamente y solo se operan mediante funciones privadas con controles concretos. Todas fijan búsqueda, conservan las reglas de Auth/MFA y no confían en user_metadata.

Guardias `ritmo.migracion_etapa4=aprobada` y `ritmo.moderador_aprobado=<UUID verificado>` impiden ejecución accidental. No poner un UUID generado en la migración; se proporciona únicamente al ejecutarla tras la aprobación. Respaldar y comparar datos existentes antes/después. No incluir credenciales, TOTP, sesiones de WhatsApp ni claves de notificaciones en respaldos de agenda o Git.

## Verificación y capturas

- Batería completa: 247 pruebas aprobadas. Después se repitieron catorce casos afectados por los últimos ajustes de Social/horarios, todos aprobados.
- Pruebas mínimas de EXPLORAR/SOCIAL: búsqueda/plural/acentos, fórmula, invisibilidad, huecos reales sin PII, reseñas bloqueadas antes de completar, servicio obligatorio, permiso de publicación, corte sin uñas/cejas, tres reportes y eliminación de GPS.
- Navegador con SDK real, JWT firmado y RLS/PostgreSQL local: directorio, perfil, solicitud guardada, Mis citas, reseña verificada/respuesta, seguir/me gusta/favorito/comentario y publicación de una foto desde el formulario del negocio. White/Dark a 390 px; adaptabilidad 768/1440 sin desbordes.
- Registro por WhatsApp, MFA, otra Admin y asignaciones mantienen sus pruebas de navegador. Prueba de actualización PWA pasa primera instalación, descarga incompleta, versión pendiente, borradores de otra pestaña, actualización sin conexión y cola local conservada.
- Push: proveedores simulados, cifrado, destinos permitidos, sesión/permisos, envío único y desactivación. No se solicitó permiso del navegador del usuario ni se enviaron notificaciones reales para probar.
- Cloudflare dry-run aprobado, setenta y ocho recursos. Solo estáticos reales de Comunidad en el paquete; no los archivos/imágenes de la demostración.

Capturas en `../imagenes/social-etapa4/`. Fotos y registros de esas capturas son exclusivamente de la prueba local y no se insertan en producción.

## Operación pendiente

Solicitar confirmación independiente de esta migración; respaldar, aplicar, comparar, revisar asesores y registrar la versión. Configurar dos secretos VAPID nuevos sin revelar sus valores. Publicar el Worker existente con keep-vars, verificar APIs públicas/privadas, cero datos de prueba y banderas de WhatsApp conservadas. La aprobación de publicación ya existe; no volver a preguntarla dentro de este alcance. No tocar Railway ni FiNeCi.

## Migración autorizada y aplicada — 29 de octubre de 2026

Antonio confirmó «Sí, respalda y aplica Explorar/Social». Respaldo privado respaldo-social-etapa4-20261029.json, SHA256 449eb7ac753c45ea9bec7b4fc2a278d325a97e4797fb78a23f2330c7a6f26ba2. Diez tablas comparadas antes/después, idénticas: negocios 1, miembros 1, estado 1, objetos 23, mutaciones 42, bitácora 0, días especiales 0, planes 1, contador de fundadoras 1, enlaces 0.

Aplicada con el conector oficial de Supabase, que volvió a funcionar; versión real registrada 20261029233337, nombre explorar_social_etapa4. El archivo local se renombra a esa versión para evitar una repetición de migración. Quince tablas nuevas con RLS forzada y sin lectura directa de anon/authenticated/mensajero. Cero perfiles visibles, trabajos, reservas, suscripciones o avisos de prueba. Un único moderador: Antonio, el UUID verificado aprobado en la ejecución.

Asesores: sin nueva advertencia de seguridad; diez tablas internas adicionales sin políticas son deliberadamente inaccesibles de forma directa. Protección de contraseñas mantiene el aviso anterior (acceso sin contraseña). Rendimiento informa índices FK opcionales no cubiertos y nuevos índices aún no usados en tablas vacías; no se borran índices ni se cambian políticas antiguas para silenciar recomendaciones. La advertencia anterior de dos políticas de miembros se conserva. No se abre acceso público directo ni se contratan planes para estas recomendaciones.

Dos claves VAPID propias guardadas únicamente en archivo privado y secretos PUSH_VAPID_PUBLICA/PUSH_VAPID_PRIVADA del Worker existente. No se pidió permiso de notificaciones al navegador del usuario ni se creó una suscripción real. Publicación de la interfaz aún por registrar abajo.

### Continuidad de actualización

Comunidad carga una copia compilada del mismo SDK en /comunidad/cuentas-cliente.js: una PWA antigua no puede mezclar el archivo de acceso anterior con la pantalla nueva. El service worker comparte los recursos de agenda/Comunidad, resuelve /comunidad/ y perfiles al shell correcto y jamás guarda APIs privadas. Comunidad tiene el mismo aviso de actualizar con decisión del usuario; el botón también funciona encima de un diálogo y cancelar conserva el borrador. Una prueba específica instala la caché anterior, abre Comunidad nueva, cancela la actualización con un formulario, actualiza conservando la URL y vuelve a abrir sin conexión. No se borra almacenamiento ni se cierra sesión para corregir cachés.

## Publicación final verificada

Publicado desde ef8abee, Worker **36421810-c292-476b-8921-4f97578f1e48**, ochenta recursos, con keep-vars y los mismos bindings/cron. Reemplaza las versiones iniciales 74924342-c4f5-4edd-8941-f865424bd43f y c6d6535d-bf1e-46a7-98ee-d51eeda190a6 dentro de esta misma etapa. El perfil mantiene /<slug> al servir el shell; no redirige al directorio por la canonicalización de index.html del alojamiento.

Comprobación real: salud, Comunidad, archivos de acceso/actualización y APIs públicas responden 200. Los archivos públicos coinciden en SHA256 con el build. Búsqueda de cejas, Social/cortes y directorio devuelven listas vacías reales: cero ejemplos publicados. Citas/contexto de clientas y administración/planes sin sesión responden 401; perfil del salón aún oculto responde 404 en su API. Precios conservan cobrosHabilitados=false y diecinueve cupos reales. Configuración de acceso conserva WhatsApp y registro habilitados, correo apagado. Navegador integrado confirma Perfil, Apariencia y Entrar/Crear mi cuenta, sin pedir ni enviar un código real.

Las diez tablas anteriores coinciden exactamente con el respaldo tras migrar. Al terminar: cero trabajos, reservas, suscripciones o avisos de prueba, y cero perfiles visibles. No se activó la ubicación ni las notificaciones del usuario. Push queda técnicamente configurado, pero su entrega a un iPhone real requiere que la persona active el permiso en su dispositivo; las pruebas de envío fueron simuladas. No se publicó ni modificó Railway, no se habilitaron mensajes de citas/promociones ni nuevos dispositivos, no se tocó FiNeCi y no se contrataron servicios.

PR #15: https://github.com/caguamex/security-recorder/pull/15, encadenado al #14. La rama de trabajo conserva código, migración real, pruebas y capturas. Todas las etapas 1–4 quedaron publicadas; las notas de «pendiente» anteriores son el historial de preparación.

Para Antonio: abrir la app y aceptar Actualizar ahora. En Negocio → Ver como cliente, completar/guardar el perfil y activar Mostrar mi salón cuando decida aparecer públicamente. Subir trabajos propios desde el botón Crear → Publicar trabajo. El directorio /comunidad/ permanece vacío mientras no haya negocios que hayan publicado su perfil.
