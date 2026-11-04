# Revisión de alojamiento: FiNeCi y Ritmo

Consulta del 26 de octubre de 2026. Alcance: inspección de configuración y capacidad; no es una autorización de migración ni de gastos fuera del presupuesto vigente.

**Actualización posterior:** Antonio autorizó la migración a Cloudflare y la creación de un segundo proyecto Supabase Free dedicado a Ritmo. La migración y la detención específicamente aprobada de los dos despliegues anteriores de Ritmo están documentadas en [CLOUDFLARE.md](CLOUDFLARE.md). Los datos siguientes describen la inspección previa; el único proyecto visible de entonces no incluye el de Ritmo creado después.

## Arquitectura de referencia

El código de FiNeCi en `C:/Users/dellv/OneDrive/Desktop/financial-app` configura Vercel para la web/API, Turso/libSQL para los datos principales, Supabase PostgreSQL para Evolution y Railway para WhatsApp, Redis y tareas programadas. El proyecto Vercel es `financial-app`, en el equipo `caguamexs-projects`. El plan Hobby activo se confirmó en el panel de facturación el 26 de octubre.

## Supabase: confirmado mediante el conector

- Organización `caguamex's Org`: plan `free`, nivel `tier_free`.
- Un proyecto visible, `caguamex's Project`, activo y saludable, región `us-east-1`, PostgreSQL 17.
- Tamaño medido con `pg_database_size`: aproximadamente 197.47 MiB. Frente a la referencia publicada de 500 MB, ocupa alrededor del 39.5%; no equivale a una medición de tráfico ni de todas las cuotas.
- 37 tablas públicas; presentes las tres tablas de referencia de Evolution (`Instance`, `Message`, `Contact`). Solo se consultaron metadatos, sin leer conversaciones, contactos ni datos de clientes.
- Sin Edge Functions desplegadas y sin la extensión `pg_cron` instalada en el proyecto consultado.
- La documentación vigente indica dos proyectos gratuitos activos por propietario/administrador, 500 MB de base por proyecto y cuotas de transferencia y funciones compartidas por organización. Los proyectos Free pueden pausarse tras una semana de inactividad. Un proyecto visible no demuestra por sí solo que una nueva creación vaya a ser aceptada ni que todas las cuotas estén disponibles.

## Vercel: acceso y cuotas confirmados

El primer intento devolvió 403 por falta de autorización del equipo. Antonio completó el enlace de acceso; las consultas del equipo y del proyecto ya funcionan con la misma conexión. No necesita volver a conectar ni autorizar el equipo para esta revisión.

La API confirma el proyecto `financial-app`, dominio `financial-app-mocha-eight.vercel.app`, con despliegue de producción `dpl_3vGHbSC3mH78FCotNA23dP6WD51K` en estado READY. El campo `live: false` que devuelve el resumen no sustituye ese estado ni demuestra una caída del sitio.

El conector devuelve información resumida del equipo sin el plan. Su consulta de cargos devuelve `costs_not_found`; eso no acredita una factura de cero. La consulta de estado de Rolling Releases indica que el plan no admite esa función; no se usó como única evidencia del nombre del plan.

Se completó la verificación de solo lectura en el navegador integrado, con la sesión de Vercel ya iniciada por Antonio:

- Facturación: **Hobby Plan, Active**. No es una suscripción Pro.
- Consumo del equipo completo en la ventana visible de últimos 30 días (26 de septiembre a 26 de octubre): CPU activa **3 h 13 min / 4 h**, aproximadamente **80.7%** utilizada; memoria **40.1 / 360 GB-h**; invocaciones **180,542 / 1,000,000**; solicitudes CDN **196,412 / 1,000,000**; transferencia CDN **919.03 MB / 100 GB** y transferencia de origen **629.33 MB / 10 GB**.
- Son métricas del equipo y una ventana móvil; no son una proyección del consumo de Ritmo ni evidencia de cuota libre garantizada para otro backend. No afirmar que quedan 47 minutos en un ciclo de facturación determinado.
- El panel indica cero invocaciones de Vercel Cron en esa ventana, coherente con la programación externa documentada de FiNeCi.

No se pulsaron botones de contratación, actualización, tarjetas, complementos o cambios de presupuesto.

## Viabilidad para Ritmo

Vercel puede alojar el frontend y la API Node; Supabase es compatible con el repositorio PostgreSQL existente. Conservar PostgreSQL evita la conversión a SQLite que requeriría Cloudflare D1. Esto confirma compatibilidad técnica, no costo cero ni una migración ya realizada.

Con el plan Hobby y aproximadamente el 81% de su cuota de CPU ya utilizada, no se recomienda añadir el backend comercial del salón al equipo bajo la premisa de gratuidad. La alternativa de ahorro a evaluar es Cloudflare para los archivos y la API, con un proyecto Supabase Free separado para los datos, o Supabase Edge Functions para la API y las tareas. Antes de mover producción deben confirmarse compatibilidad, cuotas compartidas y continuidad del servicio. No se autorizó contratar Vercel Pro ni Supabase Pro.

Antes de migrar:

1. El plan actual de Vercel ya está confirmado como Hobby: considerar su restricción a uso personal no comercial y la cuota de CPU indicada. No activar Pro ni otro plan sin autorización específica de costo.
2. Preferir datos de Ritmo aislados en un proyecto gratuito separado, si la cuenta permite crearlo sin costo. No escribir las tablas de Ritmo dentro del proyecto de WhatsApp ni modificar FiNeCi como parte de esta revisión.
3. Usar una conexión PostgreSQL con pool y TLS verificado, credenciales solo en servidor y tablas fuera de la exposición pública o protegidas correctamente. No copiar secretos a Git ni al navegador.
4. Adaptar el arranque Node a la ejecución de Vercel, conservar API y frontend bajo el mismo origen y mantener la autenticación actual.
5. Sustituir el `setInterval` actual de cinco minutos por un disparador programado duradero y autenticado. Supabase Cron/Edge Functions es una posibilidad documentada; aún no está configurado. No asumir que un temporizador de proceso siga ejecutándose en Vercel.
6. Respaldar y migrar los datos de Ritmo; verificar versiones, cursor, eliminaciones, idempotencia, calendario privado y modo sin conexión. Prever los datos pendientes locales al cambiar de dominio.
7. Verificar el destino antes de proponer retirar los servicios dedicados de Ritmo en Railway. No cancelar servicios existentes por iniciativa de ahorro ni tocar recursos de FiNeCi.

El presupuesto vigente sigue siendo como máximo 10 USD por ciclo en Railway, compartido con los proyectos existentes. Esta revisión no activa recursos, planes, migraciones ni envíos de WhatsApp.

## Fuentes

- [Supabase: precios y cuotas](https://supabase.com/pricing).
- [Supabase: facturación por organización](https://supabase.com/docs/guides/platform/billing-on-supabase).
- [Supabase: tareas programadas](https://supabase.com/docs/guides/functions/schedule-functions).
- [Vercel: plan Hobby](https://vercel.com/docs/plans/hobby).
