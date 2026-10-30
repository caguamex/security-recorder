# Registro Neutro iOS — revisión del 30 de octubre de 2026

Antonio confirmó que recibió el código real y pidió mejorar las ventanas de registro. La captura estaba en los datos del salón, después del OTP. Se consultó únicamente el estado de su cuenta: identidad de dueño reservada, teléfono confirmado y código usado; todavía no había terminado el registro ni configurado un factor verificado. No se concedieron permisos nuevos ni se modificaron sus datos.

## Comparación y alcance

El modelo de Claude está en `ritmo/ios/inicio.html` y `registro.html` de `claude/es-posible-esto-tjimmb`, actualizado a `a91beea`. El registro publicado heredaba el envoltorio de la hoja «Iniciar sesión»: check de cerrar arriba, «Cerrar sesión» entre los campos y dimensiones nativas en los inputs. Su composición no reproducía completamente el modelo aprobado.

Se conserva el flujo vigente de cuatro pasos, añadido con contraseñas: cuenta, WhatsApp, código y salón. La presentación ahora usa Agendappx como cabecera, avance visible incluso durante el código, título propio por paso, etiquetas sobre campos amplios de al menos 16 px de letra, botón principal único y estilos White/Dark existentes. Durante el registro se ocultan el check superior y los accesos secundarios que no corresponden. El último paso mantiene el plan y los precios existentes; no activa cobros ni cambia la vigencia de los planes. La protección MFA se conserva y tiene su propio título al finalizar.

Las clases se limitan a una raíz con `data-registro-paso`, que se elimina al completar el registro o volver al acceso. La hoja conserva desplazamiento vertical, áreas seguras y los controles de cerrar. No se añaden campos que el servidor no guarde. No se cambia el transporte OTP, su vigencia, CAPTCHA, contraseñas, sesiones, permisos, base de datos ni WhatsApp.

## Dueño de la aplicación

La identidad reservada en `ritmo.plataforma_admins` es la que puede entrar al Panel de Agendappx con MFA. No se concede propiedad a quien se registre primero ni a todos los Admin de un salón. El propietario debe completar personalmente sus datos y la verificación en dos pasos. El panel permite consultar los salones registrados; todavía no se ha declarado terminada esa prueba física. Los identificadores y el teléfono reales se conservan fuera de Git.

## Comprobación

- `npm test` en `ritmo/servidor`: 279 aprobadas. La ejecución inicial con restricciones del entorno no pudo utilizar correctamente los servidores locales; la ejecución con ese acceso permitido pasó completa.
- Recorrido en Edge: registro, OTP inicial con altas cerradas, contraseña, MFA, acceso normal, CAPTCHA por fallos, recuperación con MFA y contraseña temporal del equipo.
- El mismo recorrido comprueba el avance y la cabecera, los controles ocultos, campos amplios, tamaño de letra y ausencia de desbordamiento a 390 px en White/Dark. También revisa 320, 768 y 1440 px y el acceso al botón final mediante desplazamiento.
- Capturas locales en `imagenes/registro-neutro/`, exclusivamente con datos ficticios. El CAPTCHA mostrado en esas capturas es la sustitución del entorno de prueba, no una validación real.
- `dist/` y el SDK se regeneran desde las fuentes; no se editan a mano.

## Publicación

**Pendiente de la confirmación de Antonio después de revisar las capturas.** No se ha desplegado este cambio visual ni requiere migración, cambios en Railway o servicios nuevos. No se han solicitado códigos reales durante la prueba local ni modificado FiNeCi.
