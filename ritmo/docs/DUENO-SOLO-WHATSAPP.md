# Dueño: acceso solo con código de WhatsApp

Antonio indicó el 30 de octubre de 2026: «No necesito ningún código qr, todo será mediante códigos de whats app», mientras entraba a su panel y aparecía un error al generar el QR de la autenticadora. Para su acceso de dueño, esta instrucción sustituye la exigencia anterior de TOTP/MFA. El flujo preparado es **WhatsApp → código de seis dígitos → Panel de Agendappx**, sin salón ni plan.

## Estado

**Migrado y publicado el 30 de octubre de 2026**, con confirmación expresa de Antonio. Rama `codex/agendappx-dueno-solo-whatsapp`, PR #22, desde el cierre del PR #21. Código de aplicación **b158896**; Worker **0984ce8b-a525-497c-b1b0-7a9875f5da51**, `--keep-vars`. No se solicitaron códigos reales durante las verificaciones.

El alcance es el dueño de la plataforma y su moderación de Comunidad. Los flujos de registro y acceso del equipo y otras administradoras conservan sus reglas existentes. No se desactiva MFA globalmente en Supabase ni se eliminan factores. En la consulta real del dueño no había factores verificados; se encontraron tres sesiones ligadas a códigos de WhatsApp ya usados.

## Permiso en la base de datos

Migración aditiva **20261030214547_dueno_solo_whatsapp.sql**, creada con Supabase CLI 2.122.0:

- Conserva exactamente la lista de `plataforma_admins`; no agrega propietarios ni acepta roles por formulario o metadatos.
- Exige identidad firmada coincidente, sesión admitida vigente y teléfono confirmado en Auth.
- Para acreditar por primera vez esa sesión, exige su `solicitud_otp` ligada por el intermediario: mismo usuario, canal WhatsApp, tipo `sms`, estado `usado` y huella de código existente. Un teléfono confirmado o un JWT AAL1 no bastan. Tampoco bastan contraseña, correo, enlace privado o AAL2 sin esa prueba.
- Guarda `plataforma_whatsapp_en` en la misma sesión admitida. Es una marca de comprobación, no un OTP ni una modificación de los claims de Supabase. Permite conservar la sesión cuando el depurador elimina solicitudes antiguas de más de 24 horas; continúan las reglas de expiración, revocación e inactividad existentes.
- El rol de la API solo puede insertar las columnas habituales de admisión; no puede insertar o actualizar directamente esa marca. La función interna con `search_path` fijo hace la comprobación y la escritura. No se amplían permisos a `anon` ni `authenticated`.
- La moderación del dueño utiliza la misma prueba. Los moderadores ajenos al dueño conservan la regla previa de MFA y su inscripción explícita.

La API sigue comprobando el permiso en cada operación de lectura, gestión de salones y códigos manuales. No se concede acceso a las agendas de otros salones.

## Cliente y Worker

El acceso de plataforma se resuelve antes del flujo de MFA y no llama a enroll/challenge/verify de factores. No muestra QR ni clave manual. `sesionPlataforma()` consulta el permiso real del servidor y devuelve el token sin inventar AAL2. El token del recorrido de prueba permanece en **AAL1**.

El Worker liga cada login OTP admitido a su solicitud incluso si se cierra temporalmente el registro de salones. Esta marca no abre altas, no evita CAPTCHA, no cambia los límites y no repite envíos inciertos. La vinculación de números y las contraseñas del equipo mantienen sus reglas.

## Respaldo y publicación

Respaldo privado de las definiciones actuales de `es_admin_plataforma` y `es_moderador_social`, sus permisos, columnas e inventario: **1826 bytes**, SHA-256 **a296cbc9733c2cd61e9f262509aca2d1b5a6e99310de8b89a2267ebd9e23d862**. Archivo `respaldo-dueno-solo-whatsapp-20261030.json`, fuera de Git. No contiene códigos, contraseñas ni secretos de integración.

Antonio confirmó «Sí» a aplicar los permisos y publicar. Se verificaron otra vez el SHA-256 del respaldo y las funciones originales antes de aplicar. Supabase registró la migración como **20261030220441 / dueno_solo_whatsapp_aprobado_20261030**; el archivo local se llama `20261030214547_dueno_solo_whatsapp.sql`. **No repetirla por la diferencia de versión/nombre.** La función comprueba la prueba OTP; un único propietario conservado; API puede insertar las columnas normales de admisión pero no la marca; `anon` y `authenticated` no pueden ejecutar directamente las funciones privadas.

Después se publicó el Worker con las variables existentes. Comprobación pública en Edge a las **22:05:55 UTC**: salud 200; API del panel anónima 401; seis estáticos coincidentes por SHA-256; entrada del dueño White/Dark 390 con instrucciones de WhatsApp y sin autenticadora/QR visible; Comunidad y registro normal conservados, sin errores JavaScript. No se solicitaron OTP, crearon cuentas, cambiaron servicios o recursos ni modificaron Railway/FiNeCi. La prueba física de Antonio continúa pendiente.

Advisors de seguridad consultados después de la migración: avisos informativos de RLS sin políticas en tablas privadas diseñadas para acceso por funciones; no se abrieron políticas de lectura. También permanece el aviso de [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) desactivada; este cambio no modifica ese ajuste ni activa planes. No se añadieron tablas públicas ni permisos a roles del navegador.

La limpieza antigua de intentos continúa pendiente por confirmaciones caducadas de Supabase. **No ejecutar el plan viejo de revocar todas las sesiones**: ahora hay códigos reales verificados posteriores al respaldo antiguo. Si se retoma la limpieza, limitarla a los registros vencidos y conservar las sesiones actuales del dueño. Esta migración no borra cuentas, registros ni datos.

## Comprobaciones locales

- Suite completa: 287 pruebas (incluye siete casos de la nueva política).
- `dueno-whatsapp.test.mjs`: dueño AAL1 con prueba OTP propia, rechazo de sesiones de otro origen incluso AAL2, canales/tipos/estados ajenos, otra Admin, permisos de columna, revocación inmediata y conservación al depurar el OTP. También verifica admisión con la API real de acceso cuando el registro público está cerrado.
- `dueno-navegador.mjs`: SDK real y RLS local, código ficticio y panel sin ninguna llamada MFA, JWT AAL1 real, recarga después de eliminar la solicitud OTP, sin crear salón ni perfil social; salida, White/Dark 390 y 320/768/1440.
- `plataforma-navegador.mjs`: acciones y códigos manuales sobre salones ficticios; otras cuentas bloqueadas.
- `contrasenas-navegador.mjs`: registro, contraseña, recuperación y equipo sin cambios.
- Capturas locales en `imagenes/acceso-dueno/`; `02-codigo-whatsapp.png` reemplaza como referencia vigente la captura histórica de dos pasos.

La preparación no tocó producción. La publicación autorizada posterior solo aplicó la migración descrita y actualizó Cloudflare; no borró cuentas o datos ni modificó factores MFA, la configuración global de Auth o la conexión de WhatsApp.
