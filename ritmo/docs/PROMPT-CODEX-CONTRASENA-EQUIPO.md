# Prompt para Codex: contraseña, inicio de sesión con usuario y accesos del equipo según el plan

Pégalo completo en el chat de Codex. Va después de `PROMPT-CODEX-REGISTRO-BARRA.md` (o junto con él).

```
Hola Codex. Cambio en las cuentas: además del código de WhatsApp, cada
cuenta tiene CONTRASEÑA, se puede entrar con WhatsApp o con NOMBRE DE
USUARIO, se puede restablecer, y la dueña crea accesos para sus
trabajadoras según su plan.

MODELO: ritmo/ios/cuentas.html y su captura
ritmo/imagenes/app-ios-cuentas.png (rama claude/es-posible-esto-tjimmb,
último commit). El registro completo está en ritmo/ios/inicio.html
(4 pasos: cuenta, WhatsApp, código y salón).

1. REGISTRO EN 4 PASOS (salones nuevos), en este orden:
   1) «Crea tu cuenta»: usuario y contraseña (pantalla 1)
   2) Tu WhatsApp
   3) Código de 6 dígitos por WhatsApp
   4) «Crea tu salón»
   - Paso 1: usuario (se revisa en vivo que esté disponible),
     contraseña y repetirla, con el ojo para mostrarla, medidor y
     reglas en vivo: mínimo 8 caracteres, una letra y un número, que
     coincidan. Rechaza contraseñas muy comunes.
   - Usuario: único en toda la app, minúsculas, letras, números, punto y
     guion bajo, de 3 a 20 caracteres. Nunca se muestra a clientas.
   - La cuenta se crea SOLO al confirmar el código (paso 3). Antes, el
     usuario queda apartado 15 minutos y se libera si no se termina. La
     contraseña se queda solo en la memoria de la app hasta ese momento
     y entonces se manda a Supabase Auth; nunca la guardes en otro lado.
   - Un WhatsApp solo puede tener una cuenta.

2. INICIAR SESIÓN (pantalla 2)
   - Un campo «WhatsApp o usuario» y «Contraseña». Si escriben 10
     dígitos, es WhatsApp (+52); si no, es usuario.
   - «¿Olvidaste tu contraseña?», botón «Entrar» y, abajo, «Entrar con
     código de WhatsApp» (lo que ya existe) como otra opción.
   - Admin sigue pidiendo MFA después de la contraseña, igual que hoy.

3. RESTABLECER CONTRASEÑA (pantallas 3 y 4)
   - Escriben su WhatsApp o usuario. Si la cuenta tiene WhatsApp, llega
     un código de 6 dígitos (10 minutos) por el número de la plataforma.
     Con el código ponen la contraseña nueva.
   - Al cambiarla se cierran las sesiones en otros celulares.
   - Respuesta siempre igual exista o no la cuenta («Si la cuenta
     existe, te mandamos un código»), para no revelar quién está
     registrado.
   - Si la cuenta NO tiene WhatsApp (trabajadora), solo Admin puede
     darle una contraseña temporal nueva desde Equipo.

4. EQUIPO SEGÚN EL PLAN (pantallas 5 a 7)
   - Mi negocio → Equipo: barra «Plan Salón · 3 de 5 personas», lista
     con avatar, nombre, cómo entra (WhatsApp o usuario) y rol (Admin,
     Recepción, Especialista).
   - «Agregar persona» (hoja): nombre, usuario, WhatsApp opcional y rol.
     La app genera una contraseña temporal fácil de dictar (por ejemplo
     «Rosa-48-Luna»), con «Copiar» y «Enviar por WhatsApp». Este botón
     abre el WhatsApp de la dueña con el mensaje listo (wa.me); no sale
     por el número de la plataforma.
   - La temporal vence en 72 horas y obliga a cambiarla al primer
     inicio de sesión.
   - Sigue existiendo «Invitar por link» (lo que ya hiciste) para quien
     prefiera registrarse con su propio WhatsApp.
   - En la ficha de cada persona: cambiar rol, «Dar contraseña nueva» y
     «Quitar acceso» (corta todas sus sesiones al momento).
   - Límites del plan EN EL SERVIDOR: Solo 1 persona y 1 Admin, Salón 5
     personas y 2 Admin, Pro ilimitado. Al llegar al límite, mostrar
     «Tu equipo está completo» (pantalla 7) con «Ver Plan Pro» y
     «Administrar equipo». Nunca borres a nadie por bajar de plan:
     bloquea agregar más hasta que quede dentro del límite.
   - Durante la prueba de 30 días aplica los límites del plan elegido
     (Salón por defecto).

5. PRIMERA ENTRADA DE LA TRABAJADORA (pantalla 8)
   Entra con usuario y temporal → «Hola, Sofía»: quién le dio acceso y
   con qué rol, crea su contraseña, y ve qué podrá ver (su agenda sí;
   teléfonos de clientas ocultos; ingresos no), según la tabla de roles
   de CUENTAS.md.

SEGURIDAD (no negociable)
- Usa Supabase Auth para las contraseñas (nunca guardes contraseñas ni
  hashes propios). Para el usuario, resuélvelo en el servidor a la
  cuenta de Auth (por ejemplo, un correo interno no visible). La
  creación de trabajadoras va por la función aislada de Supabase con
  HMAC que ya usas; la llave Admin nunca sale de Supabase.
- Límite de intentos: 5 fallidos → espera de 15 minutos por cuenta y por
  IP, y Turnstile después del 3.º intento. Igual para pedir códigos.
- Mensajes de error genéricos («Usuario o contraseña incorrectos»).
- RLS igual que hoy: cada persona solo ve su salón y lo que su rol
  permite.
- Registra en el historial: altas, cambios de rol, contraseñas
  restablecidas y accesos quitados (quién y cuándo, sin contraseñas).

MIGRACIÓN
- Las cuentas que ya existen (la mía y la de la dueña) siguen entrando
  con código; la próxima vez que entren, la app les pide crear
  contraseña y usuario. No toques sus UUID, MFA ni salones.
- Migración aditiva, con respaldo y mi confirmación antes de aplicarla.

PRUEBAS
- Registro de 4 pasos en orden (cuenta, WhatsApp, código, salón); el
  usuario apartado se libera si no se confirma el código.
- Entrar con WhatsApp+contraseña, usuario+contraseña y con código;
  contraseña equivocada 5 veces → bloqueo.
- Restablecer con WhatsApp; respuesta igual para cuentas que no
  existen; sesiones viejas cerradas.
- Admin crea trabajadora, ella entra con la temporal, la cambia y solo
  ve lo de su rol; la temporal vencida no sirve; «Quitar acceso» corta
  la sesión.
- Plan Salón: la persona 6 se bloquea en el servidor aunque se llame a
  la API directo.
- 390 px en White y Dark, comparado con app-ios-cuentas.png.

Pídeme confirmación antes de la migración y de cada despliegue. Antes de
empezar, dime el plan y cuánto tardará.
```
