# Prompt para Codex: Panel de Agendappx y código manual

Pégalo completo en el chat de Codex. Contraseñas y equipo ya están en el PR #17; esto es solo lo que falta.

```
Hola Codex. Lo de contraseñas y equipo ya lo tienes en el PR #17. Falta
solo esto, que Claude ya programó y probó: el Panel de Agendappx (para
mí) y el envío manual de códigos que no salen. NO lo vuelvas a hacer:
revísalo y publícalo conmigo.

DE DÓNDE TOMARLO
- Rama claude/agendappx-registro-contrasena, solo los commits 7b0f9e9
  (panel) y 480b852 (código manual). Los anteriores ya los tomaste en el
  PR #17.
- Llévalos encima de codex/agendappx-revision-contrasena (PR #17), en
  una rama y un PR nuevos.
- Si chocan con tu corrección 54081f1, conserva tu corrección. Regenera
  dist/ con npm run build en lugar de resolver dist/ a mano.
- Lee completo ritmo/docs/PANEL-PLATAFORMA.md.

QUÉ INCLUYE
1. Panel de Agendappx (/plataforma/ y Mi negocio → Panel de Agendappx),
   solo para mí con MFA:
   - cifras;
   - salud de la plataforma;
   - todos los salones con buscador y filtros;
   - ficha de cada salón: plan, +7/+14 días de prueba, verificar ✔︎,
     ocultar de Explorar, pausar y reactivar;
   - bitácora.
2. Código manual: si el WhatsApp de códigos no entrega un código, se
   guarda cifrado y me llega un aviso al celular. En el panel aparece
   «Códigos sin entregar» con «Ver y enviar», que abre mi WhatsApp con el
   mensaje para ese mismo número, y «Ya lo envié».

PASO 1 · PROBAR (sin publicar nada)
- cd ritmo/servidor && npm ci && npm test (deben pasar todas, incluidas
  plataforma.test.mjs y codigos-manuales.test.mjs).
- node pruebas/plataforma-navegador.mjs y vuelve a correr
  contrasenas-navegador.mjs para confirmar que nada se rompió.
- Revisa el diff con ojo de seguridad y dime si ves algo raro.

PASO 2 · PUBLICAR (pídeme confirmación ANTES de cada punto)
Va después de publicar el PR #17 (su migración 20261030160000 primero).
a) Respaldo de la base.
b) Migración 20261030180000_panel_plataforma.sql. Antes, en la misma
   sesión:
   SELECT set_config('ritmo.plataforma_admin','<UUID de mi cuenta>',
   false);
   Es el mismo UUID de MIGRACION_USUARIO_ID.
c) Migración 20261030190000_codigos_manuales.sql.
d) Worker con --keep-vars (usa ACCESO_HMAC_KEY y PUSH_VAPID_* que ya
   tiene).
e) Railway (agendappx-whatsapp) con WA_CODIGOS_RESPALDO_MANUAL=true. No
   actives envíos de citas, promociones ni vinculaciones nuevas.

PASO 3 · PRUEBA CONMIGO
1. Entro con MFA, abro Mi negocio → Panel de Agendappx y revisamos
   cifras y salones. No pongas en pausa ningún salón real.
2. Activo «Avisarme en este celular» en el panel.
3. Con mi permiso: desconecta a propósito el WhatsApp de códigos, pido un
   código, me llega el aviso, lo envío desde el panel y entro con él.
   Si Supabase no conserva el código cuando el servicio responde
   «recibido», apaga WA_CODIGOS_RESPALDO_MANUAL y dime.

REGLAS
- No toques FiNeCi.
- Secretos fuera de Git.
- Si algo falla, detente y dime.
- Para revertir el código manual: WA_CODIGOS_RESPALDO_MANUAL=false.

Antes de empezar, dime tu plan y qué necesitas de mí.
```
