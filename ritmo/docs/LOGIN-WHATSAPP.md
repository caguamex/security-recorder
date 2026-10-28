# Login por WhatsApp — implementación preparada, 28 de octubre de 2026

Rama codex/agendappx-siguiente-version, PR #7. Fuente CUENTAS.md y WHATSAPP-AUTOMATICO.md, f743ccf; Antonio pidió «implementa el login por whats app». Implementación local terminada y verificada. No se aplicó esta migración, no se publicó esta etapa, no se vinculó ningún número y no se envió ningún mensaje real.

## Comportamiento entregado

Ruta visible actual: Ajustes → Sincronización → Iniciar sesión. La bienvenida completa pertenece a la siguiente etapa del encargo. La pantalla «Iniciar sesión» pide diez dígitos mexicanos y envía un código de seis dígitos. El SDK real de Supabase conserva y renueva la sesión; no hay contraseñas. El intercambio pasa por rutas propias /api/acceso/solicitar y /verificar que usan exclusivamente la llave publicable y create_user:false. No se crean usuarios ni se conceden membresías por escribir un teléfono o correo.

El servicio Railway recibe POST /hook/codigo directamente de Supabase. Valida Standard Webhooks sobre el cuerpo exacto, timestamp ±5 minutos, id y firma v1; admite el payload real user + sms.otp, con sms.phone en versiones recientes. No admite un endpoint libre {telefono,codigo,texto}. Solo envía el texto fijo de CUENTAS.md. Antes de enviar exige una solicitud reciente creada por el servidor; así llamar directamente a /auth/v1/otp no evita el límite por IP. Phone change necesita además el ticket del mismo usuario autenticado.

No se almacena el OTP, teléfono, IP ni prueba del navegador en claro: solo HMAC SHA-256 con una llave privada aleatoria. Los códigos viven en memoria mientras se envían. Los tickets duran diez minutos, con máximo cinco intentos, tres solicitudes por destino en quince minutos y diez por IP en una hora. Los contadores y bloqueos están en PostgreSQL. Las solicitudes caducadas se limpian después de un día al pedir otro código. El proxy usa CF-Connecting-IP aportado por Cloudflare; no confiar en una cabecera enviada a un servidor Node público distinto.

La verificación se hace con Supabase y después con JWKS. Se admite en acceso_sesiones solo la sesión que terminó el intercambio controlado. sesion_vigente conserva sus comprobaciones de Auth, revocación, actividad, membresía y MFA, y exige esa admisión para sesiones nuevas. Una sesión conseguida directamente desde el API público de Auth no puede acceder a Agendappx ni saltarse los cinco intentos. La migración conserva explícitamente las sesiones existentes, sin editar auth.users ni auth.sessions.

Admin conserva MFA TOTP obligatorio aal2; Recepción y Especialista entran según sus permisos, sin imponerles el segundo paso de Admin. Los diez códigos de recuperación de MFA del encargo general siguen pendientes de la etapa Seguridad: no se generan códigos ficticios ni JWT aal2 propios.

El botón de correo cambia el canal y también aparece como alternativa al cumplirse veinte segundos o ante un error. El servidor lo habilita solo si el correo está configurado. Brevo sigue pendiente: la prueba de correo es con transporte simulado, no acredita entregabilidad real. Usar una cuenta por teléfono y correo ya verificados, nunca fusionarlas por coincidencias. Para el Admin existente, entrar con su sesión y dos pasos, elegir «Vincular mi WhatsApp a esta cuenta», verificar phone_change y conservar el UUID. El propietario conserva todas las citas y permisos.

## Sesión de plataforma aislada

528661241483, instancia textual codigos, en plataforma_conexiones/plataforma_sesiones/plataforma_alertas. No es un negocio ficticio. La custodia, los cercos y el cifrado AES-256-GCM se reutilizan con tablas privadas distintas y AAD diferente. Las sesiones de salones continúan en whatsapp_*; no se usan claves, servicios ni sesiones de FiNeCi.

Los códigos tienen prioridad al tomar mensajes y después de la pausa de «escribiendo». No consumen las cuotas de citas. El hook no espera una cola larga ni una reconexión: procesa como máximo un código a la vez, con presupuesto corto de red para terminar dentro de los cinco segundos de Supabase. Ante demora ofrece correo. Una aceptación de WhatsApp no acredita lectura ni entrega al teléfono. Un resultado incierto queda bloqueado sin repetición automática, también tras reiniciar. Un 401/403/429 del remitente activa el freno de plataforma.

La operación de vinculación escucha exclusivamente 127.0.0.1:8081 dentro del contenedor, con llave propia y flag explícito. El servicio público no expone su código de plataforma. Ejecutar dentro de Railway, solo tras autorización de Antonio:

    node ritmo/whatsapp/operar-codigos.mjs estado
    node ritmo/whatsapp/operar-codigos.mjs codigo

Código de ocho caracteres, máximo tres solicitudes en quince minutos y un minuto entre solicitudes. El operador debe confirmar antes en el teléfono cuántos dispositivos están vinculados y que haya un lugar libre; esta implementación no consulta ni administra FiNeCi para contarlos. No cierra dispositivos, borra sesiones ni restablece frenos automáticamente. Después de vincular, volver a WA_CODIGOS_VINCULAR=false para cerrar la operación local. La reconexión conserva la sesión cifrada.

## Configuración y activación pendiente

No ejecutar esta lista sin las confirmaciones de migración, publicación, vinculación y primer envío real que corresponden. No renombrar infraestructura ni contratar otro plan. Supabase Send SMS Hook está disponible en Free; se conserva el proceso Railway y sus límites, con presupuesto compartido máximo 10 USD. El pronóstico 3–6 USD/mes del servicio con dos sesiones sigue siendo provisional, no una medición ni una garantía; el seguimiento semanal conserva la fecha inicial real del 27 de octubre.

1. Respaldar el estado actual y comparar cantidades/huellas. Conservar el UUID Admin ba386266-329f-4f39-b7a8-ac6eaafbb97f. No repetir la migración de agenda ya realizada ni editar usuarios a mano.
2. En una ventana coordinada de actualización, aplicar únicamente 20261028093000_login_whatsapp.sql, con aprobación. Agrega tickets, admisión de sesiones y almacenamiento de plataforma; el RLS de negocio no se abre. Sesiones presentes se conservan; nuevas sesiones necesitan la versión del proxy de esta etapa. La UI antigua no debe quedar publicada después de esta migración: si se revierte el Worker también se debe restaurar la función sesion_vigente anterior desde el archivo de migración original, conservando las tablas nuevas y todos los datos. No usar DROP de datos ni restablecer la base.
3. Guardar ACCESO_HMAC_KEY (32 bytes aleatorios en base64) en Cloudflare y Railway; usar la misma llave en ambos para las huellas. Nunca ponerla en Git ni en configuración pública. Conservar WA_SESSION_KEY existente exclusivamente en Railway. Rotar HMAC invalida tickets pendientes; rotar WA_SESSION_KEY sin recifrar deja las sesiones ilegibles.
4. Configurar Supabase → Authentication → Hooks → Send SMS → HTTP: https://agendappx-whatsapp-production.up.railway.app/hook/codigo. Copiar su secreto Standard Webhooks a Railway WA_CODIGOS_HOOK_SECRET; formato v1,whsec_…. No enviarlo al chat. Activar Phone OTP con longitud 6, caducidad 600 segundos, frecuencia mínima 60 segundos. Desactivar altas abiertas y SMS convencional; no introducir credenciales de un proveedor facturable. La configuración exacta del panel todavía requiere verificarse con acceso autorizado.
5. Railway: WA_NUMERO_CODIGOS=528661241483; inicialmente WA_CODIGOS_HABILITADOS=false y WA_CODIGOS_VINCULAR=false. Para la vinculación aprobada, guardar una llave aleatoria WA_CODIGOS_OPERACION_KEY y habilitar únicamente WA_CODIGOS_VINCULAR. Mantener citas WA_ENVIOS_HABILITADOS en su valor autorizado; esta etapa no autoriza los envíos del salón.
6. Cloudflare: ACCESO_WHATSAPP_HABILITADO=true solo con el proxy y la base coordinados. ACCESO_CORREO_HABILITADO=false hasta verificar SMTP real. Conservar Supabase URL, llave publicable, MIGRACION_USUARIO_ID y los salones autorizados. No añadir sb_secret/service_role al Worker ni al emisor.
7. Recuperación inicial del Admin: el enlace privado de operación debe estar registrado por SHA-256(token_hash) en ACCESO_RECUPERACION_HASH, además de MIGRACION_USUARIO_ID. Se verifica con Auth y solo admite ese UUID. El enlace se genera con la herramienta privada de administración fuera del servidor público; no hay endpoint de bootstrap con service_role. No admitir cualquier token_hash, que podría evitar los límites del flujo de teléfono. Su uso sigue siendo único por Supabase; retirar el hash de recuperación tras verificar el teléfono del propietario.
8. Con aprobación para vincular y espacio libre confirmado en el teléfono, vincular la sesión de plataforma mediante el comando local. No equivale a enviar un código real. Volver a WA_CODIGOS_VINCULAR=false al terminar.
9. Con aprobación separada para el primer envío, habilitar WA_CODIGOS_HABILITADOS y probar el código en el teléfono del propietario; vincular su teléfono a su identidad actual mediante phone_change, no crear otro usuario. Probar entrar, salir, MFA, correo cuando esté listo, y reinicio del contenedor. Medir memoria/costo y verificar salud. Si falla, conservar el acceso de recuperación autorizado y ofrecer correo cuando exista SMTP.

## Verificaciones

193 pruebas automáticas aprobadas. Incluyen sección 10 de CUENTAS.md (RLS entre negocios, Especialista, teléfonos ocultos, Recepción, revocación, invitaciones, Admin aal2, bitácora), regresiones de citas/anticipos y trece pruebas nuevas de teléfono, firma, duplicados, cinco intentos, caducidad, límites, incertidumbre, bloqueo, admisión de sesión, permisos mínimos, persistencia cifrada, prioridad, concurrencia y rutas públicas.

Navegador local con SDK real, JWT firmado local y PostgreSQL con RLS: WhatsApp, correo de respaldo simulado, Admin MFA, Recepción sin MFA, phone_change sin cambiar UUID, recuperación registrada, alternativa por correo al pasar veinte segundos, White/Dark y anchos 390/768/1440 sin desbordamiento. Capturas en imagenes/login-whatsapp/. Regresión de WhatsApp en navegador: configuración, pago único, foto, roles y ambos temas. Cloudflare compila en dry-run; no hubo despliegue ni uso de cuentas reales. Baileys utiliza socket simulado en estas pruebas: falta la entrega física y la persistencia real después de vincular, que requieren las autorizaciones indicadas.

Comandos reproducibles:

    npm test --prefix ritmo/servidor
    node ritmo/servidor/pruebas/login-whatsapp-navegador.mjs
    node ritmo/servidor/pruebas/whatsapp-solo-envios-navegador.mjs
    npm run build --prefix ritmo/nube

Referencias verificadas: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook y https://supabase.com/docs/guides/auth/auth-hooks (HTTP hooks: cinco segundos; Send SMS en Free). El adaptador cubre el payload documentado y sms.phone del código actual de Supabase Auth.
