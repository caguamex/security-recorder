# Implementación de cuentas de Agendappx

Rama: `codex/agendappx-cuentas-equipo`. Base funcional publicada: `codex/pwa-backend-belleza`.
Especificación aprobada: `CUENTAS.md`, incluida la sección 1b y el prototipo de Claude del commit `2377c67`.

## Confirmaciones de Antonio

- Admin inicial: `antonio.t.22@hotmail.com` (la asignación se hará mediante el procedimiento de migración aprobado, nunca por comparación de correo en el cliente).
- No tiene dominio propio. No comprar dominios ni renombrar infraestructura.
- Antes de migrar datos y antes de desplegar, pedir confirmación por separado.
- Conservar diseño 3D, navegación, White/Dark, fotos, sincronización y funcionamiento sin conexión.

## Estado: segunda etapa de servidor, 26 de octubre de 2026

Se incorporan el prototipo aprobado y módulos de servidor para:

- Verificación JWT con ES256/RS256, emisor y audiencia fijos, duración máxima de una hora, sesión obligatoria y llaves públicas en caché. Dependencia `jose` fijada en 6.2.13; no se confía en metadatos editables.
- Comprobación de sesión vigente contra `auth.sessions` sin exponer esa tabla al rol API. Actividad propia de la app para cerrar Recepción y Especialista tras 30 días sin uso, sin contratar Pro.
- Contexto SQL transaccional con usuario, salón y nivel MFA; la membresía se consulta en cada operación.
- Repositorio por salón con RLS, revisión e idempotencia acotadas, y respuestas filtradas por rol.
- Teléfonos ocultos para especialistas incluso en conflictos, reintentos e historial; editar una copia oculta conserva el teléfono original.
- Invitaciones de 128 bits, hash SHA-256, vencimiento de 48 horas, aceptación atómica y límite persistente de diez intentos por IP/hora. La IP debe llegar de Cloudflare, convertida en huella con una clave del servidor.
- Historial con actor y fecha, protección del último Admin y retiro de citas reasignadas mediante snapshots completos.

**Todavía no están conectados a las rutas de producción.** No es una implementación completa de cuentas. La página publicada conserva su comportamiento anterior. El archivo `supabase/migrations/*_cuentas_equipo.sql` está preparado y probado localmente, sin aplicar a Supabase. Rechaza ejecutarse sin las variables de confirmación, negocio y Admin; estas variables son un seguro operativo, no sustituyen el permiso humano ni el respaldo previo.

Validación: `npm test --prefix ritmo/servidor`, **116 pruebas aprobadas**. La batería incluye pruebas directas contra PostgreSQL local (PGlite), ejecutando como `ritmo_api`, sin superusuario, sin BYPASSRLS y sin ser propietario. Los casos de la sección 10 ya tienen cobertura local para roles/RLS, invitaciones e historial; falta la integración con sesiones reales, las rutas y las interfaces antes de acreditar el flujo completo. Ninguna prueba envía mensajes ni accede a producción.

Las funciones privilegiadas se limitan a la consulta mínima de vigencia de sesión, registro de actividad, consultas internas necesarias para evitar recursión RLS, aceptación atómica de invitaciones y escritura de historial. Usan nombres calificados, búsqueda fija y permisos de ejecución revocados a PUBLIC/anon/authenticated. Las funciones de datos privados comparan el usuario transaccional con `auth.uid()`. Las dos funciones previas al acceso solo entregan información mínima de la invitación o cuentan intentos, accesibles desde el rol privado del servidor.

Pendiente: conectar el verificador y el contexto de cuentas al enrutador HTTP, validar el algoritmo de firma real del proyecto (no se acepta HS256 ni se cambia la configuración publicada por suposición); OTP y registro; MFA y recuperación; interfaz de equipo, agenda por especialista, bienvenida y perfil público; disponibilidad y reservas; separación de cachés por cuenta; calendario privado; correos diarios; respaldo cifrado y restauración. La proyección de ingresos oculta campos estructurados y mantiene el precio público de los servicios: conocer los precios y citas no equivale a acceso al reporte de ingresos.

## Brevo pendiente hasta el 27 de octubre

Antonio creó la cuenta Free pero no recibió ni SMS ni llamada de verificación. Pidió dejarlo pendiente y recordarlo el **27 de octubre de 2026 a las 09:00, America/Mexico_City**. Se creó un único recordatorio en este chat (`retomar-verificaci-n-de-brevo`). No pedir más reintentos durante este trabajo. El SMTP, las llaves y la entrega real siguen sin configurar ni verificar.

## Correo sin dominio propio (provisional)

Brevo documenta que reemplaza temporalmente los remitentes gratuitos por una dirección propia autenticada. Esto permite probar el envío desde una cuenta registrada con Hotmail sin comprar dominio, pero no garantiza entrega ni sustituye permanentemente un dominio propio. No intentar verificar DNS de `hotmail.com` o `workers.dev`. Verificar la cuenta y la entrega antes de habilitar el acceso por correo.

1. Antonio crea su cuenta Brevo Free y verifica su correo. Si se pide sitio web, usar la URL actual de Agendappx. Usar sus datos reales en el registro.
2. Conservar Free (0 USD, hasta 300 correos diarios compartidos entre códigos y resúmenes). No activar pruebas de pago, mejoras ni compras.
3. En Brevo: Configuración → SMTP y API → SMTP → generar llave estándar para Agendappx. Guardarla de forma privada; nunca en el chat o Git.
4. La llave SMTP irá en Supabase → proyecto `zkqwephmuflbuagevvxj` → Authentication → SMTP Settings → Password. Host `smtp-relay.brevo.com`, puerto `587`, usuario SMTP mostrado por Brevo, nombre de remitente Agendappx y remitente verificado. Preparar estos datos no autoriza migrar ni publicar.
5. Los resúmenes del Worker requerirán una llave API HTTPS distinta, como secreto `BREVO_API_KEY`; la llave SMTP no sirve para ese propósito. Ambas consumen la misma cuota. Priorizar códigos de acceso y detener los resúmenes antes de agotarla.
6. Probar entrega en Hotmail y correos del equipo, expiración, reenvío y límites.

Referencias oficiales consultadas el 26 de octubre de 2026:
- https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders
- https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
- https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys

## Límites que deben resolverse antes de producción

- Las políticas permisivas RLS se suman con OR: la pertenencia al salón y las restricciones del rol deben cumplirse juntas. No copiar una política adicional que abra datos ajenos.
- Los teléfonos se ocultan en servidor también en historial, conflictos y sincronización; `ver_todas` nunca concede teléfonos ni escritura sobre citas ajenas.
- La revocación se comprueba con membresía vigente en cada operación; un JWT sin expirar no conserva acceso.
- Supabase no entrega diez códigos de recuperación MFA listos para usar: se necesita un flujo propio seguro, con hashes y consumo atómico. Recuperar obliga a reinscribir TOTP, sin conceder acciones Admin con `aal1`.
- La inactividad de 30 días se implementó en el servidor sin usar controles Pro. Faltan el cierre de sesión del SDK, la interfaz y las pruebas completas en navegadores.
- R2 tiene cuota gratuita y cargos por exceso. No está activado para esta etapa; preparar respaldo/retención/restauración sin contratar recursos facturables. El presupuesto previo de Railway no autoriza cargos R2.
- No mezclar caché y cola de la agenda heredada con cuentas nuevas ni subirla automáticamente a otro salón.
