# WhatsApp vinculado, solo envíos: verificación del 27 de octubre de 2026

Estado: implementado y probado localmente en `codex/agendappx-whatsapp-vinculacion`, PR #3. Producción migrada y publicada con aprobación explícita el 27 de octubre; no se vinculó teléfono ni se mandó un mensaje real. Se preservó primero el calendario publicado de la rama de correcciones.

## Resultados reproducibles

- `npm test --prefix ritmo/servidor`: **174 pruebas aprobadas**, cero fallos. Incluye 34 pruebas nuevas de reglas, cifrado, Baileys simulado, API/proxy real y RLS, además de las regresiones anteriores.
- `node ritmo/servidor/pruebas/whatsapp-solo-envios-navegador.mjs`: SDK real de Supabase con transporte Auth simulado, primer enlace de un uso, enrolamiento/desafío TOTP, JWT firmado, sesión vigente/membresía real en PostgreSQL local y panel completo. Prueba guardar datos de banco y dirección, código efímero, marcar pago una vez, foto optimizada y White/Dark en 390/768/1440. Especialista recibe teléfonos ocultos del servidor.
- `npm run build --prefix ritmo/nube`: empaquetado del Worker con `--dry-run`; no publica.
- Las regresiones de navegador de PWA, fotos, actualización, diseño, calendarios y el proveedor histórico pasaron con Edge. El selector de la prueba general se actualizó al nombre «Mensajes de WhatsApp».

Las capturas nuevas están en `../imagenes/whatsapp-solo-envios/`. Solo muestran datos de prueba locales; no son datos del salón publicado.

## Sección 6, criterio por criterio

| Criterio solicitado | Evidencia |
|---|---|
| Ningún envío sin permiso, de noche, sin cita o pasados topes | `whatsapp-solo-envios.test.mjs`: consentimiento, fuente real, 21–08, cambio a silencio durante escribiendo, 30/h, 150/día y 600/mes por número; vuelve a comprobar teléfono y consentimiento antes de emitir |
| Pausas humanas | Reloj simulado: escribiendo de 2–5 s y reserva duradera de 20–60 s; el siguiente intento antes del plazo no envía |
| Omisiones de #3 y #4 | Cita creada con menos de 3 h, confirmación/anticipo de últimas 3 h, cita temprana avisada a las 19 h anteriores, reserva de menos de 90 min y llegada fuera de horario |
| Mover/cancelar | Invalida cola previa, avisa nuevo horario y reprograma; A→B→A produce generación nueva; cancelación retira pendientes; aviso de anticipo pendiente se conserva con hora nueva |
| Anticipo recibido una sola vez | Operaciones repetidas con bloqueo, clave estable de pago y una fila de aviso; foto no confirma; vencido no toca fuente ni libera horario |
| Entrantes sin guardar ni marcar leído | Adaptador sin listeners de mensajes/historial/contactos; eventos sintéticos no cambian tablas ni llaman readMessages; opciones descartan JID e historial. Se inspeccionó el código upstream fijado: ACK y retorno antes de procesar chat, no confirmación de lectura |
| Reinicio y desconexión | Claves Signal y credenciales vuelven a cargarse cifradas en otra instancia sin pedir código; aceptación se distingue de entrega; desconexión no envía y alerta tras diez minutos; incertidumbre/proceso interrumpido nunca se repiten |
| Freno ante bloqueo | 401/403/429 persistidos; siguiente vuelta no emite, Recepción no reactiva, Admin debe confirmar revisión |
| Sesión ilegible sin llave | AES-GCM con AAD de salón/id/versión, nonce aleatorio, fallo con llave alterada, tenant ajeno y tag manipulado. Una llave incorrecta no sobrescribe ni borra credenciales |
| Privacidad de Especialista | API prohíbe vínculo y pago; no devuelve CLABE ni recibos. Fuente de citas filtrada con RLS y teléfonos ocultos; otro salón y sesión revocada fallan; rol del job no puede modificar fuente ni leer auth.sessions |
| Cloudflare no envía en vinculado | `usaMeta('vinculado') === false`; bandera aplicada al cron del Worker y servidor legado y webhook devuelve 503 sin ejecutar Meta; API de control reenvía JWT al único servicio propio |

## Pruebas adicionales

Custodia única por proceso y generaciones contra escrituras antiguas; reconexión progresiva; rol de ejecución sin privilegios amplios; origen, métodos, cuerpo de 64 KB y ausencia de secretos en respuestas; JWT inventado, APP_TOKEN, aal1, roles distintos y salón ajeno no vinculan. La configuración pública rechaza sb_secret y solo acepta una clave publicable/anon.

La migración conserva un feed heredado del dueño y permite feeds por persona: la prueba verifica estabilidad del enlace, ausencia de notas/teléfonos/pagos y revocación inmediata al quitar membresía. Al activar cuentas se bloquean rutas de datos heredadas sin identidad; las colas/cachés del navegador se separan por usuario/salón/rol/MFA. Ninguna prueba escribe en la base pública.

## Límites reales de esta verificación

No hay Docker instalado localmente. La imagen Linux se construyó en Railway: despliegue af30f7e3-448f-42ef-86a4-e1d563529cb5, SUCCESS, /salud 200, inicio real 2026-10-27T19:11:09.551883275Z. Vinculación y envíos permanecen apagados.

La prueba de protocolo es con transporte simulado, sin una sesión física. No prueba entrega a un teléfono, posibles cambios del protocolo de WhatsApp, memoria real del socket conectado ni estabilidad durante días. El despliegue ya fue aprobado y realizado; vinculación y primer mensaje real requieren sus aprobaciones separadas. Ya existe fecha real de inicio para el informe de una semana, pero aún no una medición representativa del costo del teléfono conectado.

El acceso temporal de Admin evita depender del SMS de Brevo, pero no completa el registro público, bienvenida, equipo ni todos los requisitos de CUENTAS.md. La aprobación de WhatsApp priorizó este alcance mínimo seguro.

## Comprobación posterior a publicación

Siete tablas conservan exactamente sus campos originales mediante SHA-256 canónico UTF-8: estado 1, objetos 23, mutaciones 42, integraciones 2, tres tablas de WhatsApp sin filas. No se volvieron a transferir datos del respaldo para compararlos. Un primer script de verificación local leyó UTF-8 con cp1252 y produjo falsos desacuerdos; corregir la codificación confirmó todas las coincidencias sin cambiar datos.

Cloudflare página, configuración y salud: 200. Agenda/control sin identidad y con APP_TOKEN: 401. Meta: 503. Feed privado heredado: 200, VCALENDAR Agendappx, sin DESCRIPTION. Navegador Edge real 390 px: Ajustes → Mensajes de WhatsApp → Acceso de Admin visible, sin errores JavaScript ni desbordamiento. No se consumió el enlace del dueño. Supabase confirma un Admin activo y cero sesiones WhatsApp.

Asesoría de seguridad: dos INFO por RLS sin políticas en tablas privadas sin acceso directo; WARN de protección de contraseñas filtradas desactivada, fuera del flujo sin contraseña implementado. No se ampliaron permisos ni planes para suprimir avisos.

## Horario 24 horas publicado — 28 de octubre de 2026

Antonio confirmó «publícalo» y «sigue» después de autorizar códigos, citas y promociones a cualquier hora. Se implementó y publicó el cambio en los avisos de citas existentes y su texto de configuración. No se publicaron como terminados el login por WhatsApp, la sesión de plataforma ni las campañas: continúan en preparación según SIGUIENTE-VERSION.md.

Aplicación `a17a88b`, rama codex/agendappx-siguiente-version, PR #7. Cloudflare `843ab4e0-a836-4acd-9a1e-abf420770707`; Railway `9a4a3f3b-8a32-48fd-a652-2a1c09d2ab99`, SUCCESS, proceso listo 2026-10-28T07:57:22.104148792Z. No reiniciar el conteo semanal: el servicio comenzó originalmente el 27 de octubre, y estos logs corresponden a su actualización. Una réplica, máximo 0.5 GB/0.1 vCPU; sin cambios de planes ni límites.

Se eliminaron filtros de silencio 21–08 y la omisión nocturna del aviso anterior a la cita. Se conserva la hora programada, caducidad al comenzar/cancelar la cita, consentimiento, pausas, límites y freno persistente. La huella de configuración cambia a 24h-v1 para actualizar planes pendientes conservando la confirmación ya enviada, los anticipos y los resultados inciertos. Anticipo predeterminado 30 % y las otras funciones del encargo completo se incorporarán en su etapa propia; no se cambiaron pagos ni preferencias guardadas en esta publicación.

Verificación: 180 pruebas automáticas, cero fallos; navegador SDK real con Auth/WhatsApp simulado y RLS local, pagos/fotos/White/Dark a 390/768/1440. Incluye noches, cruce de medianoche y de las 21, programación de madrugada, caducidad, replanificación sin duplicados, consentimiento y topes. Producción: Cloudflare y Railway /salud 200; agenda anónima 401, Meta 503; JavaScript publicado idéntico por SHA-256; navegador real conserva buscador y panel sin errores. Lectura con rol mínimo confirmó cero sesiones. `WA_VINCULACION_HABILITADA=false`, `WA_ENVIOS_HABILITADOS=false`; no hubo mensajes reales ni cambios en FiNeCi. No se ejecutó migración.
