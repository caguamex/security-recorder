# Cuentas y equipo: especificación

Estado: propuesta; Antonio aprobó el inicio de sesión (Apple, Google y código por correo) y falta que apruebe las pantallas. Prototipo navegable: `ritmo/cuentas/index.html` (publicado como «Ritmo Belleza Equipo»).
Primero solo para AB' Beauty Room; todo se marca con su negocio desde el día uno para poder venderla a otros salones después sin rehacer nada.

## 1. Inicio de sesión

- **Sin contraseñas.** Tres formas, todas con Supabase Auth (plan gratis):
  1. Continuar con Apple (Sign in with Apple; permite ocultar el correo).
  2. Continuar con Google.
  3. Código de 6 dígitos por correo (OTP de Supabase, no enlace mágico: funciona aunque el correo se abra en otro dispositivo). Vence en 10 minutos; máximo 5 intentos.
- **Admin: verificación en dos pasos obligatoria** con app autenticadora (MFA TOTP de Supabase, nivel `aal2`), más 10 códigos de respaldo. Sin `aal2`, la API rechaza cualquier acción de Admin.
- Sesión: token de acceso corto (1 h) con renovación. Especialistas y Recepción se cierran solas tras 30 días sin abrir la app.
- No se guarda ninguna contraseña ni token en `localStorage` fuera de lo que maneja el SDK de Supabase.

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

1. **Entrar**: Apple, Google y correo + código. Admin pasa por la verificación en dos pasos.
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
6. **Invitación** (`/unirse/<código>`): muestra salón, rol y servicios, y se acepta entrando con Apple, Google o correo.

## 8. Migración

1. Crear el negocio «AB' Beauty Room» y asignar todos los objetos existentes a él (en una transacción, con respaldo previo).
2. Antonio entra por primera vez con Apple, Google o correo. Un comando de un solo uso lo vincula como Admin y le pide activar los dos pasos.
3. Las citas existentes quedan con `especialista` vacío (se muestran como «Sin asignar» hasta que se edite).
4. Los dispositivos conectados con la clave anterior tienen que volver a entrar con su cuenta. Los datos locales sin sincronizar se suben al iniciar sesión.

## 9. Fuera de alcance por ahora

Registro público de otros salones, planes y cobro (Mercado Pago o Stripe), y un número de WhatsApp por salón. El modelo ya los permite: se agregan cuando se decida comercializar.

## 10. Pruebas mínimas

- Un usuario de otro negocio no puede leer ni escribir nada, ni adivinando ids. Se prueba directo contra la base con RLS.
- Una Especialista sin `ver_todas` no recibe citas ajenas ni teléfonos completos; con `ver_todas` ve citas, pero los teléfonos siguen enmascarados.
- Recepción no puede cambiar precios ni equipo, y no recibe ingresos.
- Al quitar a una persona, su siguiente petición devuelve 401 o 403.
- Una invitación vencida, usada o con código incorrecto se rechaza.
- Admin sin `aal2` no puede usar acciones de Admin.
- La bitácora registra crear, mover y cancelar con usuario y hora.
