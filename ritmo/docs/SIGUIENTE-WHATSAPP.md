# Siguiente encargo: WhatsApp automático con anticipo

Antonio lo encargó el 26 de octubre de 2026. **Comenzar la implementación cuando termine cuentas**. No se ha creado el servicio, activado Meta ni modificado FiNeCi.

Fuente: rama `claude/es-posible-esto-tjimmb`, commit `513d086`, `ritmo/docs/WHATSAPP-AUTOMATICO.md`, secciones 0–6; prototipo `ritmo/cuentas/index.html` y captura `ritmo/imagenes/whatsapp-anticipo.png`. Se revisó la especificación sin fusionar sus pantallas a la rama de cuentas en curso.

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
