# Lanzamiento de Agendappx

Todo está en la rama principal `claude/es-posible-esto-tjimmb`: los PR #1 a #26 (lo que hoy está en producción) más `claude/agendappx-lanzamiento`. Los PR #2 a #26 se cerraron el 9 de noviembre de 2026 porque ya estaban incluidos; #5 y #8 quedaron reemplazados por trabajo posterior.

## Qué se agregó

1. **Aviso de privacidad y términos de uso**: `/privacidad/` y `/terminos/`, con enlaces en el registro, en «Pedir cita», en el Perfil de Comunidad y en Mi negocio.
   - Los datos del responsable salen de `belleza/legal/datos.json`: nombre o razón social, domicilio, correo y ciudad. No son secretos.
   - Si el archivo está vacío, el empaquetado avisa «faltan datos legales» y las páginas muestran los campos entre corchetes. **No abrir al público así.**
2. **Cobro por transferencia** (sin tarjeta y sin cargos automáticos):
   - El salón entra a Mi plan → «Pagar por transferencia», elige plan y periodo, y ve el banco, la CLABE, el titular, el monto y una referencia `AGX-XXXXXX`. Luego avisa «Ya transferí», con una nota opcional.
   - Antonio ve «Pagos por confirmar» en su panel. «Confirmar pago» activa el plan por un mes o un año, contado desde el final de la prueba o del periodo anterior. «Rechazar» pide un motivo, que el salón ve.
   - Hay 3 días de gracia después de vencer. Sin pago, el salón queda en pausa y conserva sus datos.
   - Los precios se calculan en el servidor: Solo $249, Salón $449 (fundadora $199) y Pro $799; el anual cuesta 10 meses.
   - Se enciende solo cuando la CLABE es válida (18 dígitos con dígito verificador), con las variables de Cloudflare `COBRO_CLABE`, `COBRO_BANCO` y `COBRO_TITULAR`. Sin ellas, todo sigue como hoy.
   - Migración aditiva: `20261109120000_cobros_transferencia.sql`.

Pruebas: 296/296, más `pagos-navegador.mjs`, `planes-etapa3-navegador.mjs`, `plataforma-navegador.mjs` y `contrasenas-navegador.mjs` en Chromium. Capturas en `imagenes/pagos-transferencia/`.

## Prueba física de Antonio (antes de invitar salones)

En tu iPhone, con «Actualizar ahora» si aparece:

1. **Registro real**: crea un salón de prueba con usuario y contraseña → WhatsApp → código → datos del salón. Revisa que lleguen el código y el enlace del salón.
2. **Entrar**: sal y entra con el usuario, luego con WhatsApp.
3. **Restablecer**: «¿Olvidaste tu contraseña?» con el código de WhatsApp.
4. **Equipo**: crea el acceso de una persona con contraseña temporal y entra con ella en otro teléfono.
5. **Cliente**: desde Comunidad, como visitante, pide una cita al salón de prueba y confírmala desde Hoy.
6. **Tu panel**: entra con tu WhatsApp, revisa las cifras y activa «Avisarme en este celular».
7. **Código manual**, con tu permiso a Codex: desconecta el WhatsApp de códigos, pide un código, te llega el aviso, lo envías desde el panel y entras.
8. **Pago**, cuando Codex configure tu CLABE: en el salón de prueba paga $1 por transferencia… o márcalo y recházalo para ver los dos casos.
9. **Legales**: abre `/privacidad/` y `/terminos/` y revisa que aparezcan tus datos.
10. Si todo sale bien, borra el salón de prueba desde el panel o pídeselo a Codex.

## Mensaje para Codex

```
Hola Codex. Claude preparó lo que falta para abrir Agendappx al público.
NO lo vuelvas a hacer: revísalo y publícalo conmigo, paso por paso.

RAMA: claude/es-posible-esto-tjimmb (la principal). Ya contiene toda
la cadena #1–#26 (lo publicado) y lo nuevo de claude/agendappx-lanzamiento.
Los PR #1–#26 están cerrados o unidos. Publica desde la rama principal y
parte de ahí tus ramas nuevas, con PR hacia la principal, sin cadenas.
Lee ritmo/docs/LANZAMIENTO.md.

INCLUYE
1. Aviso de privacidad y términos (/privacidad/, /terminos/) con
   enlaces en registro, Pedir cita, Perfil de Comunidad y Mi negocio.
2. Cobro por transferencia: Mi plan → CLABE + referencia → «Ya
   transferí» → yo confirmo en el panel → plan pagado 1 mes o 1 año.
   Migración 20261109120000_cobros_transferencia.sql (aditiva).

PASO 1 · PROBAR (sin publicar)
- cd ritmo/servidor && npm ci && (cd ../whatsapp && npm ci) && npm test
  → 296/296.
- node pruebas/pagos-navegador.mjs, planes-etapa3-navegador.mjs,
  plataforma-navegador.mjs y contrasenas-navegador.mjs (Edge y WebKit).
- Revisa el diff con ojo de seguridad.

PASO 2 · DATOS QUE TE DOY YO (no son secretos)
- belleza/legal/datos.json: responsable, domicilio, correo y ciudad.
  Regenera dist/ y confirma que el empaquetado ya no avisa
  «faltan datos legales».
- Variables de Cloudflare COBRO_CLABE, COBRO_BANCO y COBRO_TITULAR
  (te las paso por el chat de Cloudflare, no en Git).

PASO 3 · PUBLICAR (pídeme confirmación ANTES de cada punto)
a) Respaldo de la base.
b) Migración 20261109120000_cobros_transferencia.sql. Revisa que
   negocios_planes conserve sus filas y que los salones legado sigan
   igual.
c) Worker con --keep-vars y las tres variables COBRO_*.
d) Comprueba /privacidad/ y /terminos/ en producción, y Mi plan con
   «Pagar por transferencia».

REGLAS
- No toques FiNeCi.
- No pongas en pausa ningún salón real.
- Si algo falla, detente y dime.
- Para apagar los cobros, borra COBRO_CLABE. La tabla puede quedarse.
```

## Dominio propio (pendiente de Antonio)

Recomendado: `agendappx.mx` o `agendappx.com`. Cómpralo en Cloudflare Registrar (precio de costo, unos $200–$400 MXN al año) para que quede en la misma cuenta que el Worker. Después, Codex agrega la ruta personalizada al Worker y cambia `PUBLIC_URL`. Las sesiones actuales del dominio `workers.dev` no pasan solas al dominio nuevo: cada persona vuelve a entrar una vez.
