# Prompt completo para Codex: publicar lo que programó Claude

Ya no se usa completo: contraseñas y equipo los tomó Codex en el PR #17. Para el panel y el código manual usa `PROMPT-CODEX-PANEL.md`.

```
Hola Codex. Claude ya programó y probó lo que sigue. NO lo vuelvas a
hacer: revísalo, une la rama y publícalo conmigo, paso por paso.

RAMA: claude/agendappx-registro-contrasena
Parte de tu codex/agendappx-bienvenida-registro-ios (PR #16) y suma 4
commits: 914003d, 28f6cc3, 7b0f9e9 y 480b852.
Ábrela como PR sobre el #16 (o únela a la cadena, como te convenga).

LEE COMPLETOS ANTES DE EMPEZAR (en esa rama):
- ritmo/docs/CONTRASENA-EQUIPO.md
- ritmo/docs/PANEL-PLATAFORMA.md
Si algo de este mensaje no coincide con ellos, mandan los documentos.

QUÉ INCLUYE
1. Cuentas con usuario y contraseña:
   - registro en 4 pasos: usuario y contraseña → WhatsApp → código →
     datos del salón (el enlace se crea solo);
   - entrar con WhatsApp o usuario y contraseña (el código sigue como
     otra opción); CAPTCHA desde el 3.er error y espera de 15 minutos
     al 5.º;
   - «¿Olvidaste tu contraseña?» con código al WhatsApp de la cuenta;
   - mi cuenta y la de la dueña siguen igual y la app les ofrece crear
     usuario y contraseña.
2. Accesos del equipo según el plan: Admin crea a la persona con usuario
   y contraseña temporal (72 h), que ella cambia al entrar; «Contraseña
   nueva» y «Quitar acceso». Límites por plan en el servidor.
3. Barra del negocio opción A: Hoy · Agenda · ＋ · Clientas · Negocio.
4. Comunidad para visitantes: abajo solo Inicio y «¿Tienes un salón?
   Regístralo gratis»; arriba «Entrar» (Soy clienta / Tengo un salón).
   Inicio público opcional con AGENDAPPX_INICIO_PUBLICO.
5. Panel de Agendappx (/plataforma/), solo para mí con MFA:
   - cifras, salud de la plataforma y todos los salones con filtros;
   - en cada salón: plan, +7/+14 días de prueba, verificar ✔︎, ocultar
     de Explorar, pausar y reactivar;
   - bitácora de todo lo que hago.
6. Respaldo manual de códigos: si WhatsApp no entrega un código, se
   guarda cifrado, me llega un aviso al celular y lo envío desde el panel
   («Ver y enviar» abre mi WhatsApp al mismo número).

PASO 1 · REVISAR Y PROBAR (sin publicar nada)
- cd ritmo/servidor && npm ci && npm test   → deben pasar 265.
- Pruebas de navegador nuevas:
    node pruebas/contrasenas-navegador.mjs
    node pruebas/plataforma-navegador.mjs
  Más las que ya tenías: login-whatsapp, registro-whatsapp,
  neutro-etapa1, negocio-etapa2, planes-etapa3 y social-etapa4. Claude
  ajustó social-etapa4 a la barra nueva de visitante.
- comunidad-navegador ya fallaba antes de este cambio (busca la Comunidad
  de demostración anterior); dime si lo arreglas aparte.
- Revisa el diff con ojo de seguridad y dime si ves algo raro.

PASO 2 · REVISAR SUPABASE (dime qué encontraste antes de cambiar nada)
- Auth: proveedor Email activo (solo para entrar con las cuentas internas
  del equipo; no manda correos) y entrar con teléfono y contraseña
  permitido.
- Longitud mínima de contraseña: 8 o menos.
- Si «Secure password change» está activo, el flujo ya pide entrar con
  código antes de cambiar la contraseña.
- Que Auth Admin acepte correos @agendappx.invalid. Si no, propón un
  subdominio mío y cambia DOMINIO_MIEMBROS (contrasenas.ts) y la
  expresión correoMiembro (intermediario.mjs).

PASO 3 · PUBLICAR (pídeme confirmación ANTES de cada punto)
a) Respaldo de la base.
b) Migraciones en este orden:
   1. 20261030160000_usuarios_contrasena.sql
   2. 20261030180000_panel_plataforma.sql: antes, en la misma sesión,
      SELECT set_config('ritmo.plataforma_admin','<UUID de mi cuenta>',
      false); es el mismo UUID de MIGRACION_USUARIO_ID.
   3. 20261030190000_codigos_manuales.sql
   Todas son aditivas. Revisa que las tablas anteriores sigan idénticas.
c) Función de Supabase agendappx-registro (intermediario.mjs). Usa la
   misma REGISTRO_OPERACION_KEY.
d) Worker con --keep-vars y ACCESO_CONTRASENA_HABILITADO=true.
   AGENDAPPX_INICIO_PUBLICO=true solo cuando yo lo pida.
e) Railway (agendappx-whatsapp) con WA_CODIGOS_RESPALDO_MANUAL=true. NO
   actives envíos de citas, promociones ni vinculaciones nuevas.

PASO 4 · PRUEBA FÍSICA CONMIGO
1. Registrar un salón de prueba con usuario y contraseña.
2. Entrar con usuario y con WhatsApp.
3. Restablecer la contraseña.
4. Crear el acceso de una persona del equipo y entrar con la temporal.
5. Revisar la barra con el ＋ al centro y Comunidad como visitante.
6. Abrir Mi negocio → Panel de Agendappx con MFA y revisar cifras y
   salones. No pongas en pausa ningún salón real.
7. Activar «Avisarme en este celular» en el panel.
8. Prueba del respaldo de códigos, con mi permiso: desconecta a
   propósito el WhatsApp de códigos, pido un código, me llega el aviso,
   lo envío desde el panel y entro con él. Si Supabase no conserva el
   código cuando el servicio responde «recibido», apaga
   WA_CODIGOS_RESPALDO_MANUAL y dime.

REGLAS
- No toques FiNeCi.
- Secretos solo en Cloudflare, Supabase o Railway, nunca en Git.
- Si algo falla, detente y dime qué pasó antes de seguir.
- Si hay que revertir: ACCESO_CONTRASENA_HABILITADO=false y
  WA_CODIGOS_RESPALDO_MANUAL=false dejan todo como estaba; las tablas
  nuevas pueden quedarse.

Antes de empezar, dime tu plan, cuánto tardarás y qué necesitas de mí.
```
