# Intermediario privado de registro

Función del proyecto Supabase dedicado zkqwephmuflbuagevvxj. Su única operación es preparar un teléfono con Auth Admin, sin confirmarlo ni modificar cuentas existentes. La credencial interna de Admin nunca sale de esta función. No manda códigos: el Send SMS Hook existente entrega después por WhatsApp.

Se publica con verify_jwt=false y autenticación HMAC propia obligatoria antes de cualquier llamada a Auth. REGISTRO_OPERACION_KEY: secreto aleatorio de 32 bytes/base64, compartido solo con el Worker. Se verifica firma de cuerpo completo, propósito fijo y fecha con máximo sesenta segundos. Sin CORS, sin roles/metadatos/correos/contraseñas en el payload, sin logs de contenido. Los límites, consentimiento, invitación y Turnstile se comprueban primero en el Worker. La cuenta no obtiene membresía hasta verificar teléfono y completar los requisitos del rol.

Fuente operativa: ../../../docs/REGISTRO-WHATSAPP.md. No desplegar ni aplicar migraciones sin confirmación específica. Tests: servidor/pruebas/registro-whatsapp.test.mjs.
