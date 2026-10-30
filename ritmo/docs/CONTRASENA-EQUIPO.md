# Usuario y contraseña, restablecer, accesos del equipo e inicio público

Estado: programado y probado en local por Claude. **Falta publicarlo** (Codex, con confirmación de Antonio).
Rama: `claude/agendappx-registro-contrasena`, que parte de `codex/agendappx-bienvenida-registro-ios` (PR #16).
Modelos aprobados: `ritmo/ios/inicio.html` y `ritmo/ios/cuentas.html` en la rama `claude/es-posible-esto-tjimmb`.

## Qué cambia para las personas

- **Registro de un salón, en 4 pasos:**
  1. Usuario y contraseña.
  2. WhatsApp.
  3. Código de WhatsApp.
  4. Datos del salón: nombre, negocio y plan.

  El enlace del salón se crea solo (`AB' Beauty Room` → `ab-beauty-room`). El acceso con usuario y contraseña se habilita **solo al confirmar el código**; mientras tanto el usuario queda apartado 30 minutos. El intermediario anterior prepara el teléfono en Auth sin confirmarlo antes de enviar el código; esa preparación no concede acceso al salón. La contraseña vive solo en la memoria de la página hasta ese momento.
- **Entrar:** un campo «WhatsApp o usuario» y la contraseña. «Entrar con código de WhatsApp» sigue como otra opción.
  - Después del 3.er error aparece la verificación de seguridad (Turnstile).
  - Al 5.º error la cuenta espera 15 minutos.
  - El mensaje es el mismo si la cuenta no existe.
- **¿Olvidaste tu contraseña?:** se escribe el WhatsApp o el usuario. El código llega al WhatsApp de la cuenta, sin mostrar el número ni decir si la cuenta existe. Al guardar la contraseña nueva se cierran las demás sesiones.
- **Cuentas que ya existen** (Antonio y la dueña): siguen entrando con código. Después de entrar, la app ofrece «Crea tu usuario y contraseña» con la opción «Después». Su UUID, MFA, salón y datos no cambian.
- **Equipo:** Mi negocio → Conexiones → Sincronización → «Dar acceso con usuario» (solo Admin con MFA).
  - Admin pone nombre, usuario y rol (Especialista o Recepción).
  - La app genera una contraseña temporal fácil de dictar, por ejemplo `Estrella-Salvia-725-Lino`, que vence en 72 horas.
  - «Copiar» y «Enviar por WhatsApp» abren el WhatsApp **de la dueña** (wa.me), no el número de la plataforma.
  - Al entrar, la persona crea su propia contraseña. Antes de cambiarla, su sesión no ve ningún dato.
  - «Contraseña nueva» da otra temporal y cierra sus sesiones al momento.
  - Admin se sigue agregando con invitación por enlace.
- **Límites del plan:** los revisa el servidor antes de crear la cuenta y otra vez el disparador `limite_miembros_plan`. Solo admite 1 persona, Salón 5, Pro sin límite; un plan heredado no tiene límite.
- **Barra del negocio (opción A):** Hoy · Agenda · ＋ · Clientas · Negocio, con el ＋ negro al centro dentro de la misma cápsula.
- **Comunidad para visitantes:**
  - Abajo solo aparece **Inicio** y, en el resto del ancho, «¿Tienes un salón? Regístralo gratis ›», que lleva a `/#registro`.
  - Arriba aparece «Entrar», con dos opciones: «Soy clienta» (su perfil con WhatsApp) y «Tengo un salón» (`/#entrar`, el acceso de la agenda).
  - Con sesión de clienta, la barra tiene sus 4 pestañas como antes.
- **Inicio público (opcional):** quien abre `/` por primera vez, sin sesión, sin datos guardados y fuera de la app instalada, llega a `/comunidad/`.

## Archivos

| Parte | Archivo |
|---|---|
| Migración aditiva | `supabase/migrations/20261030160000_usuarios_contrasena.sql` |
| Servidor | `servidor/src/cuentas/contrasenas.ts` (nuevo); cambios en `registro.ts`, `acceso.ts` y `http.ts`; `nube/worker.mjs` |
| Función de Supabase | `supabase/functions/agendappx-registro/intermediario.mjs`: propósitos firmados `alta-miembro-v1` y `contrasena-miembro-v1` |
| App | `servidor/cliente/cuentas.js`, `servidor/cliente/registro.js`, `belleza/belleza.js`, `belleza/estilo-neutro-ios.css`, `comunidad/real.mjs`, `comunidad/real.css` y `dist/` regenerado |
| Pruebas | `servidor/pruebas/contrasenas.test.mjs` (9) y `servidor/pruebas/contrasenas-navegador.mjs` |
| Capturas | `imagenes/contrasena-equipo/` |

## Seguridad

- Las contraseñas solo pasan por el Worker hacia Supabase Auth. No se guardan ni se registran en la base propia.
- El rol `ritmo_api` no lee `auth.users`. La función `ritmo.identificador_acceso(usuario)` solo devuelve el teléfono o correo de un usuario, y el teléfono nunca sale del servidor.
- Las sesiones con contraseña se admiten en `ritmo.acceso_sesiones`, igual que las de código. Una sesión con contraseña temporal **no se admite** hasta que la persona la cambia.
- Cambiar una contraseña que ya existe exige que la sesión haya entrado con un código de WhatsApp en los últimos 15 minutos (flujo «¿Olvidaste tu contraseña?»).
- Las cuentas del equipo sin WhatsApp usan un correo interno no entregable: `miembro-<uuid>@agendappx.invalid`.
  - El intermediario solo crea correos con ese formato.
  - Solo cambia contraseñas de cuentas con ese correo y **sin teléfono**, así que nunca toca la cuenta de Antonio ni la de la dueña.
- Los fallos se guardan como huellas HMAC (`ACCESO_HMAC_KEY`): ni la cuenta ni la IP quedan en claro.

## Cómo publicarlo (Codex, con confirmación de Antonio en cada paso)

1. Une la rama a la cadena de PRs o ábrela como PR sobre el #16.
2. **Respaldo y migración:** respalda y aplica `20261030160000_usuarios_contrasena.sql`. Es aditiva: crea 3 tablas y 3 funciones, sin tocar datos.
3. **Supabase Auth:** revisa estos ajustes.
   - El proveedor de **Email** debe estar activo, solo para el inicio de sesión de las cuentas internas; no se manda ningún correo.
   - El inicio de sesión con teléfono y contraseña debe estar activo.
   - Longitud mínima de contraseña: 8 o menos (la app exige 8).
   - Si «Secure password change» está activo, el flujo ya entra con código antes de cambiar.
   - Comprueba que Auth Admin acepte el dominio `agendappx.invalid`. Si no, cambia `DOMINIO_MIEMBROS` en `contrasenas.ts` y la expresión `correoMiembro` en `intermediario.mjs` a un subdominio que sea de Antonio. Ese subdominio nunca recibe correos.
4. **Función de Supabase:** publica `agendappx-registro` actualizada. Usa la misma `REGISTRO_OPERACION_KEY`; el registro actual sigue funcionando.
5. **Worker:** agrega las variables y publica con `--keep-vars`.
   - `ACCESO_CONTRASENA_HABILITADO=true`
   - `AGENDAPPX_INICIO_PUBLICO=true` (opcional; actívalo cuando Antonio quiera que la primera entrada sea Comunidad)

   Turnstile usa la misma clave de sitio, con la acción `acceso`.
6. **Prueba física con Antonio:**
   - registrar un salón de prueba;
   - entrar con usuario y con WhatsApp;
   - restablecer la contraseña;
   - crear el acceso de una persona del equipo y entrar con la temporal;
   - revisar la barra y Comunidad como visitante.

**Para revertir:** `ACCESO_CONTRASENA_HABILITADO=false` oculta todo lo nuevo y el acceso por código sigue igual. Las tablas nuevas pueden quedarse.

## Pruebas

```bash
cd ritmo/servidor
npm test                                   # 256 pruebas (9 nuevas)
BROWSER_CHANNEL=chromium node pruebas/contrasenas-navegador.mjs
```

En local también se corrieron sin errores, con Chromium:
- login-whatsapp, registro-whatsapp, neutro-etapa1, negocio-etapa2, planes-etapa3 y social-etapa4 (esta con `channel:'chromium'`; el archivo tiene fijo `msedge`);
- la prueba nueva de contraseñas.

`comunidad-navegador` ya fallaba antes de este cambio: busca la Comunidad de demostración anterior.


## Revisión de Codex — 30 de octubre de 2026

Revisada la implementación de Claude, commits `914003d` y `28f6cc3`, en una copia separada. No se rehízo el cambio ni se incorporaron los cambios locales incompletos de la rama anterior.

### Corrección necesaria antes de publicar

El restablecimiento de una cuenta con MFA verificado intentaba guardar la contraseña con AAL1, antes de los dos pasos. Supabase Auth rechaza esa operación con `insufficient_aal`; el simulador original no exigía esta regla. Se reprodujo el fallo con el simulador corregido y se ajustó únicamente el orden: código de WhatsApp → MFA existente → contraseña nueva. El servidor devuelve un mensaje específico si Auth exige AAL2. Registro inicial, UUID, membresías y requisito MFA de Admin se conservan.

Prueba: `contrasenas-navegador.mjs` ahora rechaza actualizaciones de contraseña con AAL1 cuando existe MFA y comprueba que la contraseña anterior permanece hasta completar los dos pasos. La captura `imagenes/contrasena-equipo/11-restablecer-dos-pasos.png` corresponde a esa comprobación local; no contiene un secreto MFA.

### Comprobaciones del destino (solo lectura y validación sin alta)

- Proyecto dedicado `zkqwephmuflbuagevvxj`, organización `caguamex's Org`, plan Free.
- Email activo; Phone activo. Confirmación telefónica activa, códigos de seis dígitos y 600 segundos. El hook de envío existente continúa seleccionado, sin configurar SMS ni cambiar Railway.
- Mínimo de Auth: seis caracteres; la aplicación exige ocho. Secure password change y Require current password when updating están desactivados; no se modificaron estos ajustes.
- Auth Admin acepta la validación del correo `miembro-<uuid>@agendappx.invalid`. Se comprobó con un ID y duración deliberadamente inválidos: Auth respondió `ID must conform to the uuid v4 format` después de validar el correo y antes de la transacción de alta. No se creó un usuario, no se generó una sesión y no se envió correo ni WhatsApp. No hace falta comprar ni sustituir el dominio.
- La función publicada `agendappx-registro` sigue en versión 2. La migración nueva todavía no figura en el historial: no se aplicó por la revisión.
- Los asesores actuales muestran protección contra contraseñas filtradas desactivada (la opción de Supabase requiere Pro) y tablas privadas con RLS sin políticas, cerradas por diseño y atendidas mediante funciones acotadas. No se activó un plan ni se ampliaron permisos.

### Validación local

- `npm test`: **256/256** después de la corrección.
- `BROWSER_CHANNEL=msedge node pruebas/contrasenas-navegador.mjs`: aprobado, incluida la exigencia real de MFA antes de restablecer la contraseña.
- Regresión `login-whatsapp-navegador.mjs`: aprobada; SDK real, mismo UUID, OTP, MFA, vinculación propia simulada y tamaños 390/768/1440.
- `npm run build --prefix ritmo/nube`: dry-run aprobado, sin publicar.

La primera ejecución de npm test no cargó dos archivos porque faltaba enlazar la dependencia local Baileys en la copia de revisión. Al usar las dependencias ya instaladas, las 256 pruebas pasaron. El primer recorrido con la exigencia MFA corregida reprodujo el fallo descrito arriba; el recorrido final pasa.

Fuentes verificadas: [contraseñas de Supabase](https://supabase.com/docs/guides/auth/passwords), [validación y cambio de contraseña en Auth](https://github.com/supabase/auth/blob/master/internal/api/user.go), [validación Admin antes de alta](https://github.com/supabase/auth/blob/master/internal/api/admin.go). Se revisó también el índice de cambios vigente de Supabase.

### Publicación pendiente de confirmación

Preparar un respaldo de los datos del salón, sin exportar secretos, hashes de contraseñas, sesiones de Auth ni credenciales de WhatsApp; comparar huellas de las tablas existentes antes/después. Aplicar solo `20261030160000_usuarios_contrasena.sql`; publicar el intermediario con la misma llave y el Worker con `--keep-vars` y `ACCESO_CONTRASENA_HABILITADO=true`.

**No activar `AGENDAPPX_INICIO_PUBLICO`** en esta publicación: Antonio lo autorizará aparte. No cambiar las banderas existentes de WhatsApp ni desplegar Railway. No crear ejemplos en el salón real. La prueba física guiada queda pendiente después de publicar; el éxito local no acredita aún un recorrido completo con Supabase Auth real.
