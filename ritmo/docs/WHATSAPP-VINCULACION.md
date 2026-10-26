# Vinculación de WhatsApp de Agendappx

Implementación autorizada por Antonio el 26 de octubre de 2026: código de ocho caracteres, mensajes desde ese número, sesión persistente y pronóstico de consumo. Se conserva la etapa de cuentas como requisito. La aplicación publicada y FiNeCi no se han modificado.

## Entrega preparada y alcance real

- Rama `codex/agendappx-whatsapp-vinculacion`, basada en `codex/agendappx-cuentas-equipo`. Revisión separada y dependiente de terminar cuentas.
- Ajustes → Automatización de WhatsApp → Vincular WhatsApp, con campo de número, código temporal, estado del número verificado, Recuperar conexión y Desvincular con confirmación. Conservar White/Dark, cinco temas, áreas seguras, fotos, sincronización y avisos de actualización.
- Solo Admin con sesión Supabase vigente y `aal2`. No se admite APP_TOKEN. Identidad y salón se comprueban en servidor y RLS, independientemente de lo que diga la pantalla.
- Cada salón utiliza `agendappx_<uuid_sin_guiones>`. Nunca una instancia, clave o servicio de FiNeCi.
- **Habilitación cerrada por defecto**: `WHATSAPP_SALONES_HABILITADOS` permite expresamente cada salón tras revisar su costo. Registrarse como dueña no crea automáticamente más conexiones facturables.
- Códigos solo en memoria de la hoja, sin localStorage, base ni CacheStorage. Copiar actúa únicamente al pulsar el botón del Admin y entrega el código sin guiones. Se retiran al cerrar, cambiar cuenta, perder permisos o verificarse la conexión. Se muestran como máximo dos minutos; eso es el límite de visualización de la app, no una promesa sobre la caducidad de WhatsApp.
- Tres solicitudes por cinco minutos y una sola operación simultánea por salón. Ningún sondeo de estado regenera códigos.
- Webhook de conexión con clave propia por salón, nombre de instancia comprobado y eventos repetidos/atrasados ignorados. No usa las firmas de Meta como si fueran de Evolution.
- Vincular **no envía mensajes**. `enviosActivados: false` permanece explícito. La cola de recordatorios, anticipos, respuestas de clientas y comprobantes de la especificación siguen como la etapa siguiente a cuentas. No afirmar que esa automatización está terminada.

## Integración de las cuentas pendiente

El componente llama `window.AgendappxCuentas.sesion()`, que debe devolver `{ usuarioId, negocioId, accessToken, rol, aal }` desde el SDK y el perfil validado, y escuchar el evento `agendappx:sesion` al cambiar o cerrar cuenta. Ese puente y el acceso OTP/MFA completo todavía forman parte del PR de cuentas. Sin él, la hoja queda bloqueada y pide iniciar sesión como Admin; no hay cuenta simulada ni permisos por defecto en producción.

Activación del Worker, solo después de terminar cuentas y aprobar el despliegue:

- `AGENDAPPX_CUENTAS_HABILITADAS=true`
- `WHATSAPP_PROVEEDOR=evolution`
- `WHATSAPP_REMITENTE=railway` (desactiva el envío viejo desde Cloudflare)
- `WHATSAPP_SALONES_HABILITADOS=<uuid_del_salon_aprobado>`
- `SUPABASE_URL` del proyecto actual
- Secretos `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_KEY` nuevos y exclusivos; jamás copiar los de FiNeCi.

Rutas: GET `/api/negocios/<uuid>/whatsapp`; POST al mismo prefijo con `/codigo`, `/recuperar` o `/desvincular`; POST `/webhooks/evolution/<uuid>` para los eventos autenticados de conexión. Las respuestas privadas usan `no-store`.

## Cómo se reduce la pérdida de sesión

1. El proveedor permanece encendido con una réplica y suspensión por inactividad desactivada. Es distinto del mensajero que corre cada cinco minutos y termina.
2. Credenciales de dispositivo y claves de sesión se guardan en PostgreSQL, en el esquema privado `agendappx_evolution`, con rol propio y TLS verificado. Redis no es un requisito para esta configuración: caché local para datos temporales, `CACHE_REDIS_SAVE_INSTANCES=false` y `DATABASE_SAVE_DATA_INSTANCE=true` para conservar la sesión en la base.
3. `DEL_INSTANCE=false`; no borrar ni recrear instancias ante timeout, respuesta incompleta o servidor ocupado. Crear solo después de un 404 JSON comprobado del proveedor y solicitud explícita del Admin; un 404 del proxy/infraestructura no cuenta. Una conexión previamente vinculada que desaparece tampoco se recrea por pedir otro código: exige revisar su recuperación o una desvinculación deliberada.
4. Recuperación progresiva de 30 segundos a cinco minutos. La recuperación usa `restart` y conserva claves; cuando WhatsApp revoca la sesión se solicita vinculación humana. La recuperación complementaria del mensajero sin la app abierta se integra en la siguiente etapa; Evolution mantiene su propia reconexión nativa.
5. Un custodio en PostgreSQL impide abrir dos motores sobre la misma sesión. Una publicación nueva pide salida ordenada al anterior y espera su liberación. Una concesión vencida pierde autoridad y un error de base detiene el motor; no se ejecuta `logout` por un reinicio de infraestructura.
6. SIGTERM se transmite al proceso, con hasta 25 segundos para cerrar. Los logs del motor no se trasladan en bruto para evitar exponer códigos, mensajes o claves.
7. Una respuesta antigua no deshace una desvinculación o una operación posterior. Desvincular requiere confirmación y pausa la recuperación.

Estas medidas reducen cortes evitables; no pueden impedir que WhatsApp cierre/revoque una sesión, que se elimine el dispositivo desde el teléfono ni una caída de proveedor/red/base. No prometer una sesión que nunca se desvincula.

## Proveedor corregido y reproducción

No usar la imagen 2.3.7 original: incluye Baileys rc.9 afectado por GHSA-qvv5-jq5g-4cgg. Se preparó la base libre 2.3.7 (commit `cd800f2976e1e5b682fbf86a01ee4d85ae61f370`) con Baileys **7.0.0-rc13** y lockfile actualizado. El código fuente conserva su licencia y atribución visible en Ajustes y en esta documentación.

Referencia y checksum en `railway/evolution/fuente-validada.json`; manifiestos reproducibles `proveedor-package*.json`; Dockerfile con fuente y Node fijados por hash. La compilación TypeScript y empaquetado del proveedor actualizado pasaron en Node 24.22.1, sin iniciar el motor, conectar un número o acceder a una base real. Se descartó la rama de desarrollo actual porque introduce activación/registro externo: no se eliminó ni se sorteó ese control; se utiliza la base libre anterior con actualización de dependencia.

**Pendiente** construir y arrancar el contenedor Linux: Docker no está disponible en este entorno. Tampoco se ha probado el ciclo de vinculación/reinicio de un número real ni la recepción continua de WhatsApp. Validarlo antes de considerar listo un despliegue estable. Las pruebas del custodio son con PostgreSQL local y no equivalen a esa prueba de teléfono.

## Secretos y preparación del servicio (sin ejecutarse)

- Proyecto propio de Railway; proveedor dedicado a Agendappx. No modificar servicios, claves ni instancias de FiNeCi.
- Archivo de configuración `railway/evolution/railway.json`: una réplica, sin suspensión, sin solapamiento adicional, 30 segundos de drenado y reinicio solo por fallo. Sin volúmenes nuevos ni dominio comprado.
- La migración `*_evolution_privado.sql` solo crea un rol **NOLOGIN** y su esquema, sin contraseña. La de cuentas y `*_whatsapp_vinculacion.sql` siguen sin aplicarse. Ninguna se aplica sin respaldo y aprobación de Antonio.
- Tras esa aprobación, proporcionar una contraseña nueva al rol fuera de Git y habilitar LOGIN. El rol del proveedor no recibe acceso a `ritmo`; la API de la app no recibe acceso al esquema de credenciales del dispositivo.
- `DATABASE_CONNECTION_URI` del proveedor: rol `agendappx_evolution` y esquema del mismo nombre, proyecto `zkqwephmuflbuagevvxj`, `sslmode=require&sslaccept=strict&connection_limit=2`. Preferir el pooler de Supabase según su compatibilidad comprobada con Prisma. No desactivar validación de certificado.
- Solo Railway: `AUTHENTICATION_API_KEY` nuevo, `DATABASE_CONNECTION_URI`, `SERVER_URL` HTTPS del servicio, `AGENDAPPX_ACTIVAR_EVO=true` después de autorización y `TZ=America/Mexico_City`.
- El custodio rechaza proyecto, rol o esquema ajenos, dependencias distintas a la corregida y activación ausente. El transporte del custodio usa `rejectUnauthorized:true`.
- Generar y guardar secretos en Railway/Cloudflare o el directorio privado local; nunca pegarlos en Git, chat, capturas o enlaces.

## Pronóstico de consumo

Consulta de Railway de solo lectura el **26 de octubre de 2026**: consumo 1.2089 USD; proyección actual de recursos 2.2571 USD; ciclo 14 de octubre–14 de noviembre; aviso en 5 USD y tope compartido de 10 USD. No se modificó ningún límite. Registro sin claves ni identificadores privados en `railway/evolution/consumo-observado.json`.

Se reemplaza la aproximación anterior de 3 USD de base por la proyección real de **2.26 USD**, usada como referencia conservadora para un periodo nominal de 30 días. No es una garantía de que el consumo de FiNeCi y los volúmenes existentes se mantenga igual en ciclos futuros.

Tarifas: RAM 10 USD/GB/mes, CPU 20 USD/vCPU/mes y salida 0.05 USD/GB. Hobby incluye 5 USD de consumo: la factura base es `max(5, consumo total)`, antes de impuestos y otros cargos. No sumar otros 5 USD al consumo completo.

| Escenario de 30 días | Conexión permanente | Mensajero | Consumo conjunto proyectado | Factura estimada antes de impuestos |
|---|---:|---:|---:|---:|
| Ligero | 1.50 USD | 0.22 USD | 3.97 USD | 5.00 USD |
| Intermedio | 2.95 USD | 0.22 USD | 5.42 USD | 5.42 USD |
| Alto | 5.65 USD | 0.83 USD | 8.74 USD | 8.74 USD |
| Excesivo | 8.55 USD | 0.83 USD | 11.64 USD | supera el tope |

Supuestos del proveedor: 0.125/0.25/0.5/0.75 GB medios de RAM y 0.01/0.02/0.03/0.05 vCPU medios, más 1 GB de salida. Mensajero: 8,640 ejecuciones, de 10 segundos con 0.25 GB y dos segundos de CPU efectiva, o 30 segundos con 0.5 GB y cinco de CPU en los escenarios altos. **Son supuestos, no una medición de un WhatsApp conectado.** El generador verificable es `herramientas/pronostico-whatsapp.mjs`.

El escenario intermedio representa unos **0.42 USD adicionales de factura** respecto al mínimo Hobby de 5 USD, aunque consume 3.17 USD adicionales de recursos. En el primer ciclo, al activarse a mitad del periodo, el consumo nuevo sería proporcional al tiempo que quede; no proyectar un mes completo como si ya estuviera encendido desde el día 14.

Reservar **2 USD** para fluctuaciones/impuestos y recursos no previstos; usar 8 USD de consumo conjunto como umbral operativo conservador. El escenario alto no se recomienda aunque quepa nominalmente antes de impuestos. No activar ni ampliar recursos con costo incierto. Primero comprobar memoria real de arranque y reposo, CPU y proyección del espacio de trabajo; no recortar memoria hasta provocar reinicios solo para aparentar ahorro.

R2/comprobantes y otros proveedores no están incluidos ni activados. El rol, el esquema y las credenciales de la sesión se preparan en Supabase Free existente, sin contratar un nuevo plan. La facturación real depende del uso; el tope de Railway es compartido y agotarlo también puede afectar FiNeCi, por lo que no se modifica ni se usa como sustituto de una previsión conservadora.

## Verificaciones

- `npm test --prefix ritmo/servidor`: **132 pruebas aprobadas**, incluidos JWT, RLS, invitaciones, vinculación, solicitudes concurrentes, límites y custodia de sesión.
- Navegador → API real → JWT/RLS → PostgreSQL local, con proveedor Evolution simulado. Código temporal, sondeo sin regeneración, fallos de red, cierre/cambio de sesión, confirmación de salida y White/Dark en 390/768/1440.
- Capturas `imagenes/whatsapp-vincular-codigo.png` y `whatsapp-vinculado.png`: son **vistas locales con datos simulados**, no una vinculación real.
- Regresiones completas de navegador aprobadas: agenda y caché sin conexión, fotos y sincronización entre dispositivos, cinco temas por White/Dark y aviso de nueva versión con borradores protegidos.
- `npm run build --prefix ritmo/nube`: paquete Cloudflare en `--dry-run`, sin despliegue.
- Compilación local de la base libre del proveedor con Baileys corregido, sin iniciar WhatsApp.

## Pendientes antes de publicar

Terminar cuentas/OTP/MFA y su puente de sesión; integrar el mensajero, cola e idempotencia de envíos con anticipo y comprobantes; construir y comprobar el contenedor Linux, TLS negativo, recuperación con una sesión real y consumo observado; revisar presupuesto; respaldar y pedir confirmación de migraciones. Después pedir confirmación de despliegue y, por separado, del primer mensaje real con destinatario. No activar todo solo porque este código ya esté en GitHub.

Fuentes primarias:
- https://github.com/WhiskeySockets/docs/blob/main/authentication/pairing-code.mdx
- https://github.com/WhiskeySockets/Baileys/security/advisories/GHSA-qvv5-jq5g-4cgg
- https://github.com/evolution-foundation/evolution-api/tree/cd800f2976e1e5b682fbf86a01ee4d85ae61f370
- https://github.com/evolution-foundation/evolution-api/blob/cd800f2976e1e5b682fbf86a01ee4d85ae61f370/LICENSE
- https://docs.railway.com/pricing/plans
- https://railway.com/railway.schema.json
