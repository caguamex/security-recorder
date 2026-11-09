# Acceso del dueño sin crear un salón

**Cambio posterior publicado:** el dueño ya entra solo con códigos de WhatsApp, sin QR ni autenticadora. Migración y Worker autorizados y verificados; consultar `DUENO-SOLO-WHATSAPP.md`. Las referencias a MFA de este documento describen la versión publicada anterior.

Antonio pidió el 30 de octubre de 2026 limpiar su intento vencido y tener una entrada independiente para administrar Agendappx: no debe completar los datos de un negocio ni elegir un plan. Esa instrucción sustituye para el dueño el flujo anterior que le hacía crear un salón. Los registros de otras dueñas y del equipo no cambian.

## Preparación

Rama `codex/agendappx-acceso-dueno`, desde el cierre del PR #20. Entrada directa prevista: **`/plataforma/`**. El acceso es por WhatsApp y MFA; no se anuncia como registro de salón ni se monta ese formulario. Después abre directamente las cifras, los salones y la salud de la plataforma. No tiene negocio, plan, prueba gratuita ni membresía ficticios.

`sesionPlataforma()` obtiene la sesión Auth y consulta `/api/plataforma/yo` con el JWT; la API y la función SQL existentes vuelven a exigir el UUID reservado en `plataforma_admins`, sesión admitida vigente y AAL2. No se usa una URL secreta ni metadatos editables para conceder propiedad. Otra Admin de salón continúa bloqueada, aunque tenga MFA. No se incluye el teléfono real del dueño en HTML o JavaScript.

El panel monta su acceso dentro de su propia página. Al verificar MFA pasa al panel sin ir a la agenda de un salón. Al salir elimina la vista y la ficha abierta; una respuesta vieja no puede volver a pintar los datos. Las consultas de la plataforma y las del negocio siguen separadas. Los avisos opcionales del dueño usan una suscripción personal ya admitida por el esquema, sin crear un perfil social o salón, y la lista de destinatarios de avisos manuales sigue limitada a `plataforma_admins`.

No se añaden rutas privilegiadas, funciones SQL ni tablas. **No requiere migración, cambios en Railway, recursos nuevos ni costos nuevos.**

## Limpieza solicitada

La consulta de producción encontró una identidad de dueño, cero negocios y cero membresías. Persistían tres solicitudes de registro, un usuario de acceso y cuatro sesiones admitidas. No había MFA verificado. Se preparó una limpieza solo de esos intentos, su apartado de usuario, acceso anterior, perfil de clienta y sesiones admitidas, conservando la identidad Auth con teléfono verificado, la reserva de propietario/moderador y el WhatsApp de códigos. No se pretende eliminar otras cuentas ni datos de negocios.

Respaldo privado verificado: `respaldo-intento-dueno-20261030.json`, **7283 bytes**, SHA-256 **cfdae0df3af8ea5eaa87273b8c6f673edf6c7d947003dcb5b5410de4ed5f441f**. No contiene contraseñas, factores MFA ni secretos de la integración. El teléfono y los UUID reales quedan fuera de Git.

**La limpieza todavía no está aplicada:** las dos solicitudes de confirmación de `execute_sql` caducaron sin ejecutar. Tras el nuevo «Sí» de Antonio se revalidó el inventario y se solicitó otra vez; la tercera confirmación también caducó. Las lecturas confirmaron el mismo inventario sin borrar. No tratar una confirmación caducada como una operación completada; reanudarla cuando Antonio pueda confirmar el aviso de Supabase. Antes de ejecutar, comprobar de nuevo el inventario y detenerse si aparecieron negocios, otra cuenta, MFA verificado o un intento nuevo posterior al respaldo. Si Antonio ya entró con MFA, conservar su acceso nuevo y preparar una limpieza exclusivamente de los intentos vencidos; no ejecutar el plan anterior de revocar todas las sesiones. No repetir el reinicio global anterior.

## Verificación

- `npm test`: **280/280** aprobadas, incluido dueño sin membresías ni perfil social; AAL1, otra Admin y sesión revocada quedan sin panel.
- `pruebas/dueno-navegador.mjs`: SDK real, OTP y MFA ficticios, servidor y RLS locales. Dueño sin negocio: WhatsApp → dos pasos → panel; no hay consultas al contexto de salón ni al ticket anterior, no crea negocio ni perfil de clienta, conserva acceso al recargar y elimina el panel al salir. White/Dark 390 px; sin desbordamiento a 320/768/1440.
- `plataforma-navegador.mjs`: cifras, filtros, búsqueda, bitácora y acciones sobre salones ficticios; otra Admin rechazada.
- `contrasenas-navegador.mjs`: registro normal, contraseña, OTP, MFA, recuperación y equipo conservados.
- Capturas ficticias en `imagenes/acceso-dueno/`. El QR de la captura indica PRUEBA LOCAL; no es un factor de una persona real.

## Publicación y pendientes

Antonio revisó la captura y confirmó «Sí». Publicado el 30 de octubre de 2026: código **61cb2a6**, Worker **a564ac9a-2ca7-4e85-8f84-da29ae5228bc**, `--keep-vars`. Misma URL, recursos y variables; solo seis estáticos actualizados. Sin migración, cambios en Railway, costos nuevos ni modificaciones de FiNeCi.

Verificación pública en Edge a las **21:24:04 UTC**: salud 200; `/api/plataforma/yo`, resumen y salones anónimos 401; seis archivos coinciden con el paquete por SHA-256; entrada del dueño White/Dark a 390 px y tras recarga sin formulario de salón o contraseña; Comunidad sigue como inicio público y el registro normal conserva su pantalla inicial. Sin errores JavaScript, peticiones de códigos ni cuentas reales de prueba.

Se intentó abrir una pestaña visible con el navegador integrado: su control sigue desactivado en Work. La herramienta `open_in_codex` puede dejar en cola la apertura del enlace; no equivale a que la persona ya esté viendo la pestaña en su iPhone. Entregar el enlace directo `/plataforma/` para que Antonio pueda abrirlo desde su celular.

Queda pendiente la confirmación de limpieza de Supabase, además de que Antonio solicite personalmente su código real y configure los dos pasos. El acceso nuevo funciona sin depender del ticket vencido ni de esa limpieza. No declarar completado su acceso físico sin su confirmación. No activar citas, promociones ni vinculaciones nuevas.
