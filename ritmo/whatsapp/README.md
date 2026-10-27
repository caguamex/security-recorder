# WhatsApp de Agendappx: servicio de solo envíos

Implementación preparada en el PR #3. No está desplegada ni vinculada a un teléfono. La biblioteca fijada es `baileys@7.0.0-rc13`, de la familia que usa FiNeCi mediante Evolution; no comparte su infraestructura. El servicio hace conexión, custodia y envío en un proceso. No necesita Redis, volumen, cron aparte ni Meta.

## Verificación local

Desde la raíz del repositorio, Node 24:

```powershell
npm ci --prefix ritmo/servidor
npm ci --prefix ritmo/whatsapp --ignore-scripts
npm test --prefix ritmo/servidor
$env:BROWSER_CHANNEL='msedge'
npm run test:whatsapp --prefix ritmo/servidor
npm run build --prefix ritmo/nube
```

El último comando solo empaqueta (`--dry-run`). Las pruebas usan PostgreSQL local, JWT firmados de prueba, el SDK real de Supabase y transporte simulado: ningún número recibe mensajes y no se abre un socket real de WhatsApp. La imagen Linux no pudo construirse aquí porque Docker no está instalado; debe comprobarse en el despliegue autorizado antes de habilitar vinculación/envío. La estabilidad con un teléfono real requiere esa prueba posterior; no prometer que WhatsApp nunca cerrará una sesión.

## Arquitectura y protección

- `servidor/src/whatsapp-vinculado/`: reglas, cola durable, API por salón, cifrado y proxy.
- `whatsapp/`: proceso Node, Baileys y definición de Railway.
- Cada conexión tiene una custodia de 45 s renovada cada 10 s y un número de generación. Otro proceso no puede abrir ni modificar esa sesión mientras la custodia sea vigente. Al perderla, se detiene el socket sin cerrar la sesión del teléfono.
- Credenciales y claves Signal se cifran por salón con AES-256-GCM, nonce aleatorio y AAD. Los identificadores se ocultan con HMAC. Una llave errónea detiene el servicio y conserva el cifrado. Respaldar la llave fuera de Git; cambiarla sin recifrado invalida el acceso.
- Solo se suscribe a conexión y credenciales. La configuración de Baileys descarta nodos entrantes de chats antes de descifrarlos/procesarlos y rechaza sincronizar historial; los ACK de protocolo no son marcas de leído. No hay listeners de mensajes, contactos ni historial, tampoco bot, webhook receptor o `readMessages`.
- Los envíos se reservan antes de tocar la red. `aceptado` significa aceptación del transporte, no entrega/lectura. Un resultado incierto o un proceso interrumpido no se reenvía automáticamente.
- Consentimiento, cita vigente, teléfono, horario y vinculación se comprueban antes y después de escribir 2–5 s. Pausas persistentes de 20–60 s, máximo 30/h, 150/día y 600/mes por número; silencio 21–08 CDMX.
- Los errores 401/403/429 dejan un freno persistente. El Admin debe revisarlo y reanudar expresamente. Desconexión superior a diez minutos genera aviso en la app; reconectar conserva credenciales y usa esperas progresivas de 30 s a 5 min.
- Anticipo predeterminado 20 %, servicios desde $300, pago manual confirmado por Admin o Recepción. Adjuntar foto no confirma. Vencer genera aviso y conserva el horario. El monto acordado se conserva al editar una cita; no recalcular un pago retroactivamente.

## Dependencia mínima de acceso

El control de WhatsApp exige JWT firmado de Supabase, sesión vigente, membresía y Admin con TOTP. Las especialistas no pueden consultar vinculación, CLABE o comprobantes. No usar APP_TOKEN, el enlace de activación heredado, roles del navegador ni una cuenta de FiNeCi.

Como Brevo no está verificado, se prepara un acceso temporal del propietario mediante enlace privado de un uso generado por el operador de Supabase, sin enviar correo/SMS. Luego se configura la app de autenticación y se comprueba aal2. Esto no declara terminado el encargo completo de cuentas/registro/equipo ni reemplaza su flujo de correo aprobado.

Herramienta privada, solo después de la aprobación de Antonio para la preparación de su cuenta y migración:

```powershell
node ritmo/herramientas/acceso-admin.mjs --autorizado --secretos <JSON-absoluto-fuera-del-repo> --salida <archivo-privado-nuevo>
```

El JSON privado contiene `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. Esta llave de administración solo se usa para generar el acceso; no se carga en Cloudflare, Railway ni navegador. La herramienta fija el correo aprobado `antonio.t.22@hotmail.com`, no imprime enlace/claves ni concede membresías. El archivo resultante contiene el UUID para la migración y el enlace para el dueño.

La app tiene caché y cola separadas por usuario, salón, rol y nivel MFA; no mezcla automáticamente datos locales heredados con cuentas. La API de datos usa RLS y filtra teléfonos desde servidor. La migración conserva los registros sincronizados y el calendario privado del dueño. Cada persona obtiene después su feed revocable; el feed comprueba que siga teniendo acceso y no incluye teléfonos, notas, pagos ni comprobantes.

## Pasos de producción, pendientes de autorización

1. Confirmar con Antonio **migración y publicación**, indicando el acceso nuevo. Comprobar que su celular sincronizó y exportar sus cambios pendientes sin resolver conflictos automáticamente. Preparar respaldo privado actualizado y verificable de las tablas, integraciones, versiones y revisiones.
2. Verificar que se usa exclusivamente Supabase `zkqwephmuflbuagevvxj`, Free. Preparar el Admin aprobado por enlace privado y su UUID. Deshabilitar temporalmente escrituras del origen al tomar el respaldo final.
3. Aplicar solamente `20261026182501_cuentas_equipo.sql` y `20261027073419_whatsapp_solo_envios.sql`, con los parámetros de autorización, salón y Admin. No aplicar las migraciones históricas de Evolution ni borrar la cola anterior. Los scripts deben aplicarse en un mantenimiento controlado: el primero incluye BEGIN/COMMIT. Conservar respaldo y plan de reversión, sin volver a publicar el backend heredado sobre el esquema nuevo.
4. Comprobar conteos, versiones, datos, permisos y feed heredado. El rol nuevo se crea NOLOGIN; habilitar un acceso exclusivo `agendappx_whatsapp` con contraseña aleatoria privada, sin membresía de roles, SUPERUSER ni BYPASSRLS. El proceso comprueba sus privilegios al arrancar y rehúsa escribir en las tablas fuente de la agenda.
5. Consultar consumo y proyección de Railway. Crear el proyecto separado y un solo servicio `agendappx-whatsapp`; seleccionar este repositorio, raíz de construcción del repositorio y configuración `ritmo/whatsapp/railway.json`. Una réplica, sin suspensión, recursos contenidos dentro del presupuesto compartido de 10 USD. No enlazar despliegue automático de Git sin aprobación para futuras publicaciones. No modificar FiNeCi ni reactivar Belleza/Datos.
6. Cargar `.env.example` como referencia de nombres, con valores privados reales solo en Railway. `DATABASE_URL` usa el rol nuevo y TLS verificado (directa o pooler de sesión). `WA_SESSION_KEY`: 32 bytes aleatorios en base64, solo Railway. `WHATSAPP_SALONES_HABILITADOS`: UUID del salón aprobado. Inicialmente `WA_VINCULACION_HABILITADA=false` y `WA_ENVIOS_HABILITADOS=false`. `WA_ACTIVAR_SERVICIO=true` únicamente tras aprobar el despliegue.
7. Construir imagen, comprobar salud y logs sin datos privados. En Cloudflare configurar `AGENDAPPX_CUENTAS_HABILITADAS=true`, `SUPABASE_URL`, **solo** `SUPABASE_PUBLISHABLE_KEY`, `WHATSAPP_SALONES_HABILITADOS`, `WA_SERVICIO_URL` HTTPS y `WHATSAPP_REMITENTE=vinculado`. PUBLIC_URL debe ser el origen sin barra final en el Worker. Conservar nombre y URL de infraestructura. La bandera apaga cron y webhook Meta.
8. Publicar Cloudflare con autorización; verificar acceso, actualización de PWA, calendario, fotos, modo sin conexión y no exposición de agenda a visitantes. Entregar acceso privado al dueño y completar TOTP en su dispositivo. No guardar el enlace en Git ni en capturas públicas.
9. Solicitar confirmación específica para **vincular su número**. Solo entonces habilitar `WA_VINCULACION_HABILITADA`; Admin usa Ajustes → Mensajes de WhatsApp, genera el código e introduce los ocho caracteres en WhatsApp → Dispositivos vinculados. No pedir códigos del teléfono en el chat.
10. Solicitar confirmación del **primer mensaje real**, número destinatario y consentimiento. Habilitar primero `WA_DESTINATARIOS_PRUEBA` con ese número y `WA_ENVIOS_HABILITADOS=true`. Validar una cita real acordada y no activar una tanda histórica por accidente. Ampliar el envío solo al alcance confirmado.
11. Registrar ID/fecha real del despliegue, proyección y límites. El seguimiento existente entregará el informe de consumo tras siete días reales encendido; no contarlos desde este documento. Al terminar la prueba, conservar el estado de los interruptores autorizado por Antonio.

El enlace privado es temporal y sensible. Cerrar sesión no borra la cola local de esa cuenta. La eliminación de una vinculación sin red conserva la sesión cifrada y detiene los envíos; cerrar el dispositivo en el teléfono y confirmar en la app permite retirar la sesión guardada. No regenerar credenciales para ocultar errores de conexión.
