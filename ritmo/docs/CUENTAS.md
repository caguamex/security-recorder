# Cuentas y equipo: especificación

Estado: aprobada por Antonio el 26 de octubre de 2026 (inicio de sesión y pantallas). Prototipo navegable: `ritmo/cuentas/index.html` (publicado como «Agendappx Equipo»).
Primero solo para AB' Beauty Room; todo se marca con su negocio desde el día uno para poder venderla a otros salones después sin rehacer nada.

## 1. Inicio de sesión

- **Con número de WhatsApp, sin contraseñas** (decisión de Antonio, como la app de Steren): la persona escribe su número (+52, 10 dígitos), le llega un **código de 6 dígitos por WhatsApp**, lo escribe y entra.
  - Usa el login por teléfono de Supabase Auth (OTP de teléfono) con el **«Send SMS Hook»**: en vez de un proveedor de SMS, el hook manda el código al servicio `agendappx-whatsapp` de Railway (ver `WHATSAPP-AUTOMATICO.md`), que lo envía por WhatsApp. **Sin costo por código.**
  - **Número de Agendappx: +52 866 124 1483**, el mismo que usa FiNeCi (decisión de Antonio). Es el número de la plataforma y sirve **solo para los códigos de registro e inicio de sesión de todos los salones**. Los recordatorios y promociones de cada salón salen del WhatsApp que **ese salón** vincule en Ajustes.
  - El hook va firmado (secreto del hook de Supabase) y solo acepta mensajes de código; no se puede usar para mandar otros textos.
  - Texto: «Tu código de Agendappx es *482913*. Vence en 10 minutos. No lo compartas con nadie.»
  - El código vence en 10 minutos; máximo 5 intentos. Máximo 3 códigos por número cada 15 minutos y 10 por IP por hora.
  - Los códigos de acceso **no cuentan** en los topes de recordatorios ni de promociones, y siempre salen primero.
- **Respaldo por correo**: «Prefiero recibirlo por correo» y «¿No te llegó? Recibirlo por correo» mandan el mismo tipo de código al correo (OTP de correo de Supabase + SMTP gratuito: Resend o Brevo). Así nadie se queda fuera si el WhatsApp de Agendappx está desconectado. Si el servicio de WhatsApp no responde en 20 segundos, la app ofrece el correo automáticamente.
- **SMS**: no por ahora (cuesta por mensaje). El hook queda listo para agregar un proveedor de SMS después, si Antonio lo decide.
- Una cuenta puede tener número y correo; los dos sirven para entrar.
- **Admin: verificación en dos pasos obligatoria** con app autenticadora (MFA TOTP de Supabase, nivel `aal2`), más 10 códigos de respaldo. Sin `aal2`, la API rechaza cualquier acción de Admin.
- Sesión: token de acceso corto (1 h) con renovación. Especialistas y Recepción se cierran solas tras 30 días sin abrir la app.
- No se guarda ninguna contraseña ni token en `localStorage` fuera de lo que maneja el SDK de Supabase.
- **Quién puede crear cuenta**:
  - **Dueñas de salón**: con «Registrarse» desde la bienvenida. Correo → código → «Tu salón» (nombre, su nombre, qué ofrece, link) → crea un negocio nuevo y queda como Admin, con servicios de ejemplo que puede cambiar. Antes de usar acciones de Admin configura los dos pasos.
  - **Equipo**: solo por invitación (`/unirse/<código>`), validada en el servidor.
  - Desactiva el registro abierto de Supabase («Allow new users to sign up» apagado y `shouldCreateUser: false`). El servidor crea el usuario solo en esos dos caminos. Límite: 3 salones nuevos por IP al día, con Cloudflare Turnstile (gratis) en «Registrarse».
- **Flujo de registro** (prototipo): invitación → su correo → código de 6 dígitos → «Tu perfil» (nombre editable, prellenado por la invitación; interruptor «Recibir mis citas por correo») → «Unirme al equipo» → Agenda.
- **Resumen diario por correo** (opcional por persona, encendido por defecto): a las 8:00 de Ciudad de México, sus citas del día, sin teléfonos. Usa el mismo SMTP gratuito.
- **Admin: verificación en dos pasos obligatoria** con app autenticadora (MFA TOTP de Supabase, nivel `aal2`), más 10 códigos de respaldo. Sin `aal2`, la API rechaza cualquier acción de Admin.
- Sesión: token de acceso corto (1 h) con renovación. Especialistas y Recepción se cierran solas tras 30 días sin abrir la app.
- No se guarda ninguna contraseña ni token en `localStorage` fuera de lo que maneja el SDK de Supabase.

## 1b. Bienvenida y perfil público del salón

- **Bienvenida** (`/`, sin sesión):
  - lo que ve alguien que entra por primera vez: título, un ejemplo de agenda, «Servicios de prueba» marcados como ejemplo, lo que incluye la app y «Mira un salón real»;
  - barra fija abajo con **Iniciar sesión** y **Registrarse**;
  - con sesión iniciada, `/` abre directo la Agenda.
- **Perfil público** (`/<slug>`, por ejemplo `/ab-beauty-room`): el link que la dueña comparte. `agendappx.app` en el prototipo es ilustrativo: no hay dominio comprado y no se renombra infraestructura; el link usa el dominio actual del Worker hasta que Antonio decida otro. Sin cuenta se ve:
  - portada, nombre, categorías, horario de hoy y dirección;
  - servicios por categoría con **precio y duración** (y foto, si tiene);
  - **horarios libres** de los próximos 7 días para el servicio elegido, calculados con el horario del salón, el de cada especialista que hace ese servicio y sus citas;
  - **Agendar cita**: nombre y WhatsApp → crea una cita con estado `solicitada` que el salón confirma (y que dispara el WhatsApp de confirmación). No necesita cuenta.
- **Privacidad del perfil público**:
  - la API pública (`GET /api/publico/<slug>` y `GET /api/publico/<slug>/libres?servicio=&dia=`) solo devuelve servicios activos, datos del salón y horas libres;
  - nunca devuelve citas, nombres de clientas ni teléfonos;
  - el nombre de pila de la especialista se muestra solo si el salón lo permite;
  - las solicitudes llevan Turnstile y un límite de 5 por teléfono al día.
- **En Ajustes (Admin)**: «Tu link para clientas» con Copiar y «Ver como lo ven tus clientas». El slug se elige al crear el salón y puede cambiarse; el anterior redirige 90 días.

## 1c. Dos Admin en el mismo salón y avisos al momento

- Antonio y la dueña del salón usan **la misma cuenta del salón**, cada quien con su número de WhatsApp (o correo) y los dos con rol **Admin**. No comparten acceso.
- **Todo es una sola agenda**: lo que agenda, mueve o cancela una persona le aparece **al momento** a las demás, sin recargar.
  - Usa Supabase Realtime (cambios de `belleza_objetos` del negocio, filtrados por RLS).
  - Si no hay conexión en tiempo real, se revisa cada 15 s. Al volver a la app, se sincroniza de inmediato.
- **Aviso en el celular** (notificación push web de la PWA, con permiso de cada persona) cuando otra persona agenda, mueve o cancela. Ejemplo: «Dueña del salón agendó una cita · Paola Vega · Gelish en manos · hoy 15:30 con Karla».
  - Al tocarlo se abre la cita.
  - A Admin le llega todo. A una Especialista, solo lo de sus citas.
  - Quien hizo el cambio no recibe su propio aviso.
  - Llaves VAPID como secretos, nunca en Git.
- Cada cita muestra en su historial quién la creó y quién la cambió (ya está en `bitacora`).

## 1d. Horario de trabajo («Mi horario»)

- **Ajustes → Mi horario**: cada persona edita el suyo. Admin también puede editar el de cualquiera desde Equipo → ficha → Horario.
  - Por día de la semana: trabaja sí o no, y de qué hora a qué hora (pasos de 30 min, formato 24 h).
  - Hora de comida opcional.
  - **Días especiales**: día libre, vacaciones (uno o varios días) o «sale temprano» con hora.
- Modelo: `miembros.horario = { "lun": ["10:00","19:00"] | null, ..., "comida": ["14:00","15:00"] | null }` y tabla `horario_especial(negocio_id, usuario_id, fecha, tipo, desde, hasta)`.
- Efectos:
  - **Agenda «Por especialista»**: fuera de turno y comida se ven rayados («Entra 11:00», «Comida», «Salió», «Descansa»).
  - **Nueva cita**: Recepción y Especialista solo pueden elegir horas dentro del horario. Admin ve las de fuera con ⚠️ y puede agendarlas confirmando.
  - **Perfil público**: las horas libres solo salen dentro del horario de quien hace el servicio, incluyendo comida y días especiales.
  - Los mensajes automáticos no cambian.

## 2. Roles

| Puede… | Admin | Recepción | Especialista |
|---|---|---|---|
| Ver la agenda de todas | Sí | Sí | Solo la suya; Admin puede activar «Ver la agenda de todas» |
| Agendar, mover y cancelar | Sí | Sí | Solo sus citas y solo servicios que hace |
| Clientas | Todas | Todas | Solo las de sus citas |
| Teléfonos completos | Sí | Sí | No: llegan enmascarados (`55 •••• 5678`) desde el servidor |
| Ingresos | Todos | No | Solo los suyos |
| Servicios, precios, promociones | Editar | Ver | Ver |
| Equipo, conexiones, datos del negocio | Sí | No | No |
| Historial de cambios del salón | Sí | No | No (sí el de cada cita suya) |

Cada salón tiene al menos un Admin; el último Admin no puede quitarse ni cambiar de rol.

## 3. Modelo de datos (PostgreSQL, esquema `ritmo`)

```sql
CREATE TABLE negocios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nombre text NOT NULL, creado_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE miembros (
  negocio_id uuid NOT NULL REFERENCES negocios ON DELETE CASCADE,
  usuario_id uuid NOT NULL,                       -- auth.users.id de Supabase
  rol text NOT NULL CHECK (rol IN ('admin', 'recepcion', 'especialista')),
  nombre text NOT NULL, color text NOT NULL,
  servicios text[] NOT NULL DEFAULT '{}',         -- ids de servicio que hace (especialista)
  ver_todas boolean NOT NULL DEFAULT false,
  horario jsonb NOT NULL DEFAULT '{}',            -- {"lun":["10:00","19:00"], ...}
  activo boolean NOT NULL DEFAULT true,
  PRIMARY KEY (negocio_id, usuario_id)
);
CREATE TABLE invitaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), negocio_id uuid NOT NULL REFERENCES negocios ON DELETE CASCADE,
  codigo_hash text NOT NULL UNIQUE,               -- SHA-256 del código; el código solo se muestra una vez
  nombre text NOT NULL, rol text NOT NULL, servicios text[] NOT NULL DEFAULT '{}', horario jsonb NOT NULL DEFAULT '{}',
  creada_por uuid NOT NULL, vence_en timestamptz NOT NULL, usada_en timestamptz, usada_por uuid
);
CREATE TABLE bitacora (
  id bigserial PRIMARY KEY, negocio_id uuid NOT NULL, usuario_id uuid, accion text NOT NULL,
  objeto_id text, antes jsonb, despues jsonb, en timestamptz NOT NULL DEFAULT now()
);
```

Cambios a las tablas existentes:

- `belleza_objetos`, `belleza_mutaciones`, `belleza_integraciones` y las tres de WhatsApp: agregar `negocio_id uuid NOT NULL`. La llave primaria pasa a `(negocio_id, id)`.
- `belleza_estado`: una fila por negocio, con `negocio_id` como llave, en lugar de `id = 1`. La revisión de sincronización es por negocio.
- Citas: agregar `data.especialista` (id de miembro) y un índice `(negocio_id, (data->>'especialista'))`.
- Bitácora: se llena con un trigger en `belleza_objetos`, que guarda quién, qué, antes y después. Cada cita muestra su parte del historial.

## 4. Seguridad en el servidor

- El Worker valida el JWT de Supabase con las llaves públicas (JWKS, en caché).
- En cada petición abre una transacción y hace `SET LOCAL ritmo.usuario = '<uuid>'` y `SET LOCAL ritmo.negocio = '<uuid>'`.
- Las políticas RLS dejan de ser `USING (true)` y comprueban la membresía activa. Ejemplo:
  ```sql
  CREATE POLICY por_negocio ON belleza_objetos TO ritmo_api
    USING (negocio_id = current_setting('ritmo.negocio')::uuid AND EXISTS (
      SELECT 1 FROM miembros m WHERE m.negocio_id = belleza_objetos.negocio_id
        AND m.usuario_id = current_setting('ritmo.usuario')::uuid AND m.activo))
  ```
- Para Especialista sin `ver_todas`, una política extra limita las citas a `data->>'especialista'` = su id y las clientas a las de sus citas.
- **Teléfonos enmascarados en el servidor**: el número completo nunca viaja al teléfono de una Especialista. Sus recordatorios salen por el WhatsApp del salón (Cloud API) con el número resuelto del lado del servidor.
- **Quitar a alguien es inmediato**: `miembros.activo = false`, y además se revocan sus sesiones con la API de administración de Supabase. Como cada petición revisa la membresía, pierde el acceso aunque su token siga vigente.
- Invitaciones:
  - código aleatorio de 128 bits, guardado como hash;
  - un solo uso y vencen en 48 h;
  - se aceptan solo con sesión iniciada;
  - límite de 10 intentos por IP y hora.
- La caché del Worker y del service worker nunca guarda respuestas con datos privados (ya existe; se conserva).
- `APP_TOKEN` deja de servir para la app. Queda solo para migración y tareas internas, y después se elimina.

## 5. Calendario y WhatsApp

- Enlace `.ics` privado **por miembro**:
  - `/calendario/<token>.ics`, con solo sus citas y sin teléfonos;
  - Admin puede tener además el del salón completo;
  - al quitar a alguien, su token se revoca.
- Los mensajes de WhatsApp incluyen el nombre de quien atiende: «Tu cita con Karla…».

## 6. Respaldos

Supabase Free no ofrece respaldos descargables. Un cron diario del Worker (03:00, hora de Ciudad de México) exporta cada negocio a JSON cifrado en Cloudflare R2 (plan gratis) y conserva 30 días. Admin ve la fecha del último respaldo en Seguridad.

## 7. Pantallas (ver prototipo)

0. **Bienvenida** y **perfil público** (sección 1b).
1. **Entrar** / **Registrarse**: código por correo. Admin pasa por la verificación en dos pasos.
2. **Agenda**:
   - fila de especialistas para filtrar;
   - vista «Lista» o «Por especialista» (columnas);
   - cada cita muestra quién atiende y su historial.
3. **Nueva cita (+)**:
   - al elegir servicio solo aparecen las especialistas que lo hacen;
   - los horarios ocupados de esa especialista se desactivan;
   - una Especialista solo puede agendarse a sí misma.
4. **Ajustes → Equipo** (solo Admin):
   - lista por rol e invitaciones pendientes;
   - **Invitar**: nombre, rol, servicios y días; crea un enlace que Admin manda por WhatsApp;
   - **ficha de cada persona**: rol, servicios, «Ver la agenda de todas», horario, sesiones y «Quitar del equipo» con confirmación dentro de la página;
   - tabla de qué puede hacer cada rol.
5. **Ajustes → Seguridad**:
   - Admin: dos pasos, respaldo, sesiones del equipo con «Cerrar» e historial de cambios;
   - los demás: solo sus sesiones.
6. **Invitación** (`/unirse/<código>`): muestra salón, rol y servicios, y se acepta con un código por correo.

## 8. Migración

1. Crear el negocio «AB' Beauty Room» y asignar todos los objetos existentes a él (en una transacción, con respaldo previo).
2. Antonio entra por primera vez con su correo. Un comando de un solo uso lo vincula como Admin y le pide activar los dos pasos.
3. Las citas existentes quedan con `especialista` vacío (se muestran como «Sin asignar» hasta que se edite).
4. Los dispositivos conectados con la clave anterior tienen que volver a entrar con su cuenta. Los datos locales sin sincronizar se suben al iniciar sesión.

## 9. Fuera de alcance por ahora

Planes y cobro (Mercado Pago o Stripe) y un número de WhatsApp por salón. Los salones nuevos pueden registrarse (sección 1), pero todos usan el plan gratis y el WhatsApp sale con el botón manual hasta que conecten el suyo. El modelo ya los permite: se agregan cuando se decida comercializar.

## 10. Pruebas mínimas

- Un usuario de otro negocio no puede leer ni escribir nada, ni adivinando ids. Se prueba directo contra la base con RLS.
- Una Especialista sin `ver_todas` no recibe citas ajenas ni teléfonos completos; con `ver_todas` ve citas, pero los teléfonos siguen enmascarados.
- Recepción no puede cambiar precios ni equipo, y no recibe ingresos.
- Al quitar a una persona, su siguiente petición devuelve 401 o 403.
- Una invitación vencida, usada o con código incorrecto se rechaza.
- Admin sin `aal2` no puede usar acciones de Admin.
- La bitácora registra crear, mover y cancelar con usuario y hora.

## Aclaración posterior de Antonio — 28 de octubre de 2026

Antonio confirmó expresamente: «los códigos a cualquier hora, citas y promociones también». Los códigos, avisos de citas y promociones se pueden enviar las 24 horas. Esta decisión sustituye las ventanas de silencio de cualquier versión anterior; no cambia consentimiento, topes, pausas, prioridades, idempotencia ni freno de emergencia. Los avisos conservan su momento según la cita y los recordatorios caducados no se mandan después de empezar. Esta decisión no autoriza vincular números, migrar datos o publicar una etapa sin su confirmación correspondiente.
