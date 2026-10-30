# Reinicio de Agendappx solicitado por Antonio

Antonio autorizó el 30 de octubre de 2026 eliminar las cuentas y empezar desde cero, siendo él el primer registro y dueño de la aplicación. Confirmó en privado el WhatsApp que usará. No guardar su número nuevo, credenciales ni datos personales en Git.

## Estado

**Reinicio ejecutado y verificado el 30 de octubre de 2026**, por autorización expresa de Antonio. Cuenta anterior eliminada y nueva identidad de dueño reservada. Cloudflare y Railway publicados; ver el cierre de `PANEL-PLATAFORMA.md`. Falta que Antonio complete físicamente su registro y MFA.

## Alcance y protecciones

- El destino es únicamente el proyecto Supabase dedicado `zkqwephmuflbuagevvxj`, esquema `ritmo` y sus cuentas Auth. No tocar FiNeCi ni infraestructura.
- Respaldo privado verificado: `respaldo-panel-reinicio-20261030.json`, 232755 bytes; SHA-256 `0331db15d554757fbf8e018d0aade25a045a8fe81b72f40e5925f12acf870ae2`. Contiene 43 tablas y un inventario de cuenta sin contraseñas, MFA ni sesiones. Las 43 huellas continuaron idénticas tras ambas migraciones. Los secretos de integración, tokens de calendario y sesiones cifradas de WhatsApp no se exportaron; este respaldo no restaura credenciales de cuentas eliminadas.
- `herramientas/reinicio-datos.sql` exige la huella del respaldo y los UUID esperados de Auth. Rechaza cuentas o tablas aparecidas desde la revisión y usa una lista explícita con `RESTRICT`, sin propagarse a otros esquemas.
- El SQL vacía salones, agendas, clientas, servicios, fotos, promociones, publicaciones, invitaciones y accesos anteriores. Reinicia el contador de fundadoras. Conserva `plataforma_conexiones`, `plataforma_sesiones` y `plataforma_alertas`, para que siga funcionando el WhatsApp de códigos.
- La eliminación de Auth se realiza después mediante su API Admin, comprobando primero que ya no queden referencias del salón ni sesiones de acceso admitidas. No exportar ni restaurar hashes de contraseñas o MFA.

## Reserva del dueño y primer registro

Tras eliminar la cuenta antigua, preparar en Auth una identidad **sin contraseña ni teléfono confirmado**, con el número elegido por Antonio, y registrar su nuevo UUID en `plataforma_admins` y `social_moderadores`. Es una reserva operativa de identidad: no crea salón, no verifica teléfonos, no crea sesiones y no completa el registro por la persona. Solo el UUID reservado recibe el panel; nunca se concede propiedad al primer usuario arbitrario, por un campo de formulario ni por `user_metadata`.

Antonio abre `/#registro`, elige usuario/contraseña, verifica su WhatsApp y configura los dos pasos en su propio dispositivo. El registro normal publicado crea entonces su salón vacío. La identidad reservada no tiene acceso a datos sin una sesión admitida y MFA. Los demás registros son dueñas de su propio salón y aparecen en el panel, sin privilegios de plataforma.

La cuenta y sus factores antiguos quedan eliminados; su enlace de recuperación no debe reutilizarse. El UUID nuevo consta en el registro privado de operación. No convertirlo en `MIGRACION_USUARIO_ID`: ese valor histórico habilita recuperar caché heredada, que no se debe ofrecer a la cuenta que empieza de cero. El identificador y enlace antiguos no conceden acceso: su usuario Auth fue eliminado. No guardar el número ni la respuesta completa de Auth en el repositorio.

## Verificaciones de la operación

1. Confirmación y publicación de Railway completadas con el respaldo manual, sin activar citas, promociones o vinculaciones nuevas; una réplica y límites/presupuesto existentes.
2. WhatsApp de códigos conectado antes y después del reinicio y la actualización. Su sesión cifrada no fue borrada.
3. Reinicio ejecutado; cuenta anterior eliminada y reserva nueva verificada. Cero salones, miembros, objetos, perfiles, solicitudes de registro y usuarios de acceso; un único UUID reservado de dueño/moderador, sin teléfono confirmado, sesión Auth, MFA ni salón. Una identidad Auth sin confirmar es necesaria para reservar ese UUID; no equivale a haber completado el registro por Antonio.
4. Antonio completa físicamente su primer registro. Verificar que ve Mi negocio → Panel de Agendappx después de MFA y que otras dueñas no lo ven.
5. Solo con permiso separado, probar desconexión deliberada, aviso PWA y entrega manual real del OTP. Apagar `WA_CODIGOS_RESPALDO_MANUAL` si Supabase no conserva el código al aceptar el hook.

## Pruebas locales del reinicio

`node --test pruebas/reinicio-datos.test.mjs`: dos pruebas aprobadas. Comprueban vaciado, conservación exacta de la conexión de códigos y su sesión, datos ajenos intactos y rechazo atómico si aparece una cuenta no revisada. El entorno de pruebas incluye las columnas de Auth necesarias para las migraciones de contraseña; no se modificó código de aplicación para facilitar estas pruebas.

Suite final `npm test`: **268/268**. Los archivos de operación completos permanecen en la carpeta privada de Agendappx, fuera de Git: `respaldo-panel-reinicio-20261030.json` y `reinicio-propietario-20261030.json`. No ejecutar el reinicio de nuevo para una actualización normal.
