# Implementación de cuentas de Agendappx

Rama: `codex/agendappx-cuentas-equipo`. Base funcional publicada: `codex/pwa-backend-belleza`.
Especificación aprobada: `CUENTAS.md`, incluida la sección 1b y el prototipo de Claude del commit `2377c67`.

## Confirmaciones de Antonio

- Admin inicial: `antonio.t.22@hotmail.com` (la asignación se hará mediante el procedimiento de migración aprobado, nunca por comparación de correo en el cliente).
- No tiene dominio propio. No comprar dominios ni renombrar infraestructura.
- Antes de migrar datos y antes de desplegar, pedir confirmación por separado.
- Conservar diseño 3D, navegación, White/Dark, fotos, sincronización y funcionamiento sin conexión.

## Estado de esta primera etapa

Se incorpora el prototipo aprobado y una base de autorización de servidor con pruebas unitarias de roles, segundo factor, membresía vigente y separación de salones. **Todavía no está conectada a las rutas de producción**. No es una implementación completa de cuentas, ni acredita las pruebas RLS de la sección 10. La página publicada sigue con su funcionamiento anterior. Validación local: `npm test --prefix ritmo/servidor`, 91 pruebas aprobadas (incluidas cinco nuevas de permisos).

Pendiente: validación JWT/JWKS y sesiones; esquema y pruebas RLS reales; OTP y registro; MFA y recuperación; invitaciones atómicas; proyecciones de teléfonos e ingresos; bienvenida y perfil público; disponibilidad y reservas; separación de cachés por cuenta; historial; calendario privado; respaldo cifrado y restauración. Ejecutar todas las pruebas de la sección 10 antes de considerar terminada la implementación.

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
- Los límites avanzados de inactividad no se asumen incluidos en Supabase Free; aplicar los 30 días desde el servidor de la app.
- R2 tiene cuota gratuita y cargos por exceso. No está activado para esta etapa; preparar respaldo/retención/restauración sin contratar recursos facturables. El presupuesto previo de Railway no autoriza cargos R2.
- No mezclar caché y cola de la agenda heredada con cuentas nuevas ni subirla automáticamente a otro salón.
