# Planes y Mi plan — etapa 3

Rama codex/agendappx-planes-etapa3 desde aaf60f4 del PR #13. Publicación autorizada por «Publica todas las etapas»; la migración nueva se pregunta por separado. NO aplicar hasta la confirmación específica. No hay pasarela, token bancario, cobro, suscripción pagada ni API para activar pagos.

## Comportamiento

- Planes aprobados: Solo 249, Salón 449 (recomendado), Pro 799 MXN al mes, IVA incluido. Anual cuesta diez mensualidades por doce meses de referencia. La UI usa el precio anual exacto y muestra su equivalente; no registra un contrato ni cargo.
- Cupos de fundadora reales y serializados en servidor: primeros veinte salones por orden de alta, 199 MXN/mes para Salón cuando se habiliten cobros. No copiar el ejemplo de trece lugares del prototipo. El número asignado es único y nunca vuelve a ofrecerse por cambiar de plan. El contador público solo expone el total disponible, sin datos de negocios.
- Los accesos existentes se registran como legado: sin caducidad nueva ni cambios de sus permisos, equipo, citas o sincronización. No convertir al propietario en una prueba vencida ni asignarle una suscripción de pago.
- Nuevos salones reciben treinta días exactos, sin tarjeta. Elegir otro plan no reinicia el plazo. Al vencer se conservan las lecturas y todos los datos; las escrituras nuevas se bloquean con un mensaje claro. No hay cron nuevo, avisos automáticos ni extensión encubierta.
- Límites reales: Solo 1 persona / 1 Admin; Salón 5 / 2; Pro sin límite de personas/Admin. Los triggers de base serializan incorporaciones, cambios de rol e invitaciones, reservando los cupos de invitaciones pendientes. Impiden bajar de plan si el equipo no cabe; nunca borran personas. El acceso legado conserva su situación anterior.
- Registro: selector del plan de prueba y enlace a precios. La selección solo cambia el plan de prueba del salón recién creado; no afecta la identidad, WhatsApp, CAPTCHA, MFA ni permisos de otros salones.
- Mi plan: estado, días reales de prueba, personas/Admin, conexiones WhatsApp del salón y mensajes del mes. No cuenta los códigos de acceso de plataforma como mensajes de citas. Límite de 600 avisos/mes conservado. La API de Mi plan y datos fiscales requiere Admin con MFA y membresía vigente.
- Datos de factura opcionales guardados de forma privada para una integración posterior. La interfaz dice que todavía no se emiten facturas. Agregar tarjeta muestra Próximamente; pagos muestra vacío real. No hay promesa de cobro, facturación o cancelación de una pasarela inexistente.
- Página pública de precios en /planes/index.html con comparación y preguntas frecuentes, sin imágenes externas ni cifras de muestra. Conserva la URL y los identificadores de la PWA.

## Migración preparada

supabase/migrations/20261029221042_planes_etapa3.sql añade negocios_planes, fundadoras_control, funciones privadas y triggers de límites/vigencia. RLS forzada y permisos públicos cerrados. Backfill de metadatos de plan, sin modificar objetos, miembros, pagos, credenciales o sesiones existentes. Requiere respaldo y confirmación de Antonio antes de aplicarla. No enviar el SQL a producción como parte del build.

## Verificación

239 pruebas automáticas aprobadas con la pila completa de PostgreSQL local. Nuevos casos: precios, anual, treinta días exactos, conservación del acceso anterior, veinte cupos, límites de personas/Admin e invitaciones, no reiniciar pruebas, conservación al vencer, RLS, Admin/MFA y ausencia de cobros.

Navegador con JWT/MFA/RLS reales y proveedores simulados: Mi plan, precios mensuales/anuales/fundadora, elección durante prueba, datos fiscales, cero peticiones de cobro, White/Dark y 390/768/1440; registro por WhatsApp e invitación de otra Admin. Se añade comprobación del guardado real de asignaciones del equipo: se corrigió que PATCH/PUT también incluyan el cuerpo JSON del formulario, además de POST. No se solicitaron códigos ni mensajes reales. Capturas locales en ../imagenes/planes-etapa3/.

Cloudflare dry-run: 89 archivos, mismo Worker, bindings y secretos. No requiere publicar Railway; el núcleo de mensajería no cambió desde la etapa 2. No crear recursos de pago ni cambiar el límite compartido de 10 USD.

## Publicación verificada — 29 de octubre de 2026

Antonio confirmó «Sí, respalda y aplica Planes». Respaldo privado fuera de Git: respaldo-planes-etapa3-20261029.json, SHA256 de999962c22ffce70f3a8f72b3e4fa1bfae0ecacdef20f55fceda6036344f812. Las siete tablas respaldadas coinciden exactamente antes y después: negocios 1, miembros 1, estado 1, objetos 23, mutaciones 42, bitácora 0 y días especiales 0. No se copiaron secretos de Auth ni sesiones de WhatsApp.

Migración 20261029221042 / planes_etapa3 aplicada y registrada en Supabase. El propietario conserva estado legado, prueba_inicio/prueba_fin nulos y su acceso anterior. Contador real: un cupo asignado, diecinueve disponibles. Ambas tablas nuevas tienen RLS forzada y carecen de lectura directa para anon, authenticated o el mensajero. Asesor de seguridad: fundadoras_control sin políticas es intencional (tabla cerrada, solo función privada de agregado); los dos avisos informativos anteriores y protección de contraseñas sin activar siguen igual. No se activa un plan de pago para resolverlos.

Cloudflare publicado desde ccf4775, Worker 4a622a3e-ca59-4864-843f-d154acf77105, 89 archivos y keep-vars. Salud y página /planes/ responden 200; catálogo responde con precios reales, 19 cupos y cobrosHabilitados=false. planes.js publicado coincide en SHA256 con el compilado. Contexto y plan privado sin sesión responden 401. Registro y acceso conservados. Railway no se publicó ni modificó: códigos habilitados y envíos/vinculación apagados como en etapa 2.

URL: https://ritmo-belleza.antonio-t-22.workers.dev/planes/. PR #14 encadenado al #13. Etapa 4 (Explorar/Social reales) continúa en otra rama; Comunidad sigue siendo demostración hasta su propia migración y publicación.
