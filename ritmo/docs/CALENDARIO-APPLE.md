# Apple Calendar sin claves técnicas — corrección preparada el 26 de octubre de 2026

Estado: rama `codex/agendappx-calendario-sin-claves`, basada en la versión publicada `codex/pwa-backend-belleza`. No incluye cuentas ni WhatsApp del PR #2/#3. No se ha publicado ni activado ningún celular de producción.

## Uso previsto

1. En el dispositivo donde ya se usa Agendappx, Ajustes → Apple Calendar → Activar sincronización.
2. La primera vez, pegar **el enlace privado de activación**, emitido por el operador para Antonio. No se entrega ni se introduce APP_TOKEN. Alternativamente, abrir ese enlace directamente en el mismo navegador; si la página ya estaba abierta, también lo detecta.
3. Confirmar Activar y abrir Apple Calendar. Se conservan las citas del dispositivo, se sincronizan con la agenda existente y se muestran diferencias para resolverlas, si existen.
4. Pulsar Abrir Apple Calendar y confirmar Suscribirse en Apple. La suscripción funciona aunque no haya citas. Es de lectura: las altas y cambios se hacen en Agendappx; Apple decide su frecuencia de refresco.

La web no puede aceptar la suscripción por la persona ni garantizar una actualización instantánea de Apple. Safari y la app instalada pueden tener almacenamiento separado: activar **el contexto donde están las citas**, pegando allí el enlace si hace falta; no borrar datos ni reinstalar para forzarlo.

Agregar mis citas entrega directamente un archivo `.ics`, disponible incluso sin activar la sincronización. Es una copia puntual, no una suscripción. Excluye notas y teléfonos, omite canceladas y mantiene los UID de la suscripción. No se genera ZIP.

## Activación y privacidad

- Emisión exclusiva con la credencial privada del operador: POST `/api/dispositivos/enlaces`, cuerpo `{}`. Una sesión de celular no puede crear invitaciones.
- Enlace aleatorio de 256 bits, uso único y vigencia de 15 minutos. El secreto va en el fragmento, que el navegador retira inmediatamente del historial/URL antes de las llamadas. No se consume al previsualizar ni abrir: requiere confirmación.
- POST `/api/dispositivos/activar` recibe el secreto en JSON desde el mismo origen. El servidor consume el enlace y crea la sesión en una transacción.
- Sesión de 90 días, revocable, cookie `__Host-agendappx_sesion`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, sin Domain. Para pruebas HTTP de loopback se usa un nombre local sin Secure; nunca para una publicación externa.
- La sesión da acceso a **la única agenda heredada del salón**. Esta solución está limitada al propietario; no usarla para incorporar especialistas o recepción. No reemplaza roles/MFA/invitaciones del nuevo sistema de cuentas. Se desactiva al establecer `AGENDAPPX_CUENTAS_HABILITADAS=true`.
- Solo se guardan huellas HMAC en la tabla privada existente `belleza_integraciones`, con prefijo `dispositivo:`; no hay tablas, roles ni migraciones nuevos. Caducados se limpian al emitir; máximo 50 sesiones/enlaces pendientes.
- Cambiar APP_TOKEN invalida sesiones y enlaces anteriores sin entregar esa credencial a los celulares. La UI guarda únicamente un indicador de sesión; ninguna cookie ni secreto de invitación en localStorage.
- GET `/api/dispositivos/sesion` solo informa si el propio navegador está conectado; jamás devuelve citas. Los demás datos privados mantienen autenticación. Las escrituras con cookie exigen origen exacto y bloquean solicitudes cruzadas.
- DELETE `/api/dispositivos/sesion` revoca el navegador actual. DELETE `/api/dispositivos/enlaces`, exclusivo del operador, revoca todos los enlaces y sesiones; requiere autorización específica antes de usarlo en producción.
- API fuera de CacheStorage, `no-store`, `Vary: Cookie, Authorization`. La credencial técnica antigua queda únicamente en Configuración avanzada por compatibilidad.

## Operación después de aprobar el despliegue

La herramienta local `herramientas/activar-dispositivo.mjs` lee APP_TOKEN de un archivo privado y escribe el enlace temporal en otro archivo privado, siempre fuera del repositorio; nunca imprime el enlace ni los secretos. No ejecutarla antes de que esta corrección esté publicada. El archivo de salida no se sobrescribe. Entregar el enlace temporal únicamente a Antonio; si se usa un QR, generarlo localmente y no mandarlo a proveedores externos. No guardar enlace/QR de producción en Git ni en capturas de documentación.

```powershell
node ritmo/herramientas/activar-dispositivo.mjs --secretos C:/Users/dellv/.config/ritmo-belleza/cloudflare-secrets.json --salida C:/Users/dellv/.config/ritmo-belleza/activacion-celular.json
```

La carpeta debe conservar sus permisos privados. La primera activación es una acción consciente del propietario y puede subir su cola local; no se ha ejecutado ni migrado información en este trabajo. Los datos locales y el servidor se conservan al desconectar, y los conflictos no se resuelven silenciosamente.

## Verificación

94 pruebas de servidor y regresión aprobadas. Prueba de navegador con PostgreSQL real local: descarga `.ics`, privacidad, activación por enlace sin APP_TOKEN, cookie HttpOnly, recarga, edición sin internet, reenvío, permanencia del feed, cambios de hora, revocación, apertura con fragmento y White/Dark a 390/768/1440. También se ejecutan las regresiones existentes de fotos, diseño, sincronización y avisos de actualización. No se ha probado el diálogo nativo de Apple en un iPhone físico.

Supabase: comprobación de solo lectura confirma que el rol existente tiene los permisos necesarios sobre `belleza_integraciones`; el asesor de seguridad devuelve cero observaciones. No se modifica RLS, plan, roles, credenciales de producción, ni infraestructura. No se agrega ningún servicio de pago.

Prueba específica: `npm run test:calendario --prefix ritmo/servidor`. La compilación de Cloudflare usa `--dry-run`; publicar requiere la confirmación de Antonio según la skill del repositorio.

Fuentes: [Suscripciones de Apple](https://support.apple.com/es-mx/guide/iphone/iph3d1110d4/ios), [cookies y prefijo __Host-](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).
