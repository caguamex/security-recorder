# Siguiente encargo de Agendappx: WhatsApp vinculado, solo envíos

Actualizado el 27 de octubre de 2026. **Comenzar la implementación completa después de terminar cuentas.** Esta revisión actualiza documentación y presupuesto; no despliega, crea recursos, vincula un teléfono ni manda mensajes. Cuentas sigue pendiente de resolver el proveedor de inicio de sesión tras el bloqueo de Brevo.

## Fuente y autorización

Se leyó completo `ritmo/docs/WHATSAPP-AUTOMATICO.md` (secciones 0–6), de `claude/es-posible-esto-tjimmb`, commit **dc15fe5**. Se conserva una copia exacta en esta rama. El prototipo está en `ritmo/cuentas/index.html` y la captura solicitada es `ritmo/imagenes/whatsapp-vincular.png`; no se fusionaron nuevas pantallas a la página publicada.

Antonio autorizó conexión de dispositivo vinculado como FiNeCi, aceptando el riesgo de bloqueo, y sustituyó la prohibición de librerías no oficiales. Se verificó de solo lectura `financial-app/src/lib/whatsapp.ts`, función requestWhatsAppPairingCode: usa Evolution API con integración **WHATSAPP-BAILEYS**. Reutilizar Baileys como biblioteca, con versión corregida y fijada; no reutilizar números, sesiones, bases, proyectos, servicios o secretos de FiNeCi. No incorporar versiones vulnerables solo por coincidir con una imagen vieja del proveedor.

## Cambios respecto a la preparación anterior del PR #3

- Un solo servicio permanente, **agendappx-whatsapp**, en un proyecto Railway aparte; una réplica y revisión de cola cada minuto. Reemplaza los planes anteriores de proveedor más cron agendappx-mensajero cada cinco minutos. No crear servicios duplicados.
- Sesión en whatsapp_sesiones por negocio, **AES-256-GCM**, llave WA_SESSION_KEY solo en Railway. La sesión persistente sin cifrar del motor anterior no basta. Nonce único por escritura, autenticación del negocio/tipo en el cifrado, cifrado también de claves de sesión, actualización transaccional y bloqueo que impida dueños simultáneos. Recuperación gradual conservando credenciales ante fallos temporales.
- Rol propio agendappx_whatsapp de mínimos permisos y TLS verificado. Admin con sesión vigente, membresía y MFA para vincular/desvincular. Especialistas no ven CLABE, comprobantes, vinculación ni credenciales.
- Solo envíos. Descartar eventos de mensajes entrantes e historial sin persistencia ni logs de contenido; no leer comprobantes ni emitir confirmaciones de lectura. Los eventos de control imprescindibles del protocolo para mantener conexión/credenciales y confirmar envíos propios no son un chatbot. Las respuestas se atienden manualmente en el teléfono.
- Código efímero de **ocho caracteres alfanuméricos**: el ejemplo K7QM-29XA de la propia especificación no es solo numérico. Si el protocolo asíncrono exige persistirlo, cifrarlo, limitar su vigencia y acceso; nunca registrarlo en logs ni entregar llaves al navegador.
- WHATSAPP_REMITENTE=vinculado debe bloquear **todos** los envíos de Cloudflare y dejar Meta deshabilitado, conservando su código. La bandera y sus pruebas están pendientes: el código preparado antes para railway/evolution no acredita este modo nuevo.
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

## Orden de implementación y pruebas

1. Terminar cuentas, invitaciones, roles/RLS, MFA y su enlace con la app publicada; conservar fotos, modo sin conexión, sincronización y calendario.
2. Implementar almacenamiento cifrado, rol mínimo y custodia de sesión; preparar cambios sin aplicarlos a producción.
3. Adaptar vínculo/estado/cierre del número a este único servicio y Admin con MFA.
4. Integrar cola duradera de citas/anticipos, consentimiento, horarios, límites, invalidaciones y freno persistente; desactivar remitente de Cloudflare para el modo vinculado.
5. Ejecutar **cada prueba de la sección 6** con reloj, transporte y mensajes simulados. Añadir reinicios, caídas, intentos paralelos, cifrado alterado/llave errónea y descarte de entradas sin read receipts.
6. Documentar resultados reales por criterio. **No se ejecutó todavía la sección 6 contra la implementación nueva**, porque esta se aplazó hasta terminar cuentas; 132 pruebas anteriores no equivalen a completarla.
7. Revisar consumo y solicitar confirmaciones separadas antes de migrar datos, desplegar, vincular el teléfono y enviar el primer mensaje real con destinatario. No comprar dominios ni modificar FiNeCi.

Fuentes primarias: [tarifas de Railway](https://docs.railway.com/pricing/plans), [Baileys](https://github.com/WhiskeySockets/Baileys), [especificación solicitada](https://github.com/caguamex/security-recorder/blob/dc15fe5/ritmo/docs/WHATSAPP-AUTOMATICO.md).
