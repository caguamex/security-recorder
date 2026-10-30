# Panel de Agendappx (solo para Antonio)

Estado: programado y probado en local por Claude. **Falta publicarlo** (Codex, con confirmación de Antonio).
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
