# Registro automático por WhatsApp — preparación del 29 de octubre de 2026

Estado: implementación local, sin migrar ni publicar. Antonio pidió terminar el registro automático y confirmó incluir también a las dueñas de salones nuevos. El modo manual de copiar/entregar códigos no se implementa ni es necesario para este recorrido. El enlace de recuperación del propietario se conserva como salida de emergencia hasta tener un respaldo operativo.

## Recorridos

- Cuenta existente: WhatsApp mexicano → código automático de seis dígitos → verificar → MFA si es Admin → agenda. Código: diez minutos, cinco intentos; tres solicitudes por teléfono/15 min, diez por IP/h. No se crea una cuenta por intentar iniciar sesión.
- Salón nuevo: abrir `/#registro` o Crear mi cuenta y mi salón dentro del acceso. Nombre de la dueña, WhatsApp, salón, identificador corto y consentimiento específico de códigos. Turnstile obligatorio. El servidor prepara la cuenta sin confirmar el teléfono; el código verifica ese WhatsApp; Admin completa TOTP antes de crear el salón. La agenda empieza vacía, únicamente con sus ajustes de nombre/tema/horario. No copia agenda, clientas ni promociones de Antonio.
- Equipo: Admin con MFA crea en su propio acceso un enlace con nombre y rol. La persona abre el enlace privado, registra su propio WhatsApp, verifica el código y completa MFA si la invitación es Admin. El servidor la incorpora exclusivamente al salón y rol de la invitación. Vence en 48 horas, un solo uso y revocable. Una cuenta que ya pertenece a otro salón conserva su identidad y necesita verificar el número y los requisitos del rol nuevo.
- Cada cuenta puede seleccionar entre sus salones autorizados. Sincronización, fotos, calendario privado y uso sin conexión conservan su separación por identidad/salón/rol/MFA. Las administradoras comparten servicios y promociones del mismo salón. Quitar acceso bloquea la siguiente petición por RLS, sin borrar datos.

El identificador de salón queda reservado para su perfil futuro: este cambio NO publica todavía un catálogo para clientas ni una página de reservas. Las invitaciones admiten los roles existentes; la edición completa de servicios/horarios del equipo, notificaciones push y códigos de recuperación MFA pertenecen a etapas separadas de CUENTAS.md.

## Seguridad y servicios

El registro abierto de Supabase permanece **cerrado**. No se requieren sesiones anónimas. Worker/Railway/navegador conservan exclusivamente sus credenciales limitadas; no reciben una llave Admin. Una función aislada en el mismo proyecto Supabase, `agendappx-registro`, utiliza la API Admin oficial para preparar un teléfono sin confirmarlo ni cambiar cuentas existentes. Acepta solo teléfono e identificador, con HMAC de propósito fijo y antigüedad máxima de un minuto; no acepta roles, contraseñas, texto libre ni enlaces de recuperación. Ni la función ni el proceso registran teléfonos, cuerpos de peticiones o códigos en logs.

El Worker valida Turnstile, hostname y acción `registro`, consentimiento y límites durables: tres registros/IP/día, cien globales/día. Los tickets de registro duran treinta minutos, se guardan como huellas HMAC, y se ligan al teléfono confirmado, usuario y sesión admitida mediante el proxy. No hay membresía antes de OTP/MFA. Una invitación se revisa nuevamente al consumirse; revocarla después del código también impide entrar.

`ritmo.mis_negocios()` solo enumera membresías propias para sesiones admitidas; conocer un identificador de negocio no da acceso a su agenda. Las funciones privilegiadas viven en el esquema privado, fijan search_path, verifican sesión y no se conceden a anon/authenticated/mensajero. Las tablas nuevas tienen RLS forzado. Las pruebas ejecutan operaciones con el rol no propietario `ritmo_api`, sin BYPASSRLS.

Railway añade el modo explícito `WA_CODIGOS_MODO=cuentas`. El predeterminado sigue siendo `prueba`, que conserva las restricciones de la prueba anterior. El modo normal permite códigos solicitados por personas y mantiene apagados citas, promociones y vinculación de nuevos dispositivos. Freno global de códigos: treinta por hora y ciento cincuenta en veinticuatro horas, persistente tras reinicios e independiente de recordatorios. No reintenta envíos inciertos. Solo resuelve el destinatario que solicita el código; acepta el JID telefónico 52/521 de esa misma línea, nunca otro número o un LID; no sincroniza ni almacena contactos ni mensajes entrantes.

Correo de respaldo sigue apagado a petición de Antonio, aunque Brevo ya validó la cuenta. La interfaz no ofrece enviarlo hasta configurarlo.

## Configuración pendiente, después de aprobar publicación y migración

1. Confirmar Supabase Free y Railway dentro del presupuesto compartido vigente de 10 USD; no activar planes, réplicas, dominios ni recursos nuevos. Respaldar agenda, cuentas y configuración privada; comparar cantidades/huellas antes y después. La migración es aditiva: no vuelve a asignar los datos heredados ni modifica el propietario.
2. Crear o reutilizar exclusivamente un widget Turnstile gratuito para el hostname actual. La autorización anterior de Wrangler no incluía `challenge-widgets.write`; verificar el permiso y pedir la intervención concreta si sigue faltando. No alterar widgets de otros proyectos. `TURNSTILE_SITE_KEY` es pública; `TURNSTILE_SECRET_KEY` va solo en el Worker. No activar registro sin validación real del CAPTCHA.
3. Generar `REGISTRO_OPERACION_KEY` de 32 bytes en base64, fuera de Git/chat. Guardar la misma llave solo en Cloudflare y la función de Supabase. La llave Admin de la función es la credencial interna proporcionada por Supabase; no copiar la llave local del operador a Worker ni mensajero.
4. Aplicar únicamente la migración local `20261029174619_registro_whatsapp.sql` tras respaldo y confirmación. Agrega registro_solicitudes, negocios_enlaces y dos funciones; conserva las tablas existentes. Ejecutar asesores de seguridad y comprobar grants de las funciones.
5. Publicar `supabase/functions/agendappx-registro` en el proyecto dedicado. `verify_jwt=false` porque esta ruta interna se autentica mediante HMAC propio, obligatorio y comprobado antes de usar Auth Admin. Mantener Allow new users to sign up apagado. No tocar el Send SMS Hook que ya entrega por WhatsApp.
6. Publicar Railway con `WA_CODIGOS_MODO=cuentas`, inicialmente `WA_CODIGOS_HABILITADOS=false`; conservar otras tres banderas false, misma sesión, llave de cifrado, réplica y límites. No generar otro código de dispositivo ni volver a vincular el número. El proceso mantiene la sesión cifrada existente aunque los envíos estén apagados.
7. Preparar assets con la PWA nueva **y Comunidad sin cambios**, igual que en la publicación del 29 de octubre. El deploy normal de nube no incluye Comunidad: no ejecutarlo como publicación final. Usar el staging combinado, comparar hashes y publicar con --keep-vars. No cargar el archivo viejo de secretos ni sobrescribir la recuperación vigente. Añadir `AGENDAPPX_REGISTRO_HABILITADO=true` solo con migración, intermediario y Turnstile listos. Conservar ACCESO_CORREO_HABILITADO=false.
8. Habilitar códigos normales únicamente dentro del alcance expresamente autorizado. La primera comprobación real de inicio de sesión la solicita Antonio desde otra ventana/dispositivo y escribe el OTP/MFA solo en la app; no pedirlos ni leerlos en chat. La invitada acepta su propio enlace y solicita su código. No enviar una prueba a números ajenos desde herramientas.
9. Verificar salud, hashes y privacidad pública; registro completo, login tras salir, renovación y reapertura; compartir una promoción en el mismo salón y rechazar otro negocio. Conservar el inicio del servicio del 27 de octubre para el informe semanal. Para revertir: apagar registro y códigos, conservar datos/credenciales; volver a los archivos anteriores sin borrar las tablas nuevas ni los negocios creados.

## Costos y límites

Sin compra de dominio ni SMS/Meta. Turnstile gratuito y la función del proyecto Supabase Free, cuya cuota publicada es de 500 000 invocaciones, sin tarifa de exceso en ese plan. El intermediario solo se llama para preparar el registro; no mantiene un contenedor ni crea otra base. No se convierte a Pro. Railway reutiliza un proceso permanente y una sesión: no se crea un servicio por salón al registrarlo. Su consumo continúa siendo variable dentro del presupuesto compartido autorizado, sin prometer costo mensual fijo ni confundir uso con factura mínima Hobby. Consultar el consumo/proyección antes de activar; el informe semanal existente no se reinicia.

Referencias: https://supabase.com/docs/reference/javascript/auth-admin-createuser, https://supabase.com/docs/guides/functions/pricing y https://developers.cloudflare.com/turnstile/plans/.

## Resultado local

221 pruebas automáticas aprobadas, cero fallos. Registro y acceso anterior pasaron en navegador con SDK real y proveedores simulados; White/Dark a 390/768/1440. Compilación de TypeScript y dry-run de Cloudflare correctos. El staging combinado conserva Comunidad: index.html, app.mjs y estilos.css coinciden por SHA-256 con los archivos públicos. Staging local ignorado por Git: nube/build/registro-whatsapp-revision/assets; manifiesto de hashes en preparacion.json. Ningún despliegue, migración ni código real se ejecutó durante esta preparación.

## Verificación reproducible

`npm test --prefix ritmo/servidor`, `npm run test:registro --prefix ritmo/servidor`, `node ritmo/servidor/pruebas/login-whatsapp-navegador.mjs`, `npm run build --prefix ritmo/nube` (solo dry-run).

Las pruebas de navegador utilizan SDK real y PostgreSQL local con RLS; Auth, Turnstile y entrega WhatsApp están simulados. No son una prueba física de registro nuevo en producción. Incluyen White/Dark a 390/768/1440, dos números/identidades, salón vacío, Admin MFA, invitación al mismo salón y acceso existente. Pruebas automáticas cubren alteración de firmas, límites, caducidad, consentimiento, número ajeno, sesión no admitida, invitación revocada, carrera de slug sin registros huérfanos, aislamiento, promociones compartidas y revocación inmediata.

Capturas locales revisadas: imagenes/registro-whatsapp/. Producción permanece en la versión anterior, sin migración ni mensajes nuevos. La publicación y la primera prueba real siguen pendientes de aprobación específica.
