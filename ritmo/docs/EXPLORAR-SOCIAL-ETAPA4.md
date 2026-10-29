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

`supabase/migrations/20261029223451_explorar_social_etapa4.sql`: tablas privadas para perfiles, publicaciones/interacciones, reseñas/reportes, reservas/visitas y avisos, funciones acotadas y registro de clientas. RLS forzada; cero permisos directos de anon/authenticated o mensajero. Las tablas internas sin políticas están cerradas deliberadamente y solo se operan mediante funciones privadas con controles concretos. Todas fijan búsqueda, conservan las reglas de Auth/MFA y no confían en user_metadata.

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
