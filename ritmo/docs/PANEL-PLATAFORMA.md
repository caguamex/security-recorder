# Panel de Agendappx (solo para Antonio)

Estado: **publicado el 30 de octubre de 2026 en Cloudflare y Railway, con reinicio solicitado por Antonio**. Las autorizaciones separadas fueron recibidas y verificadas; ver el cierre de publicación y `REINICIO-PROPIETARIO.md`. El bloqueo histórico de abajo quedó resuelto por `ac61e25`, integrado como `509e575`.
Rama: `claude/agendappx-registro-contrasena` (va junto con `CONTRASENA-EQUIPO.md`).

## Cómo se entra

- **Dirección:** `/plataforma/`. También aparece en **Mi negocio → Panel de Agendappx**, solo en la cuenta de Antonio.
- **Requisitos:** Antonio entra a su cuenta normal con la **verificación en dos pasos**. Nadie más ve el panel: otras dueñas, especialistas, recepción y clientas reciben «solo para el administrador».
- **Quién es administrador:** lo define la tabla `ritmo.plataforma_admins`. La migración agrega solo a Antonio y no hay pantalla para agregar a más personas.

## Qué muestra

1. **Cifras:**
   - salones (y nuevos de la semana);
   - en prueba gratis (y cuántas vencen en 5 días);
   - pruebas vencidas;
   - lugares de fundadora usados (de 20);
   - personas con acceso;
   - clientas registradas;
   - citas movidas en la semana;
   - citas pedidas desde la app.
2. **Salud de la plataforma:**
   - estado del WhatsApp de códigos (866 124 1483);
   - códigos enviados y con error en 24 h;
   - registros completos y sin terminar;
   - reportes de Comunidad pendientes;
   - salones visibles, verificados y en pausa en Explorar.
3. **Salones**, con buscador (nombre, enlace, dueña o ciudad) y filtros: En prueba, Por vencer, Vencidos, En pausa, Sin verificar y Sin uso 14 días.
   - Cada salón muestra: plan, estado de la prueba, número de fundadora, dueña, personas, citas en 30 días y último uso.
4. **Ficha de cada salón:**
   - WhatsApp de la dueña (abre WhatsApp);
   - uso: personas, servicios, citas, fotos y último uso;
   - **cambiar plan**;
   - **+7 / +14 días de prueba**;
   - **marcar como verificado ✔︎**;
   - ver perfil público y **ocultar de Explorar**;
   - **poner en pausa** (con motivo) y **reactivar**.
5. **Bitácora:** las últimas acciones del panel, con fecha y hora en 24 h.

**Lo que el panel NO muestra:** agendas, citas ni teléfonos de clientas de ningún salón. Solo cuenta cuántas hay.

## Códigos que no salen (respaldo manual)

Para que nadie se quede esperando si el WhatsApp de códigos falla.

### Cómo funciona

1. Cuando el servicio de WhatsApp no puede entregar un código (desconectado, envíos detenidos o sin confirmación), lo guarda **cifrado** en `ritmo.codigos_manuales`. Usa AES-256-GCM con una llave derivada de `ACCESO_HMAC_KEY`, así que en la base no queda ni el teléfono ni el código en claro.
2. El servicio responde «recibido» a Supabase para que el código siga siendo válido. A la persona, a los 45 segundos, la app le dice: «¿Todavía no llega? Espera un par de minutos: si WhatsApp falló, te lo enviamos nosotros al mismo número.»
3. **Aviso inmediato a Antonio:** el servicio manda un aviso firmado al Worker (`/api/plataforma/aviso-codigo`) y el Worker manda una notificación a los celulares de Antonio que tengan avisos activos. El aviso no lleva el teléfono ni el código. Si ese aviso falla, la tarea programada lo reintenta cada 5 minutos.
4. **En el panel:** arriba aparece «Códigos sin entregar», con el número oculto (`+52 844 ••• 45`), para qué era el código, el motivo y a qué hora vence.
   - **Ver y enviar** muestra el código y el número completo, y queda en la bitácora.
   - **Enviar por WhatsApp** abre el WhatsApp de Antonio con el mensaje listo para **ese mismo número**; no se puede cambiar el destinatario.
   - **Ya lo envié** lo marca como entregado.
5. El panel se actualiza solo cada minuto. Los códigos vencidos (10 minutos) o ya usados desaparecen.
6. Para recibir los avisos, Antonio toca **Avisarme en este celular** en la sección de salud. En iPhone, la app debe estar agregada a la pantalla de inicio.

### Seguridad

- Solo el administrador de la plataforma, con MFA, puede ver un código.
- El servicio de WhatsApp solo puede **agregar** códigos al respaldo; no los lee.
- Cada código que se ve o se entrega queda anotado en la bitácora.

### Configuración

- Migración `20261030190000_codigos_manuales.sql`, después de la del panel.
- En Railway: `WA_CODIGOS_RESPALDO_MANUAL=true`. Sin esa variable, el servicio se comporta igual que antes: error y la persona vuelve a pedir el código.
- El Worker usa su `ACCESO_HMAC_KEY` y las llaves de avisos (`PUSH_VAPID_*`) que ya tiene.
- **Verificar al publicar:** que Supabase conserve el código cuando el servicio responde «recibido». Para probarlo, con el WhatsApp de códigos desconectado a propósito, pide un código, envíalo desde el panel y entra con él.

## Reglas

- **En pausa:**
  - el salón conserva todos sus datos, pero no puede guardar cambios en la agenda (error `agendappx_salon_suspendido`);
  - sale de Explorar y su Admin no puede volver a mostrarse mientras siga en pausa.
- **Extender la prueba:** recorre la ventana de 30 días completa, porque la base exige que la prueba dure exactamente 30 días. Solo aplica a salones en prueba.
- **Bitácora:** cada acción queda registrada con quién, cuándo y el detalle.

## Archivos

| Parte | Archivo |
|---|---|
| Migración aditiva | `supabase/migrations/20261030180000_panel_plataforma.sql` |
| Servidor | `servidor/src/plataforma/http.ts`, conectado en `servidor/src/cuentas/http.ts` |
| Página | `belleza/plataforma/` (index.html, plataforma.css, plataforma.js) y la fila en `belleza/negocio.js` |
| Respaldo de códigos | `supabase/migrations/20261030190000_codigos_manuales.sql`, `servidor/src/plataforma/cifrado.ts`, `servidor/src/plataforma/codigos.ts`, `whatsapp/codigos.mjs`, `whatsapp/config.mjs` y `belleza/sw.js` (texto del aviso) |
| Pruebas | `servidor/pruebas/plataforma.test.mjs` (4), `servidor/pruebas/codigos-manuales.test.mjs` (5) y `servidor/pruebas/plataforma-navegador.mjs` |
| Capturas | `imagenes/panel-plataforma/` |

## Publicación (Codex, con confirmación de Antonio)

1. Antes de aplicar la migración, define el administrador con el UUID de la cuenta de Antonio (el mismo de `MIGRACION_USUARIO_ID`). La migración se detiene si falta:

   ```sql
   SELECT set_config('ritmo.plataforma_admin','<UUID de Antonio>',false);
   ```
2. Respaldo y migraciones `20261030180000_panel_plataforma.sql` y `20261030190000_codigos_manuales.sql`. Es aditiva: cambia el disparador `proteger_fin_prueba` para sumar la pausa.
3. Publica el Worker y el servicio de Railway (con `WA_CODIGOS_RESPALDO_MANUAL=true`). `/plataforma` ya está excluido de las rutas de perfiles y reservado como enlace de salón.
4. Prueba con Antonio: entrar con MFA, abrir Mi negocio → Panel de Agendappx y revisar cifras y salones. **No pongas en pausa a un salón real.**

## Pruebas

```bash
cd ritmo/servidor
npm run test:plataforma        # 4 de base de datos/API + navegador
```


## Revisión de Codex — 30 de octubre de 2026

Rama nueva `codex/agendappx-panel-codigos-manuales`, desde `f5ce2d1` del PR #17. Se tomaron únicamente `7b0f9e9` y `480b852` de Claude, como `26c7539` y `b3e5747`. Los conflictos fueron solo archivos generados: se resolvieron regenerando con `npm run build`, sin editar dist manualmente. Se conserva la corrección MFA de `54081f1` y su prueba de restablecimiento.

### Verificaciones completadas

- `npm ci`: dependencias instaladas según el archivo de bloqueo, cero vulnerabilidades informadas.
- `npm test`: **265/265 pruebas originales aprobadas**, incluidas plataforma y códigos manuales.
- `BROWSER_CHANNEL=msedge node pruebas/plataforma-navegador.mjs`: aprobado con PostgreSQL local, SDK real, MFA, cifrado, filtros y acciones sobre salones ficticios. La otra Admin no accede.
- `BROWSER_CHANNEL=msedge node pruebas/contrasenas-navegador.mjs`: aprobado, conservando la exigencia AAL2 antes de cambiar la contraseña de una cuenta con MFA.
- Revisión de permisos: tablas privadas con RLS, administrador fijado en la migración, funciones del panel que exigen sesión/MFA, códigos cifrados AES-GCM, destinatario construido en el servidor y sin teléfono/código en el aviso push. El servicio de WhatsApp solo inserta respaldos; no recibe permiso SELECT sobre ellos.

### Bloqueo reproducido — el aviso se pierde ante un fallo temporal del proveedor push

`plataforma_tomar_avisos_codigos()` marca `avisado_en=now()` **antes** de intentar el envío. `avisarCodigos()` captura el fallo o respuesta 503 del proveedor, pero no devuelve el aviso al estado pendiente. La siguiente ejecución solo recoge `avisado_en IS NULL`, por lo que no vuelve a enviarlo. La persona podría pedir un código sin entrega y Antonio no recibiría la notificación prometida, aunque el código siga visible al abrir el panel.

Prueba adicional de revisión: `servidor/pruebas/revision-avisos-codigos.test.mjs`. Usa PGlite y una suscripción ficticia; simula respuesta 503 en el primer envío y 201 en el siguiente. **Falla:** el segundo intento envía 0 avisos cuando debe enviar 1. No hace solicitudes a Apple, Supabase, Railway ni WhatsApp.

```bash
cd ritmo/servidor
node --test pruebas/revision-avisos-codigos.test.mjs
# Esperado: reintento.enviados = 1
# Actual:   reintento.enviados = 0
```

La nueva prueba queda intencionalmente en rojo en este PR de revisión. Si se ejecuta ahora la suite completa con ella, existe este fallo conocido; las 265 aprobadas corresponden a las pruebas entregadas originalmente. No confundir el recorrido feliz de push de la prueba original con una comprobación de reintentos.

### Observación adicional del estado mostrado

`GET /api/plataforma/codigos` devuelve `activo:true` al existir `opciones.key` (la ACCESO_HMAC_KEY ya usada por el acceso), sin comprobar `WA_CODIGOS_RESPALDO_MANUAL` del servicio de Railway. Por ello el panel puede anunciar respaldo manual activo aunque esa bandera siga apagada. Antes de presentarlo como salud real, debe distinguirse entre el panel configurado y el respaldo habilitado en el servicio.

### Detenido por instrucción de Antonio

Antonio pidió «Si algo falla, detente y dime». Se detuvo la preparación para publicación al reproducir el reintento perdido; **no se corrigió ni rehízo la implementación**. No se respaldó ni modificó la base de producción para esta etapa, no se aplicaron sus dos migraciones, no se desplegó Cloudflare ni Railway, no se cambió la bandera manual, no se desconectó WhatsApp y no hubo códigos ni avisos reales.

La aplicación publicada del PR #17 permanece en Worker `867d6000-8926-440f-b836-b79bf1eda4a7`, con migración de contraseña `20261030160000` ya aplicada. Para continuar este PR deben corregirse los avisos y repetirse las pruebas; después se pedirán autorizaciones independientes para (a) respaldo, (b) migración del panel, (c) migración manual, (d) Worker y (e) Railway. La prueba de desconexión deliberada también requiere su propio permiso. No tocar FiNeCi.

## Correcciones verificadas — 30 de octubre de 2026

Por instrucción nueva de Antonio se tomó únicamente `ac61e2565b80daf29934b75a6f44c457634989c6` de Claude sobre esta rama del PR #18, como `509e575`. La prueba de revisión ya existía idéntica y se conservó, sin duplicarla. La corrección MFA de `54081f1` sigue presente y probada.

- `plataforma_tomar_avisos_codigos` ahora aparta con `intento_en`; `plataforma_confirmar_avisos` marca `avisado_en` solo cuando algún proveedor acepta la notificación. Si no acepta ninguno, libera el intento. Un intento abandonado puede recuperarse después de dos minutos.
- El servicio anuncia su bandera manual al arrancar. El panel consulta `plataforma_respaldo_activo`, con permiso de administrador de plataforma y MFA, en lugar de inferirla de la existencia de la llave del Worker. La prueba comprueba el cambio de apagado a encendido.
- La migración `20261030190000_codigos_manuales.sql` es la versión corregida y **todavía no se aplicó en producción**.
- `npm test`: **266/266 aprobadas**, incluida `revision-avisos-codigos.test.mjs` y las de plataforma/códigos manuales. La primera ejecución tuvo bloqueos locales `connect EACCES 127.0.0.1`; la ejecución con acceso al servidor local terminó sin fallos, sin cambiar código para saltar pruebas.
- `BROWSER_CHANNEL=msedge node pruebas/plataforma-navegador.mjs`: aprobado, White/Dark a 390/768/1440, acceso exclusivo, filtros, bitácora y códigos sobre datos ficticios.
- `BROWSER_CHANNEL=msedge node pruebas/contrasenas-navegador.mjs`: aprobado, incluidos CAPTCHA, acceso temporal del equipo y restablecimiento que exige AAL2 antes de guardar contraseña nueva.
- Revisión del cambio: se conservan el cifrado, el destinatario fijado por servidor, los permisos mínimos y la exclusión de código/teléfono del aviso. No se observó un bloqueo nuevo en este alcance. La aceptación del proveedor push no demuestra recepción en un iPhone; esa comprobación y la conservación del OTP por Supabase siguen pendientes de la prueba física autorizada.

No hubo respaldo, migraciones, cambios de variables ni publicaciones en Cloudflare/Railway en esta revisión; no se mandaron códigos reales ni se desconectó WhatsApp. Continuar con confirmación **separada antes de cada punto**: respaldo; panel con `ritmo.plataforma_admin` en la misma sesión; códigos manuales; Worker `--keep-vars`; y Railway existente con `WA_CODIGOS_RESPALDO_MANUAL=true`. No habilitar citas/promociones, vinculaciones nuevas, inicio público ni tocar FiNeCi.

## Publicación y reinicio autorizados — 30 de octubre de 2026

Antonio autorizó el respaldo y pidió eliminar las cuentas para comenzar de cero, reservando para él el primer registro como dueño. Confirmó su nuevo número por el canal privado de operación. Después aprobó por separado las dos migraciones, Cloudflare con inicio público y Railway con el respaldo manual.

- Respaldo privado de 43 tablas verificado, 232755 bytes, SHA-256 `0331db15d554757fbf8e018d0aade25a045a8fe81b72f40e5925f12acf870ae2`. Las 43 huellas permanecieron idénticas tras las migraciones, antes del reinicio expresamente solicitado.
- Migración del archivo `20261030180000`: versión real **20261030185341**, `panel_plataforma_aprobado_20261030`. La misma sesión fijó `ritmo.plataforma_admin` al propietario de ese momento; tres tablas con RLS habilitada/forzada y sin lectura directa de anon/authenticated/ritmo_api.
- Migración corregida del archivo `20261030190000`: versión real **20261030185533**, `codigos_manuales_aprobado_20261030`. Tabla cerrada; WhatsApp tiene INSERT, sin SELECT. No repetir los archivos bajo otro nombre.
- Cloudflare **2be43b60-cf88-4f6c-869a-e376a68af5b7**, con `--keep-vars` y `AGENDAPPX_INICIO_PUBLICO=true`, aprobado explícitamente al publicar. URL conservada. Configuración pública, registro de cuatro pasos y panel protegido comprobados en Edge; las APIs del panel responden 401 sin sesión. Cuatro archivos publicados coinciden por SHA-256 con el paquete local.
- Railway **97a5e4da-0c3b-45d2-84ec-f040ab4a8243**, SUCCESS; arranque nuevo `2026-10-30T19:10:07.681640078Z`. Mismo proyecto/servicio, una réplica y límites existentes. La revisión automática bloqueó inicialmente `railway up`; se informó a Antonio y este autorizó explícitamente ese despliegue concreto antes de ejecutarlo. No se eludió el bloqueo.
- `WA_CODIGOS_RESPALDO_MANUAL=true` y estado anunciado en la base=true; WhatsApp de códigos continúa conectado. `WA_CODIGOS_HABILITADOS=true` existente. Citas/promociones y vinculaciones nuevas permanecen apagadas. Sin servicios nuevos, cambios de plan, mensajes de prueba ni modificaciones en FiNeCi.
- Lectura de presupuesto: consumo compartido 1.6935 USD; proyección de consumo 3.3996 USD para el ciclo 14 de octubre–14 de noviembre, límite duro de cómputo 10 USD y aviso 5 USD, intactos. Estas cifras no son una factura final con mínimo Hobby e impuestos.
- Reinicio: cuenta antigua eliminada por Auth Admin; cero salones, miembros, objetos, perfiles, registros y usuarios de acceso anteriores. Se reservó una única identidad nueva de Antonio, **sin contraseña, teléfono confirmado, sesión, MFA ni salón creados**; solo ese UUID recibe plataforma_admins y social_moderadores. Ver `REINICIO-PROPIETARIO.md`. La conexión/sesión cifrada del WhatsApp de códigos se conservó.
- **268/268 pruebas**: las 266 anteriores más dos protecciones del reinicio. Ambas pruebas de navegador anteriores siguen aprobadas. Verificación final real sin alta ni OTP: raíz lleva a Comunidad, registro vacío, panel anónimo protegido, sin errores JS. Capturas y metadatos privados fuera de Git.

Pendiente de la persona: Antonio debe completar su primer registro con el número reservado, elegir su contraseña y configurar MFA; entonces verá Mi negocio → Panel de Agendappx. No declarar hecha la prueba física de registro ni de entrega manual: esta última requiere permiso separado para desconectar y volver a probar el OTP real. La notificación PWA requiere que Antonio active los avisos en su dispositivo. Conservar el inicio original de Railway del 27 de octubre para el informe semanal; no reiniciar ese contador por esta actualización.
