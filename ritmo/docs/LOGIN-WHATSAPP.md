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


## Publicación autorizada y verificada — 28 de octubre de 2026

Antonio respondió «sí autorizo» a respaldar, aplicar cambios de acceso en Supabase y publicar en Cloudflare/Railway. Se ejecutó el alcance aprobado desde 9e3c0e8, PR #7. No extiende la autorización a vincular números ni al primer código real.

Respaldo privado previo de 21 tablas: SHA-256 96e6767b607fb85817cc1787096724ae376a801b815c2c5dd1ecdaf4c801c17d, archivo local fuera de Git. Comparación de huellas antes/después: las 21 tablas originales idénticas, 23 objetos, 42 mutaciones; la única cuenta Admin conserva UUID y membresía. Migración login_whatsapp_aprobado_20261028 aplicada; cinco tablas nuevas con RLS forzado y sin SELECT para anon/authenticated. Los asesores no mostraron avisos nuevos: persisten los dos INFO de tablas internas anteriores y el aviso de protección de contraseñas del proyecto, cuyo acceso es sin contraseña.

Worker 0679a8c3-eb04-483a-ad3b-410356aaeb6b publicado en la misma URL. Railway b63a5b0a-e9dd-443b-a87f-4feff1dfc80c SUCCESS: servicio existente, una réplica, máximo 0.5 GB/0.1 vCPU, sin nuevos planes ni recursos. Se conservó la fecha original de inicio 2026-10-27T19:11:09.551883275Z para el informe semanal; este despliegue no reinicia el contador. Consumo compartido consultado: 1.3659 USD, proyección 2.4293 USD para el ciclo, límite 10 USD y aviso 5 USD intactos.

Claves HMAC y Standard Webhooks guardadas fuera de Git, iguales donde corresponden. Clave Admin únicamente en la operación local oficial de Supabase; no se cargó al Worker ni Railway. El enlace de recuperación corresponde al mismo Admin y su huella está registrada en el Worker; no se consumió como prueba. Archivo privado local ACCESO-AGENDAPPX-LOGIN.md.

Verificación publicada: /, /salud y configuración 200; agenda anónima 401; tres rutas de acceso rechazan entradas inválidas con 400 antes de pedir códigos. cuentas.js, belleza.js y sw.js coinciden por SHA-256 con los archivos aprobados. Railway /salud 200. Navegador aislado a 390 px abrió Ajustes → Sincronización → Iniciar sesión, mostró teléfono y botón de código, sin errores ni desbordamiento. Captura imagenes/login-whatsapp/publicado-390.png. No se inició sesión del propietario ni se pidió código.

Estado real: pantalla y soporte publicados; acceso por WhatsApp TODAVÍA NO OPERATIVO. Supabase informa external.phone=false y el hook no se configuró. Las altas públicas siguen en el valor previo del proveedor y deben cerrarse al configurar teléfono; el proxy ya usa create_user:false y la base rechaza sesiones nuevas no admitidas. El conector disponible no administra esta configuración y el navegador devolvió «Local browser use is disabled in Work settings». Se pidió a Antonio habilitar el uso del navegador mientras se completaba la publicación; no intentar acceder al panel mediante otro mecanismo que eluda ese ajuste.

ACCESO_WHATSAPP_HABILITADO=true muestra la pantalla; ACCESO_CORREO_HABILITADO=false por Brevo pendiente. En Railway WA_CODIGOS_HABILITADOS=false, WA_CODIGOS_VINCULAR=false, WA_ENVIOS_HABILITADOS=false y WA_VINCULACION_HABILITADA=false, comprobadas por lectura; cero sesiones de salón/plataforma y cero envíos reales. Siguiente paso: acceso al panel para Phone OTP/Send SMS Hook y cierre de altas abiertas; luego pedir confirmación para vincular 528661241483 como dispositivo independiente y, por separado, para el primer código físico. No afirmar que el celular ya recibe códigos.


## Panel accesible y registro cerrado — 28 de octubre de 2026

Antonio mostró el permiso de navegador habilitado y se confirmó acceso al panel del proyecto correcto. Se apagó y guardó Allow new users to sign up; se conservaron Confirm email activo, manual linking y anonymous sign-ins apagados. Lectura oficial /auth/v1/settings confirmó disable_signup=true, external.phone=false.

Se dejó preparado Auth Hooks → Add Send SMS hook → HTTPS, URL del endpoint /hook/codigo del Railway existente. La clave NO se introdujo y no se pulsó Create hook: el control del navegador exige intervención humana antes de introducir una credencial nueva. La clave ya existente de Railway está en el archivo privado local CLAVE-HOOK-SUPABASE.txt, fuera de Git y sin imprimir su valor. El usuario debe copiarla en Secret y pulsar Create hook; después continuar con Phone provider, OTP de seis dígitos y 600 segundos, con confirmación de teléfono activa. El formulario quedó abierto para ese paso.

No se vinculó el número, no se generó código real ni se activaron envíos. Tampoco se cambiaron claves, planes o infraestructura. El bloqueo anterior del navegador está resuelto; queda el pegado humano de la clave y, después, la activación de teléfono y las confirmaciones separadas de vinculación/primer envío.


Antonio confirmó «listo» después de pegar Secret y Create hook. Ese guardado se considera informado por el propietario, todavía no verificado en el panel: el control del navegador volvió a responder Local browser use is disabled in Work settings. Lectura de Auth settings confirmó teléfono apagado y registro público cerrado. Se abrió el enlace directo del proveedor Phone para activar acceso, conservar confirmación, OTP seis dígitos y caducidad 600 segundos. No pedir un OTP de producción para verificar el hook antes de autorizar el primer envío.


## Phone habilitado — 28 de octubre de 2026

Antonio confirmó «okey, listo» al guardar Phone. La lectura oficial de /auth/v1/settings confirmó external.phone=true y disable_signup=true. Hook guardado informado antes por el propietario; no se solicitó OTP real para probarlo. Siguiente paso: pedir confirmación explícita para vincular la sesión independiente del 528661241483 y confirmar que hay un espacio de dispositivo libre en su teléfono. El primer código real conserva su confirmación separada. No activar WA_CODIGOS_HABILITADOS ni enviar como prueba todavía.


## Operación de vinculación preparada; confirmación exacta pendiente

Antonio confirmó espacio libre con captura de un solo dispositivo vinculado. Se habilitó únicamente WA_CODIGOS_VINCULAR=true en el servicio existente; los códigos reales, citas y vinculación de salones siguen apagados. Actualización de Railway cc818d4c-42bc-44b2-a938-56658cfdc78a. Se creó y registró la llave SSH temporal agendappx-operacion-temporal para ejecutar el comando local dentro de ese contenedor; claves privadas fuera de Git. Retirar el registro temporal al completar la operación.

La revisión automática rechazó ejecutar operar-codigos.mjs codigo: interpretó Sí hay espacio como capacidad disponible y no autorización inequívoca de vincular ahora. No se generó código ni se abrió la conexión de WhatsApp por esa acción. Se pidió confirmación explícita de generar ahora el código para 866 124 1483, con riesgo de bloqueo y conservando FiNeCi/envíos apagados. No eludir el rechazo ni repetir la acción hasta recibir respuesta.


## Reparación de preparación de vinculación — 28 de octubre de 2026

Antonio autorizó explícitamente generar el código de vinculación y confirmó espacio disponible. Primer intento generado en la instancia nueva 5ac13807-18e7-4f21-917c-446eeeaead05 del despliegue cc818d4c-42bc-44b2-a938-56658cfdc78a. WhatsApp rechazó el intento: la conexión se cerró a los pocos segundos con estado requiere_vincular y motivo sesion_cerrada, sin llegar a conectado. No guardar el código de vinculación en Git ni emitir mensajes de prueba.

Se encontraron dos defectos reproducibles en el conector: codigo() aceptaba ws abierto o connection=connecting antes del saludo de registro; requestPairingCode modifica creds.me, que Baileys usa para decidir entre registro y login. Además, la revisión cada minuto restaurar() detenía una conexión pendiente no registrada. La reparación espera exclusivamente la señal QR del protocolo (sin guardar ni mostrar QR), conserva el intento activo al revisarlo, rechaza esperas al cerrar y quita solo me/pairingCode provisionales en memoria si todavía no hay registered ni account. No reinicia claves Signal/noise ni sesiones registradas, no borra cifrados y distingue vinculacion_rechazada de una sesión real cerrada.

196 pruebas aprobadas, incluidas tres regresiones nuevas: no pedir código con ws abierto/connecting; conservar intento en revisión y volver a registrar tras un rechazo; cancelar espera si la preparación se cierra. Pruebas de plataforma y sesión cifrada conservadas. La prueba física continúa pendiente; no afirmar que resolverá todos los rechazos de WhatsApp hasta verificar open y credenciales guardadas.

Antonio confirmó «Sí, publica la reparación y genera otro código» a la solicitud específica. Autoriza publicar solo esta reparación en el Railway existente y otro intento de vinculación del 866 124 1483. Códigos de acceso, citas y vinculación de salones siguen apagados; primer mensaje real necesita confirmación separada. No modificar FiNeCi ni aumentar recursos.


## Compatibilidad comprobada tras publicar la reparación

El despliegue a6b8ba24-f8a1-4d5b-a811-3fe55830fac1 arrancó el 28 de octubre a las 18:05 UTC. El segundo intento se cerró durante la preparación y no devolvió otro código. Una comprobación pasiva, sin vincular ni enviar, reprodujo error 405 con la versión incluida en Baileys [2,3000,1035194821]; el mismo saludo llegó a la señal de registro preparado al consultar la versión web actual [2,3000,1052053390]. Las credenciales siguen sin registered ni account, y la fila cifrada se conserva.

La reparación ahora consulta la versión pública con el helper del SDK, plazo de seis segundos y caché compartida de una hora. Rechaza una respuesta de respaldo o inválida, libera la custodia si falla y no cambia una conexión ya abierta. No cambia la versión de Baileys, claves, recursos, límites ni políticas de mensajes. Pasaron 198 pruebas, incluidas caché concurrente, rechazo del respaldo, recuperación tras fallo y entrega de versión comprobada al saludo. La aprobación de Antonio para publicar la reparación y generar otro código sigue siendo el alcance vigente; el resultado físico aún está pendiente y los envíos reales siguen apagados.

Aplicación de compatibilidad: commit 7bb1128; despliegue 41bd9daa-8129-405b-946c-4e1e0f0590f3 iniciado con autorización vigente. Las dos comprobaciones de navegador de WhatsApp también pasaron: SDK real, Admin/MFA/RLS, foto, pago único y White/Dark a 390/768/1440, en entorno aislado sin teléfono ni mensajes. El arranque nuevo, el código posterior y la vinculación física deben comprobarse por separado.
