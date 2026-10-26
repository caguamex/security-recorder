# Siguiente encargo: WhatsApp automático con anticipo

Antonio lo encargó el 26 de octubre de 2026. **Comenzar la implementación cuando termine cuentas**. No se ha creado el servicio, activado Meta ni modificado FiNeCi.

Fuente: rama `claude/es-posible-esto-tjimmb`, commit `513d086`, `ritmo/docs/WHATSAPP-AUTOMATICO.md`, secciones 0–6; prototipo `ritmo/cuentas/index.html` y captura `ritmo/imagenes/whatsapp-anticipo.png`. Se revisó la especificación sin fusionar sus pantallas a la rama de cuentas en curso.

## Opción solicitada después: vincular como FiNeCi

Antonio pidió agregar la posibilidad de vincular su WhatsApp mediante un código de ocho caracteres y que los mensajes salgan de ese número. Sigue siendo un encargo posterior a cuentas; no se activó ni se vinculó ningún número.

Se comprobó en el código de FiNeCi (`src/lib/whatsapp.ts`, `requestWhatsAppPairingCode`, y su ruta `whatsapp-pairing`) que usa Evolution API con integración `WHATSAPP-BAILEYS`, no la API oficial de Meta. El código admite ocho letras/números. Adaptar el patrón como referencia; no modificar FiNeCi, sus instancias, credenciales, servicios ni datos.

Preparar esta opción de Agendappx con:
- Ajustes → WhatsApp → Vincular: Admin autenticado y con MFA introduce su número, recibe el código y lo acepta desde Dispositivos vinculados de WhatsApp. Mostrar el número efectivamente vinculado, su estado y Desvincular.
- Conexión privada por salón, resuelta exclusivamente en servidor desde la membresía. Recepción/Especialistas usan el remitente del salón, sin poder elegir una instancia ajena ni acceder a las llaves. No usar nombres predeterminados de instancias ni reutilizar las de FiNeCi.
- Autenticación del webhook de Evolution propia de este proveedor y comprobación de instancia/salón; no reutilizar como si fuera una firma de Meta. Mantener consentimiento, límites, horario silencioso, idempotencia, revisión de comprobantes y permiso antes del primer envío real.
- Comprobar compatibilidad de botones antes de prometerla; si hacen falta respuestas de texto, presentar el ajuste de experiencia para revisión.
- El servicio que mantiene la conexión WhatsApp Web necesita ejecutarse y conservar su sesión además del mensajero que despierta cada cinco minutos. La estimación inferior solo cubre el cron; **no representa el costo total de esta opción**. Revisar alojamiento, aislamiento y consumo antes de activar recursos, siempre dentro de los permisos concretos y el límite Railway de Antonio.

Baileys es una integración no oficial de WhatsApp Web. Esta opción permite probar el flujo por código sin contratar la API oficial de Meta, pero debe informarse su dependencia de WhatsApp Web y no garantizar disponibilidad o ausencia de restricciones. Agregar la opción no implica sustituir silenciosamente todo el diseño anterior de Meta ni habilitar ambos remitentes a la vez.

Fuentes primarias:
- https://github.com/WhiskeySockets/docs/blob/main/authentication/pairing-code.mdx
- https://github.com/WhiskeySockets/Baileys

## Instrucción vigente que prevalece sobre el documento

El anticipo predeterminado será **20 %**, como escribió Antonio. La sección 3 del documento dice 30 %: usar 20 %. Aplicar a servicios desde $300, plazo de 24 horas o dos horas antes cuando sea anterior. Un comprobante no confirma el anticipo y un vencimiento no libera el horario sin decisión de Admin o Recepción.

## Alcance y confirmaciones

- Proyecto separado de Railway, servicio programado `agendappx-mensajero`, cada cinco minutos. Arranca, procesa lo debido y termina. Sin volumen ni dominio nuevo. No tocar FiNeCi.
- Webhook firmado de Meta, respuestas, botones y comprobantes continúan en Cloudflare. Con `WHATSAPP_REMITENTE=railway`, Cloudflare no envía. Idempotencia y bloqueos protegen incluso si ambos procesos coinciden.
- Misma base de Supabase, rol `agendappx_mensajero` con permisos mínimos, TLS verificado y pooler. Las cuentas y la separación por salón son un requisito previo.
- Mensajes con consentimiento; silencio de 21:00 a 08:00; tope de 600/mes; conservar el tope diario y no reenviar resultados inciertos.
- Incluir las seis plantillas, comprobantes privados y revisión manual, avisos de cambios y anticipo vencido. Seguir omisiones y reprogramación de la especificación.
- Entregar a Antonio la guía de Meta Business, elegibilidad del número/coexistencia, método de pago, plantillas y secretos. Verificar requisitos y tarifas únicamente en fuentes oficiales; no tratar como tarifa oficial el precio no oficial de la sección 5.
- Secretos solo en Railway/Cloudflare; nunca en Git ni en el chat.
- Ejecutar todos los casos de la sección 6.
- **Pedir confirmación antes de desplegar y antes del primer mensaje real**, con costo concreto de Meta y destinatario.
- R2 conserva la restricción de costos: preparar sin activarlo hasta comprobar su situación y contar con autorización específica si puede facturar.

## Estimación preliminar de Railway (sin recursos activados)

Tarifas oficiales consultadas el 26 de octubre: RAM 10 USD/GB/mes, CPU 20 USD/vCPU/mes, salida 0.05 USD/GB. Hobby cuesta 5 USD/mes e incluye 5 USD de consumo; consumo mayor se cobra como diferencia, no otros 5 USD sumados a todo el consumo.

A 30 días son 8,640 ejecuciones. Ejemplo orientativo, no medición: 10 segundos encendido por ejecución, 0.25 GB de RAM y dos segundos efectivos de CPU consumen aproximadamente 0.083 USD de RAM + 0.133 USD de CPU al mes, más salida. Con 30 segundos, 0.5 GB y cinco segundos de CPU, serían unos 0.83 USD antes de salida. Presupuesto preliminar del mensajero: **0.20–1 USD/mes adicionales de consumo**, sujeto a medir arranque, duración y tráfico reales. No garantizar menos de 0.50 USD solo por el documento.

Si el consumo actual de 1.20 USD en 12 días mantiene ese ritmo, equivale a unos 3 USD en 30 días; con el mensajero serían aproximadamente 3.20–4 USD de consumo. En ese escenario seguiría dentro de los 5 USD incluidos en Hobby y la factura base sería 5 USD, antes de impuestos y otros cargos. Es una proyección con los datos aportados por Antonio, no una consulta a la facturación actual ni una garantía. Respetar el máximo compartido de 10 USD sin aumentar límites ni modificar FiNeCi.

Railway documenta que el intervalo mínimo es cinco minutos y que la puntualidad puede variar algunos minutos. Programar cada cinco minutos **no garantiza** un retraso máximo estricto de cinco minutos. Mantener la comprobación de mensajes detenidos tras 15 minutos y no enviar antes de la hora debida.

Meta y almacenamiento son costos separados del consumo Railway y no caben automáticamente dentro de su cuota. No activar envíos de plantillas ni recursos facturables sin autorización concreta.

Referencias oficiales:
- https://docs.railway.com/pricing/plans
- https://docs.railway.com/cron-jobs
