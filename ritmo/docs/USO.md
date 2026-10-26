# Usar Ritmo Belleza

Dirección de la aplicación: https://ritmo-belleza.antonio-t-22.workers.dev

La página y la API están en Cloudflare Workers Free; los datos, en un proyecto Supabase Free separado de FiNeCi. La clave de acceso de la agenda se conserva.

## Cambio de dirección desde Railway

Abre la nueva dirección y conecta el dispositivo en Más → Sincronización usando la misma clave privada. El navegador guarda por dirección: la sesión y la cola local de la dirección anterior no se transfieren automáticamente. Los datos que ya estaban sincronizados en el servidor sí se trasladaron. No borres los datos del sitio anterior si allí tienes cambios que nunca se enviaron; se conservan en ese dispositivo y requieren recuperarlos antes de descartarlos.

Si ya tenías una suscripción en Apple o Google Calendar, agrega el enlace obtenido desde la nueva dirección. Se conservó la clave privada del calendario, pero cambió su dominio.

## Entrar e instalar en iPhone

1. Abre la dirección HTTPS desde Safari y elige Compartir → Agregar a pantalla de inicio.
2. Abre el ícono instalado. Ve a Más → Sincronización.
3. Introduce la clave privada de tu agenda y toca Conectar. La copia local de la clave está protegida en `C:/Users/dellv/.config/ritmo-belleza/ACCESO_PRIVADO.txt`; no está en GitHub.
4. Espera a ver “Sincronizado con tu servidor”. Repite la conexión en tus otros dispositivos autorizados.

Solo quienes tengan esta clave pueden leer o modificar los datos del servidor. El token se guarda en el dispositivo; desconectarlo conserva los datos locales y elimina esa credencial local.

## Agenda y trabajo sin internet

Agrega tus servicios y clientas y después crea las citas desde el botón +. Los cambios quedan guardados en el dispositivo aunque no haya conexión y se envían al volver internet. No borres los datos del navegador ni desinstales mientras haya cambios pendientes de enviar.

Si dos dispositivos cambian el mismo registro, Más → Sincronización muestra ambas versiones. Elige la que quieras conservar. Una eliminación no reaparece por reconectar un dispositivo atrasado.

## Calendarios

En Más → Suscribir Apple o Google Calendar se obtiene el enlace privado de solo lectura. En Apple, toca Abrir suscripción. En Google Calendar, desde su sitio web, usa Otros calendarios → Desde URL y pega el enlace. El proveedor del calendario decide cuándo actualizarlo; no es sincronización instantánea ni permite editar la agenda desde el calendario.

Renovar enlace privado invalida el anterior. Después hay que agregar la nueva suscripción en cada calendario autorizado. El feed omite citas canceladas y datos de ejemplo, y no incluye teléfonos ni notas privadas de las clientas.

## WhatsApp sin cargos adicionales de Meta

El envío manual sigue disponible desde cada cita. Para activar la automatización hacen falta un número oficial conectado a WhatsApp Cloud API y las credenciales del negocio en las variables del servidor. No se reutiliza la conexión de WhatsApp de FiNeCi ni una librería de WhatsApp Web.

Cada clienta debe tener activado “Autoriza WhatsApp automático” en su ficha, después de obtener su consentimiento.

El modo implementado envía únicamente mensajes de servicio de texto dentro de las 24 horas desde el último mensaje de esa clienta, recibido por el webhook oficial y validado con la firma de Meta. Usa un margen de seguridad de dos minutos antes del cierre de la ventana. No envía plantillas facturables, ni campañas a grupos.

Una confirmación, un recordatorio o un agradecimiento fuera de la ventana gratuita **no se envía automáticamente**. Se muestra en el estado como “Requieren mensaje previo de la clienta”; puedes usar el botón de envío manual. Por esta restricción de costo, no se promete entregar recordatorios automáticos para todas las citas.

La respuesta 1 confirma la cita asociada al mensaje. La respuesta 2 marca una solicitud de cambio; Antonio debe acordar el nuevo horario. Si hay varias citas y no se puede identificar una de forma inequívoca, no se modifica ninguna automáticamente.

El estado distingue mensaje aceptado por Meta, entregado, leído, rechazado y resultado incierto. Un envío con respuesta incierta no se repite automáticamente para evitar duplicados. Un disparador programado de Cloudflare revisa la cola cada cinco minutos, sin un proceso permanentemente encendido. Mientras falte la conexión oficial de Meta, no ejecuta envíos.

## Promociones y Facebook

Edita la promoción, copia el texto y abre cada grupo por separado. La publicación la realiza el usuario; la app registra los grupos atendidos. No promete publicar automáticamente en grupos mediante una API.

## Alojamiento gratuito y presupuesto existente

Cloudflare Workers Free y Supabase Free no tienen una suscripción mensual contratada para Ritmo. Hay cuotas: 100,000 solicitudes diarias de Workers, 100,000 consultas diarias de Hyperdrive y, en Supabase, 500 MB de base por proyecto y cuotas de transferencia compartidas por organización. Alcanzar una cuota puede limitar el servicio; no se habilitó una actualización automática a un plan de pago. Supabase puede pausar proyectos Free tras una semana de inactividad.

Antonio autorizó detener únicamente los dos despliegues antiguos de Ritmo en Railway, conservando volumen y respaldos. Se mantiene el límite compartido existente de 10 USD por ciclo y su aviso de 5 USD; no se alteraron servicios de FiNeCi. Detener cómputo no elimina consumos anteriores ni el posible almacenamiento del volumen conservado.

No se contrataron planes adicionales de Vercel, Cloudflare, Supabase ni Meta. Los costos eventuales de mensajes de Meta siguen fuera de cualquier cuota de alojamiento y bloqueados bajo la autorización vigente.

## Respaldo y acceso

Los datos actuales están en PostgreSQL de Supabase. El traslado conservó objetos, versiones, cursor de cada objeto, recibos de idempotencia, eliminaciones y clave de calendario. El esquema privado `ritmo` tiene un usuario de servidor limitado y políticas de acceso; no se publica a roles anónimos ni autenticados de Supabase.

El respaldo completo anterior queda en la carpeta local protegida `C:/Users/dellv/.config/ritmo-belleza/respaldo-railway-20261026.json`, fuera de Git. El volumen anterior de Railway también se conserva. Ninguno equivale a un sistema de respaldos periódicos del nuevo destino. No se activó un complemento de respaldos de pago.

## Entrega en blanco — 26 de octubre de 2026

Por instrucción de Antonio, la agenda inicia sin citas, clientas, servicios, promociones ni grupos de demostración. Capturar el primer registro no genera ejemplos adicionales. Se conservan el diseño, la sincronización y las fotografías proporcionadas para asociarlas a los servicios que se capturen. La base publicada se verificó sin registros activos de prueba; se conservan las marcas de eliminación necesarias para sincronizar.

## Foto de cada servicio

En Servicios toca +, o toca un servicio de la lista para editarlo. Pulsa **Subir foto** o **Cambiar foto**, elige una imagen del celular y espera la vista previa. Toca **Guardar**. Aparecerá en la tarjeta, en la lista y al abrir Ver fotos. Para retirarla usa **Quitar foto** y después Guardar; Cancelar conserva la imagen anterior.

Se admite una foto por servicio. La página guarda una copia JPEG optimizada de hasta 800 píxeles en su lado mayor y 48 000 caracteres, sin modificar el archivo original. Puedes seleccionar archivos de hasta 20 MB; si el navegador no puede abrir el formato, usa JPG, PNG o WebP. Las fotografías proporcionadas anteriormente siguen disponibles como referencia automática para Cejas y servicios reconocidos de Pestañas; subir una foto propia tiene prioridad y Quitar foto permite dejar la tarjeta sin imagen.

La foto se guarda con el servicio, funciona sin conexión y se sincroniza con los dispositivos conectados usando la misma clave. Utiliza la base privada existente de Ritmo, sin añadir un servicio de almacenamiento ni activar un plan de pago. Las imágenes ocupan parte del espacio de la base gratuita y del almacenamiento del dispositivo. Las pruebas de fotografías usan PostgreSQL local: `npm run test:fotos --prefix ritmo/servidor` (Edge por defecto; `BROWSER_CHANNEL` permite elegir Chromium).
