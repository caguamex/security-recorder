# Usar Ritmo Belleza

Dirección de la aplicación: https://belleza-production.up.railway.app

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

El estado distingue mensaje aceptado por Meta, entregado, leído, rechazado y resultado incierto. Un envío con respuesta incierta no se repite automáticamente para evitar duplicados. El proceso revisa la cola cada cinco minutos en el mismo servidor, sin contratar otro servicio programador.

## Promociones y Facebook

Edita la promoción, copia el texto y abre cada grupo por separado. La publicación la realiza el usuario; la app registra los grupos atendidos. No promete publicar automáticamente en grupos mediante una API.

## Presupuesto de Railway

Autorización de Antonio: usar servicios gratuitos cuando sea posible y, si hay consumo, mantenerlo en Railway dentro del límite compartido de 10 USD por ciclo. No se contrataron planes adicionales de Vercel, Supabase ni Meta.

El espacio de Railway ya tenía el límite de consumo de 10 USD, con aviso a los 5 USD. Se conserva ese límite y los demás servicios. Cada servicio nuevo usa como máximo 0.25 GB de memoria y 0.1 vCPU, con una sola réplica. La facturación depende del consumo real; un límite de recursos no es una reserva ni una tarifa fija. Los impuestos, si aplica el proveedor, son distintos del límite de consumo.

El límite de 10 USD es del espacio completo, incluido FiNeCi. Railway puede detener todos sus servicios al alcanzarlo. La app conserva el trabajo local durante una interrupción, pero la sincronización y el feed requieren que el servidor esté disponible.

## Respaldo y acceso

PostgreSQL tiene un volumen persistente separado del servicio web. No se almacena la base en el disco efímero de la app. El volumen conserva los datos entre despliegues, pero no sustituye una copia de seguridad externa. No se activó un complemento de respaldos de pago.

Las tablas y credenciales de Ritmo están en un proyecto independiente de FiNeCi. El proyecto se llama `ritmo-belleza` en Railway. No se aumentó el presupuesto del espacio ni se modificaron los datos de otros proyectos.
