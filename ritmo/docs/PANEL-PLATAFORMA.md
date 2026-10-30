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
| Pruebas | `servidor/pruebas/plataforma.test.mjs` (4) y `servidor/pruebas/plataforma-navegador.mjs` |
| Capturas | `imagenes/panel-plataforma/` |

## Publicación (Codex, con confirmación de Antonio)

1. Antes de aplicar la migración, define el administrador con el UUID de la cuenta de Antonio (el mismo de `MIGRACION_USUARIO_ID`). La migración se detiene si falta:

   ```sql
   SELECT set_config('ritmo.plataforma_admin','<UUID de Antonio>',false);
   ```
2. Respaldo y migración `20261030180000_panel_plataforma.sql`. Es aditiva: cambia el disparador `proteger_fin_prueba` para sumar la pausa.
3. Publica el Worker. `/plataforma` ya está excluido de las rutas de perfiles y reservado como enlace de salón.
4. Prueba con Antonio: entrar con MFA, abrir Mi negocio → Panel de Agendappx y revisar cifras y salones. **No pongas en pausa a un salón real.**

## Pruebas

```bash
cd ritmo/servidor
npm run test:plataforma        # 4 de base de datos/API + navegador
```
