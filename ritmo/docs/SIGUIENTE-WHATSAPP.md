# Siguiente encargo de Agendappx: WhatsApp vinculado, solo envíos

Actualizado el 29 de octubre de 2026, 18:52 UTC. La publicación del registro automático fue autorizada y ejecutada desde e3ecda7 (PR #10); los códigos normales de cuentas existentes están activos en Railway (modo cuentas) y la sesión de plataforma sigue conectada. Los avisos de citas/promociones y nuevas vinculaciones continúan apagados. El registro de salones nuevos permanece cerrado hasta que Antonio guarde REGISTRO_OPERACION_KEY en Supabase Edge Function Secrets; el navegador integrado aún informa desactivado. No regenerar la llave ni volver a migrar. Ver el cierre operativo de REGISTRO-WHATSAPP.md; las secciones anteriores son históricas.

## Fuente y autorización

Se leyó completo `ritmo/docs/WHATSAPP-AUTOMATICO.md` (secciones 0–6), de `claude/es-posible-esto-tjimmb`, commit **dc15fe5**. Se conserva una copia exacta en esta rama. El prototipo está en `ritmo/cuentas/index.html` y la captura solicitada es `ritmo/imagenes/whatsapp-vincular.png`; no se fusionaron nuevas pantallas a la página publicada.

Antonio autorizó conexión de dispositivo vinculado como FiNeCi, aceptando el riesgo de bloqueo, y sustituyó la prohibición de librerías no oficiales. Se verificó de solo lectura `financial-app/src/lib/whatsapp.ts`, función requestWhatsAppPairingCode: usa Evolution API con integración **WHATSAPP-BAILEYS**. Reutilizar Baileys como biblioteca, con versión corregida y fijada; no reutilizar números, sesiones, bases, proyectos, servicios o secretos de FiNeCi. No incorporar versiones vulnerables solo por coincidir con una imagen vieja del proveedor.

## Cambios respecto a la preparación anterior del PR #3

- Un solo servicio permanente, **agendappx-whatsapp**, en un proyecto Railway aparte; una réplica y revisión de cola cada minuto. Reemplaza los planes anteriores de proveedor más cron agendappx-mensajero cada cinco minutos. No crear servicios duplicados.
- Sesión en whatsapp_sesiones por negocio, **AES-256-GCM**, llave WA_SESSION_KEY solo en Railway. La sesión persistente sin cifrar del motor anterior no basta. Nonce único por escritura, autenticación del negocio/tipo en el cifrado, cifrado también de claves de sesión, actualización transaccional y bloqueo que impida dueños simultáneos. Recuperación gradual conservando credenciales ante fallos temporales.
- Rol propio agendappx_whatsapp de mínimos permisos y TLS verificado. Admin con sesión vigente, membresía y MFA para vincular/desvincular. Especialistas no ven CLABE, comprobantes, vinculación ni credenciales.
- Solo envíos. Descartar eventos de mensajes entrantes e historial sin persistencia ni logs de contenido; no leer comprobantes ni emitir confirmaciones de lectura. Los eventos de control imprescindibles del protocolo para mantener conexión/credenciales y confirmar envíos propios no son un chatbot. Las respuestas se atienden manualmente en el teléfono.
- Código efímero de **ocho caracteres alfanuméricos**: el ejemplo K7QM-29XA de la propia especificación no es solo numérico. Si el protocolo asíncrono exige persistirlo, cifrarlo, limitar su vigencia y acceso; nunca registrarlo en logs ni entregar llaves al navegador.
- WHATSAPP_REMITENTE=vinculado debe bloquear **todos** los envíos de Cloudflare y dejar Meta deshabilitado, conservando su código. La bandera está implementada y cubierta por las pruebas nuevas; está activada en producción desde el despliegue del 27 de octubre.
- Reemplaza botones de confirmación y automatizaciones de respuestas/comprobantes por gestión humana. Los cinco tipos de aviso salen solo por el remitente del salón. Se confirma el anticipo únicamente al marcarlo en la app.

## Reglas que se conservan

Consentimiento y cita válida; 20–60 s de pausa por número, escribiendo 2–5 s, máximo 30/h y 150/día (configurable solo hacia abajo), silencio 21:00–08:00 CDMX, idempotencia y estado incierto sin reintento automático. Al mover/cancelar invalidar pendientes y reprogramar; comprobar de nuevo consentimiento, estado y horario justo antes del envío. Freno persistente ante bloqueo/exceso, con reactivación explícita de Admin. Aviso a Admin si la conexión no vuelve en diez minutos.

Cumplir las ventanas especiales de la sección 2: recordatorio temprano la noche anterior a las 19:00 cuando corresponda, omisión por cita reciente o confirmación/anticipo enviados en las últimas tres horas, y omisión de aviso de llegada cuando la reserva tiene menos de 90 minutos. Lo tardío o fuera de horario no debe provocar recordatorios después de empezar/cancelar la cita.

Decisiones directas previas de Antonio: **anticipo predeterminado 20 %** y **tope mensual 600 mensajes**, conservados hasta una instrucción posterior que los sustituya expresamente. La especificación de Claude dice 30 % de anticipo: esta discrepancia queda documentada y no modifica silenciosamente lo aprobado. Precio mínimo $300, plazo de 24 h o dos horas antes cuando sea anterior; nunca liberar horario al vencer sin decisión humana. Comprobante adjunto solo manual, protegido por los roles.

## Pronóstico actualizado: un único servicio permanente

Pronóstico, no medición de un mes: el servicio arrancó el 27 de octubre. Base previa verificada ese día: uso 1.2988 USD y proyección **2.3489 USD**, límite compartido 10 USD y aviso existente en 5 USD, sin cambios. La consulta posterior al arranque fue 1.3016 USD acumulados y proyección 2.3512 USD: incluye todos los recursos y pocos minutos del nuevo servicio; todavía no permite atribuirle un mes de gasto.

Tarifas de contenedor Railway contrastadas el 27 de octubre: RAM 10 USD/GB/mes, CPU 20 USD/vCPU/mes, salida 0.05 USD/GB. Hobby cuesta mínimo 5 USD e incluye 5 USD de recursos: factura antes de impuestos = máximo entre 5 USD y consumo total. No sumar 5 USD de nuevo al total de recursos.

| Escenario de 30 días | RAM media | CPU media | Servicio nuevo, incluido el bucle | Consumo conjunto | Factura total estimada, antes de impuestos |
|---|---:|---:|---:|---:|---:|
| Ligero | 0.15 GB | 0.01 vCPU | 1.75 USD | 4.10 USD | 5.00 USD |
| Intermedio | 0.25 GB | 0.02 vCPU | 2.95 USD | 5.30 USD | 5.30 USD |
| Alto | 0.50 GB | 0.03 vCPU | 5.65 USD | 8.00 USD | 8.00 USD |

Supuesto de 1 GB de salida al mes. Fórmula del servicio: RAM media × 10 + CPU media × 20 + salida GB × 0.05. La CPU incluye conexión, cifrado y revisión de cola del mismo proceso; no hay un cron adicional que sumar. Las esperas deben usar temporizadores, no ocupar CPU en bucle. Promesa de 150–250 MB aún sin comprobar con un teléfono real. El primer ciclo será proporcional al tiempo encendido; no atribuirle un mes completo antes de activarlo.

Presupuesto operativo recomendado: mantener proyección compartida por debajo de 8 USD para dejar margen frente a 10 USD, fluctuaciones e impuestos. Un uso alto deja poco margen: no garantizar un costo fijo ni aumentar límites/recursos sin autorización específica. No configurar alertas nuevas ni tocar alertas de FiNeCi hasta identificar el alcance exacto aprobado.

La estimación anterior de dos procesos sigue como histórica en WHATSAPP-VINCULACION.md/herramientas/pronostico-whatsapp.mjs; **no usarla como cálculo del servicio único actual**. Ni las pruebas anteriores ni aquel Dockerfile demuestran cifrado o ausencia de procesamiento entrante del alcance nuevo.

## Informe real al cumplir una semana

Seguimiento creado en este chat: **consumo-de-whatsapp-de-agendappx-tras-una-semana**. Revisa a las 09:00 CDMX y permanece en silencio mientras el servicio no exista o no complete siete días desde su fecha real de encendido. Entonces informa una sola vez: gasto atribuible, total compartido, proyección del ciclo y margen frente a 10 USD; distingue consumo e importe mínimo Hobby. No debe activar servicios ni mandar WhatsApp por hacer el informe. Inicio verificado por el log «servicio de solo envíos listo»: **2026-10-27T19:11:09.551883275Z** (13:11:09 CDMX). Despliegue Railway `af30f7e3-448f-42ef-86a4-e1d563529cb5`, SUCCESS; el contenedor comenzó a las 19:11:04.523184917Z. Los siete días se cumplen el **3 de noviembre a las 19:11:09 UTC / 13:11:09 CDMX**. El chequeo diario de las 09:00 CDMX puede entregar el informe el 4 de noviembre si no hay otra ejecución posterior al aniversario. Si faltan permisos para consultar, indicarlo en lugar de inventar cifras. Tras el informe, pausar el seguimiento.

## Estado verificable de la implementación

Código nuevo en `servidor/src/whatsapp-vinculado`, `whatsapp/` y panel de la app. Reemplaza el proveedor anterior por Baileys fijado a 7.0.0-rc13. Cifrado, custodia, reconexión gradual, límites, reglas por cita, anticipo manual, comprobante, acceso firmado con MFA y bandera de Cloudflare ya tienen pruebas locales. Se integró primero el calendario publicado para evitar regresiones.

Resultados y limitaciones en `WHATSAPP-PRUEBAS.md`; instrucciones operativas en `../whatsapp/README.md`. No confundir transporte simulado con una vinculación física o garantía de estabilidad continua. La imagen Linux se construyó en Railway y pasó /salud; la vinculación física y la primera entrega siguen pendientes de confirmación separada.

La migración propuesta conserva los datos sincronizados, versiones e integración del calendario y los asigna al salón y Admin aprobados. Los pendientes que solo existan en el celular permanecen en la copia heredada y se pueden revisar/importar exclusivamente desde el Admin migrado, conservando conflictos; no se mezclan automáticamente con otras cuentas. Se tomó respaldo bajo mantenimiento y la comparación canónica SHA-256 de las siete tablas confirmó conservación exacta de campos originales, 23 objetos, 42 mutaciones y dos integraciones.

La fecha real de activación consta arriba. Migración y publicación ya aprobadas y ejecutadas. Siguen pendientes las confirmaciones separadas de vinculación y primer mensaje con destinatario/consentimiento. No comprar dominios ni modificar FiNeCi.

Fuentes primarias: [tarifas de Railway](https://docs.railway.com/pricing/plans), [Baileys](https://github.com/WhiskeySockets/Baileys), [especificación solicitada](https://github.com/caguamex/security-recorder/blob/dc15fe5/ritmo/docs/WHATSAPP-AUTOMATICO.md).


## Publicación completada — 27 de octubre de 2026

- Worker `49605020-f7e9-4403-8a0d-8b51ab3c3743`, misma URL e infraestructura. Cuentas activas, mantenimiento retirado y `WHATSAPP_REMITENTE=vinculado`.
- Railway: proyecto `d82e4094-d981-43cc-ae41-9a73d09cd57a`, servicio `3aae5f13-8c07-40bb-8c75-35233c18883b`, producción `9c3c8682-4a24-4d7a-83f8-8a728945b7ca`. Una réplica, límite 0.5 GB/0.1 vCPU, sin suspensión ni recursos adicionales. `/salud` responde 200.
- Migración `cuentas_whatsapp_solo_envios_aprobado_20261027`: esquema de cuentas + solo envíos y rol mínimo con TLS comprobado. Un Admin activo; cero sesiones WhatsApp. La llave Admin de Supabase se usó únicamente por la API oficial y permanece fuera de Git/Cloudflare/Railway.
- Enlace privado de acceso del propietario preparado fuera de Git. El dueño completa TOTP en su dispositivo; no se consumió su enlace en una prueba ni se creó una sesión artificial.
- Verificación pública: página/configuración/salud 200; agenda y control sin identidad 401, también con APP_TOKEN; webhook Meta 503. Feed heredado 200, Agendappx, sin notas. Navegador real 390 px muestra Acceso de Admin sin SMS, sin errores ni desbordamiento.
- `WA_ACTIVAR_SERVICIO=true`; **`WA_VINCULACION_HABILITADA=false` y `WA_ENVIOS_HABILITADOS=false`**. No abrir socket, generar código real ni enviar hasta la aprobación correspondiente. FiNeCi no se modificó.
- Asesoría Supabase: dos INFO de RLS sin políticas en tablas privadas internas (sin grants públicos, uso mediante funciones controladas) y WARN de protección de contraseñas filtradas desactivada. El acceso implementado es sin contraseña; no activar servicios de pago para silenciar ese aviso.

El resto de CUENTAS.md (registro público, equipo y bienvenida completos) sigue pendiente; esta entrega es el acceso mínimo seguro necesario para probar WhatsApp.

## Horario 24 horas publicado — 28 de octubre de 2026

Antonio confirmó «publícalo» y «sigue» después de autorizar códigos, citas y promociones a cualquier hora. Se implementó y publicó el cambio en los avisos de citas existentes y su texto de configuración. No se publicaron como terminados el login por WhatsApp, la sesión de plataforma ni las campañas: continúan en preparación según SIGUIENTE-VERSION.md.

Aplicación `a17a88b`, rama codex/agendappx-siguiente-version, PR #7. Cloudflare `843ab4e0-a836-4acd-9a1e-abf420770707`; Railway `9a4a3f3b-8a32-48fd-a652-2a1c09d2ab99`, SUCCESS, proceso listo 2026-10-28T07:57:22.104148792Z. No reiniciar el conteo semanal: el servicio comenzó originalmente el 27 de octubre, y estos logs corresponden a su actualización. Una réplica, máximo 0.5 GB/0.1 vCPU; sin cambios de planes ni límites.

Se eliminaron filtros de silencio 21–08 y la omisión nocturna del aviso anterior a la cita. Se conserva la hora programada, caducidad al comenzar/cancelar la cita, consentimiento, pausas, límites y freno persistente. La huella de configuración cambia a 24h-v1 para actualizar planes pendientes conservando la confirmación ya enviada, los anticipos y los resultados inciertos. Anticipo predeterminado 30 % y las otras funciones del encargo completo se incorporarán en su etapa propia; no se cambiaron pagos ni preferencias guardadas en esta publicación.

Verificación: 180 pruebas automáticas, cero fallos; navegador SDK real con Auth/WhatsApp simulado y RLS local, pagos/fotos/White/Dark a 390/768/1440. Incluye noches, cruce de medianoche y de las 21, programación de madrugada, caducidad, replanificación sin duplicados, consentimiento y topes. Producción: Cloudflare y Railway /salud 200; agenda anónima 401, Meta 503; JavaScript publicado idéntico por SHA-256; navegador real conserva buscador y panel sin errores. Lectura con rol mínimo confirmó cero sesiones. `WA_VINCULACION_HABILITADA=false`, `WA_ENVIOS_HABILITADOS=false`; no hubo mensajes reales ni cambios en FiNeCi. No se ejecutó migración.


## Login por WhatsApp preparado — 28 de octubre de 2026

Antonio pidió implementar el login por WhatsApp. Se agregó el proxy OTP con el SDK real, límites durables 3/destino/15 min y 10/IP/h, cinco intentos y diez minutos, hook Standard Webhooks con texto fijo, sesión cifrada de plataforma aislada en tablas plataforma_*, prioridad de códigos y acceso de Admin con MFA. Sesiones nuevas de Auth requieren admisión del proxy para impedir que la API pública evite los límites. Se conserva la identidad existente mediante phone_change autenticado; no hay altas ni fusiones automáticas. Recuperación solo por enlace de operación registrado y UUID esperado. Correo tiene bandera independiente y sigue pendiente del SMTP real.

193 pruebas automáticas aprobadas y navegador local con SDK real/RLS: WhatsApp, correo simulado, MFA, Recepción, mismo UUID, vinculación propia, espera de veinte segundos y White/Dark a 390/768/1440. Cloudflare dry-run. Detalles, configuración, operación y límites reales en docs/LOGIN-WHATSAPP.md (desde docs, LOGIN-WHATSAPP.md). No confundir preparación con publicación: esta migración y etapa no están desplegadas, el número no está vinculado y no hubo códigos reales. Confirmaciones pendientes antes de migrar/publicar, vincular y primer envío. Los diez códigos de respaldo MFA y el resto del encargo de cuentas siguen pendientes de sus etapas propias.


## Login publicado, activación pendiente — 28 de octubre de 2026

Antonio confirmó «sí autorizo». Respaldo verificado y migración 20261028163724_login_whatsapp_aprobado_20261028 aplicada. Las 21 tablas previas conservan sus huellas exactas y el mismo Admin. Aplicación 9e3c0e8, PR #7; Worker 0679a8c3-eb04-483a-ad3b-410356aaeb6b y Railway b63a5b0a-e9dd-443b-a87f-4feff1dfc80c SUCCESS, sin modificar planes, límites, recursos ni FiNeCi. Salud, archivos y pantalla real de login verificados; detalle y respaldo en docs/LOGIN-WHATSAPP.md (desde docs, LOGIN-WHATSAPP.md).

La pantalla está publicada; los códigos aún NO funcionan: external.phone=false, Send SMS Hook pendiente y control del navegador deshabilitado en Work. Se pidió habilitarlo para completar la configuración de Supabase y cerrar altas públicas. Correo y las cuatro banderas de vinculación/envío de Railway siguen apagados. Cero sesiones vinculadas y envíos reales. Confirmaciones para vincular número y primer código siguen pendientes. Preservar el inicio real del servicio del 27 de octubre para el seguimiento semanal.


Vinculación de plataforma: primer intento rechazado sin llegar a conectado. Reparación local del saludo de registro y conservación del intento pasó 196 pruebas. Antonio autorizó explícitamente publicar la reparación y generar otro código; ver última entrada de LOGIN-WHATSAPP.md. No habilitar envíos reales ni borrar credenciales.

La comprobación pasiva detectó rechazo 405 de la versión de protocolo incluida; la actual sí preparó el registro. Reparación ampliada dentro de la aprobación vigente: consulta acotada y caché de versión; 198 pruebas aprobadas. Ver LOGIN-WHATSAPP.md. Pendiente publicar este ajuste y entregar código físicamente válido, sin habilitar mensajes.


## Registro automático ampliado — preparación del 29 de octubre

Antonio pidió terminar códigos automáticos y confirmó incluir salones nuevos, además de su equipo por invitación. Rama codex/agendappx-registro-whatsapp; detalle, seguridad y activación en REGISTRO-WHATSAPP.md. Implementación local: acceso normal, creación de un salón vacío y equipo con OTP/MFA. El intermediario de alta aislado en Supabase mantiene cerrado el registro abierto y no entrega la llave Admin al Worker o mensajero. No se aplicó la migración nueva, publicó ni enviaron códigos reales. Brevo sigue pendiente por decisión de Antonio. Antes de publicar y activar códigos se requiere su confirmación para este conjunto. No reiniciar el contador semanal ni vincular nuevamente el número.
