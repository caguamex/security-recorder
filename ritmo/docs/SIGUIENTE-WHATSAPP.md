# Siguiente encargo de Agendappx: WhatsApp vinculado, solo envíos

Actualizado el 27 de octubre de 2026. **Antonio priorizó terminar WhatsApp antes del resto de cuentas.** La implementación local incluye un acceso mínimo seguro de Admin por enlace privado y TOTP, sin SMS de Brevo. La migración y publicación fueron autorizadas con «okey, hazlo» y están preparándose; se creó el proyecto/servicio vacío separado de Railway y se configuró; aún no hay despliegue, teléfono vinculado ni mensajes reales.

## Fuente y autorización

Se leyó completo `ritmo/docs/WHATSAPP-AUTOMATICO.md` (secciones 0–6), de `claude/es-posible-esto-tjimmb`, commit **dc15fe5**. Se conserva una copia exacta en esta rama. El prototipo está en `ritmo/cuentas/index.html` y la captura solicitada es `ritmo/imagenes/whatsapp-vincular.png`; no se fusionaron nuevas pantallas a la página publicada.

Antonio autorizó conexión de dispositivo vinculado como FiNeCi, aceptando el riesgo de bloqueo, y sustituyó la prohibición de librerías no oficiales. Se verificó de solo lectura `financial-app/src/lib/whatsapp.ts`, función requestWhatsAppPairingCode: usa Evolution API con integración **WHATSAPP-BAILEYS**. Reutilizar Baileys como biblioteca, con versión corregida y fijada; no reutilizar números, sesiones, bases, proyectos, servicios o secretos de FiNeCi. No incorporar versiones vulnerables solo por coincidir con una imagen vieja del proveedor.

## Cambios respecto a la preparación anterior del PR #3

- Un solo servicio permanente, **agendappx-whatsapp**, en un proyecto Railway aparte; una réplica y revisión de cola cada minuto. Reemplaza los planes anteriores de proveedor más cron agendappx-mensajero cada cinco minutos. No crear servicios duplicados.
- Sesión en whatsapp_sesiones por negocio, **AES-256-GCM**, llave WA_SESSION_KEY solo en Railway. La sesión persistente sin cifrar del motor anterior no basta. Nonce único por escritura, autenticación del negocio/tipo en el cifrado, cifrado también de claves de sesión, actualización transaccional y bloqueo que impida dueños simultáneos. Recuperación gradual conservando credenciales ante fallos temporales.
- Rol propio agendappx_whatsapp de mínimos permisos y TLS verificado. Admin con sesión vigente, membresía y MFA para vincular/desvincular. Especialistas no ven CLABE, comprobantes, vinculación ni credenciales.
- Solo envíos. Descartar eventos de mensajes entrantes e historial sin persistencia ni logs de contenido; no leer comprobantes ni emitir confirmaciones de lectura. Los eventos de control imprescindibles del protocolo para mantener conexión/credenciales y confirmar envíos propios no son un chatbot. Las respuestas se atienden manualmente en el teléfono.
- Código efímero de **ocho caracteres alfanuméricos**: el ejemplo K7QM-29XA de la propia especificación no es solo numérico. Si el protocolo asíncrono exige persistirlo, cifrarlo, limitar su vigencia y acceso; nunca registrarlo en logs ni entregar llaves al navegador.
- WHATSAPP_REMITENTE=vinculado debe bloquear **todos** los envíos de Cloudflare y dejar Meta deshabilitado, conservando su código. La bandera está implementada y cubierta por las pruebas nuevas; no está activada en producción.
- Reemplaza botones de confirmación y automatizaciones de respuestas/comprobantes por gestión humana. Los cinco tipos de aviso salen solo por el remitente del salón. Se confirma el anticipo únicamente al marcarlo en la app.

## Reglas que se conservan

Consentimiento y cita válida; 20–60 s de pausa por número, escribiendo 2–5 s, máximo 30/h y 150/día (configurable solo hacia abajo), silencio 21:00–08:00 CDMX, idempotencia y estado incierto sin reintento automático. Al mover/cancelar invalidar pendientes y reprogramar; comprobar de nuevo consentimiento, estado y horario justo antes del envío. Freno persistente ante bloqueo/exceso, con reactivación explícita de Admin. Aviso a Admin si la conexión no vuelve en diez minutos.

Cumplir las ventanas especiales de la sección 2: recordatorio temprano la noche anterior a las 19:00 cuando corresponda, omisión por cita reciente o confirmación/anticipo enviados en las últimas tres horas, y omisión de aviso de llegada cuando la reserva tiene menos de 90 minutos. Lo tardío o fuera de horario no debe provocar recordatorios después de empezar/cancelar la cita.

Decisiones directas previas de Antonio: **anticipo predeterminado 20 %** y **tope mensual 600 mensajes**, conservados hasta una instrucción posterior que los sustituya expresamente. La especificación de Claude dice 30 % de anticipo: esta discrepancia queda documentada y no modifica silenciosamente lo aprobado. Precio mínimo $300, plazo de 24 h o dos horas antes cuando sea anterior; nunca liberar horario al vencer sin decisión humana. Comprobante adjunto solo manual, protegido por los roles.

## Pronóstico actualizado: un único servicio permanente

No es consumo medido del servicio: **todavía no existe**. Base de otros recursos: última consulta verificada del 26 de octubre, uso 1.2089 USD y proyección del ciclo **2.2571 USD**, límite compartido 10 USD y aviso existente en 5 USD. No se volvió a presentar esa consulta como si fuera de hoy ni se modificó su configuración.

Tarifas de contenedor Railway contrastadas el 27 de octubre: RAM 10 USD/GB/mes, CPU 20 USD/vCPU/mes, salida 0.05 USD/GB. Hobby cuesta mínimo 5 USD e incluye 5 USD de recursos: factura antes de impuestos = máximo entre 5 USD y consumo total. No sumar 5 USD de nuevo al total de recursos.

| Escenario de 30 días | RAM media | CPU media | Servicio nuevo, incluido el bucle | Consumo conjunto | Factura total estimada, antes de impuestos |
|---|---:|---:|---:|---:|---:|
| Ligero | 0.15 GB | 0.01 vCPU | 1.75 USD | 4.01 USD | 5.00 USD |
| Intermedio | 0.25 GB | 0.02 vCPU | 2.95 USD | 5.21 USD | 5.21 USD |
| Alto | 0.50 GB | 0.03 vCPU | 5.65 USD | 7.91 USD | 7.91 USD |

Supuesto de 1 GB de salida al mes. Fórmula del servicio: RAM media × 10 + CPU media × 20 + salida GB × 0.05. La CPU incluye conexión, cifrado y revisión de cola del mismo proceso; no hay un cron adicional que sumar. Las esperas deben usar temporizadores, no ocupar CPU en bucle. Promesa de 150–250 MB aún sin comprobar con un teléfono real. El primer ciclo será proporcional al tiempo encendido; no atribuirle un mes completo antes de activarlo.

Presupuesto operativo recomendado: mantener proyección compartida por debajo de 8 USD para dejar margen frente a 10 USD, fluctuaciones e impuestos. Un uso alto deja poco margen: no garantizar un costo fijo ni aumentar límites/recursos sin autorización específica. No configurar alertas nuevas ni tocar alertas de FiNeCi hasta identificar el alcance exacto aprobado.

La estimación anterior de dos procesos sigue como histórica en WHATSAPP-VINCULACION.md/herramientas/pronostico-whatsapp.mjs; **no usarla como cálculo del servicio único actual**. Ni las pruebas anteriores ni aquel Dockerfile demuestran cifrado o ausencia de procesamiento entrante del alcance nuevo.

## Informe real al cumplir una semana

Seguimiento creado en este chat: **consumo-de-whatsapp-de-agendappx-tras-una-semana**. Revisa a las 09:00 CDMX y permanece en silencio mientras el servicio no exista o no complete siete días desde su fecha real de encendido. Entonces informa una sola vez: gasto atribuible, total compartido, proyección del ciclo y margen frente a 10 USD; distingue consumo e importe mínimo Hobby. No debe activar servicios ni mandar WhatsApp por hacer el informe. Registra aquí la fecha real al desplegar con autorización; todavía no hay fecha. Si faltan permisos para consultar, indicarlo en lugar de inventar cifras. Tras el informe, pausar el seguimiento.

## Estado verificable de la implementación

Código nuevo en `servidor/src/whatsapp-vinculado`, `whatsapp/` y panel de la app. Reemplaza el proveedor anterior por Baileys fijado a 7.0.0-rc13. Cifrado, custodia, reconexión gradual, límites, reglas por cita, anticipo manual, comprobante, acceso firmado con MFA y bandera de Cloudflare ya tienen pruebas locales. Se integró primero el calendario publicado para evitar regresiones.

Resultados y limitaciones en `WHATSAPP-PRUEBAS.md`; instrucciones operativas en `../whatsapp/README.md`. No confundir transporte simulado con una vinculación física o garantía de estabilidad continua. Docker no está instalado aquí: la construcción Linux y la primera conexión deben comprobarse en el despliegue autorizado antes de mandar un mensaje.

La migración propuesta conserva los datos sincronizados, versiones e integración del calendario y los asigna al salón y Admin aprobados. Los pendientes que solo existan en el celular se revisan antes de migrar; no se descartan ni se importan automáticamente a otra cuenta. Respaldo privado actualizado obligatorio y confirmación explícita de Antonio antes de ejecutarla.

No hay fecha real de activación de agendappx-whatsapp. El seguimiento de consumo de siete días sigue esperando esa fecha. Confirmaciones separadas: migración, publicación, vinculación y primer mensaje con destinatario/consentimiento. No comprar dominios ni modificar FiNeCi.

Fuentes primarias: [tarifas de Railway](https://docs.railway.com/pricing/plans), [Baileys](https://github.com/WhiskeySockets/Baileys), [especificación solicitada](https://github.com/caguamex/security-recorder/blob/dc15fe5/ritmo/docs/WHATSAPP-AUTOMATICO.md).


## Continuación de la publicación autorizada

Ver el registro del 27 de octubre al final de `../whatsapp/README.md`: respaldo privado verificado, proyecto nuevo configurado sin proceso y aprobación vigente de migración/publicación. No repetir esta aprobación. Falta la llave Admin de Supabase, solicitada únicamente en un archivo privado preparado; no pedirla en el chat. La operación temporal pública de arranque fue rechazada automáticamente y no se publicó; usar la API Admin normal cuando se proporcione su credencial. No aplicar todavía la migración ni romper el acceso heredado. No hay fecha real de activación para el seguimiento de siete días.
