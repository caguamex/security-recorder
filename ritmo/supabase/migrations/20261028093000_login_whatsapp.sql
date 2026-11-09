-- Preparación local. Requiere confirmación de Antonio antes de aplicar.
BEGIN;
CREATE TABLE ritmo.acceso_solicitudes(
 id uuid PRIMARY KEY, prueba_hash text NOT NULL, destino_hash text NOT NULL, ip_hash text NOT NULL,
 canal text NOT NULL CHECK(canal IN ('whatsapp','correo')), tipo text NOT NULL CHECK(tipo IN ('sms','email','phone_change')),
 usuario_id uuid, creado_en timestamptz NOT NULL DEFAULT now(), vence_en timestamptz NOT NULL,
 intentos integer NOT NULL DEFAULT 0 CHECK(intentos BETWEEN 0 AND 5),
 estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','enviando','enviado','verificando','usado','fallido','incierto')),
 codigo_hash text, hook_hash text UNIQUE, payload_hash text
);
CREATE INDEX acceso_por_destino ON ritmo.acceso_solicitudes(destino_hash,creado_en);
CREATE INDEX acceso_por_ip ON ritmo.acceso_solicitudes(ip_hash,creado_en);
CREATE TABLE ritmo.acceso_sesiones(sesion_id uuid PRIMARY KEY,usuario_id uuid NOT NULL,creado_en timestamptz NOT NULL DEFAULT now());
-- Conservar las sesiones existentes; no cambia cuentas, roles, citas ni usuarios de Auth.
INSERT INTO ritmo.acceso_sesiones(sesion_id,usuario_id) SELECT id,user_id FROM auth.sessions WHERE not_after IS NULL OR not_after>now();
CREATE TABLE ritmo.plataforma_conexiones (LIKE ritmo.whatsapp_conexiones INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE ritmo.plataforma_conexiones ALTER COLUMN negocio_id TYPE text USING negocio_id::text;
ALTER TABLE ritmo.plataforma_conexiones ADD PRIMARY KEY(negocio_id), ADD CHECK(negocio_id='codigos'), ADD CHECK(esperado='528661241483');
CREATE TABLE ritmo.plataforma_sesiones(negocio_id text NOT NULL CHECK(negocio_id='codigos') REFERENCES ritmo.plataforma_conexiones, llave text NOT NULL CHECK(llave ~ '^[a-f0-9]{64}$'),cifrado jsonb NOT NULL,actualizado_en timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(negocio_id,llave));
CREATE TABLE ritmo.plataforma_alertas(id text PRIMARY KEY,negocio_id text NOT NULL CHECK(negocio_id='codigos'),tipo text NOT NULL,resuelta boolean NOT NULL DEFAULT false,creado_en timestamptz NOT NULL DEFAULT now());
ALTER TABLE ritmo.acceso_solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.acceso_solicitudes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.acceso_solicitudes FROM PUBLIC,anon,authenticated,ritmo_api,agendappx_whatsapp;
ALTER TABLE ritmo.acceso_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.acceso_sesiones FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.acceso_sesiones FROM PUBLIC,anon,authenticated,ritmo_api,agendappx_whatsapp;
ALTER TABLE ritmo.plataforma_conexiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.plataforma_conexiones FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.plataforma_conexiones FROM PUBLIC,anon,authenticated,ritmo_api,agendappx_whatsapp;
ALTER TABLE ritmo.plataforma_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.plataforma_sesiones FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.plataforma_sesiones FROM PUBLIC,anon,authenticated,ritmo_api,agendappx_whatsapp;
ALTER TABLE ritmo.plataforma_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.plataforma_alertas FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.plataforma_alertas FROM PUBLIC,anon,authenticated,ritmo_api,agendappx_whatsapp;
GRANT SELECT,INSERT,UPDATE,DELETE ON ritmo.acceso_solicitudes TO ritmo_api;
GRANT SELECT,UPDATE ON ritmo.acceso_solicitudes TO agendappx_whatsapp;
GRANT SELECT,INSERT ON ritmo.acceso_sesiones TO ritmo_api;
CREATE POLICY acceso_api ON ritmo.acceso_solicitudes TO ritmo_api USING(true) WITH CHECK(true);
CREATE POLICY hook_emisor ON ritmo.acceso_solicitudes TO agendappx_whatsapp USING(canal='whatsapp') WITH CHECK(canal='whatsapp');
CREATE POLICY acceso_sesion_api ON ritmo.acceso_sesiones TO ritmo_api USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON ritmo.plataforma_conexiones TO agendappx_whatsapp;
CREATE POLICY plataforma_operacion ON ritmo.plataforma_conexiones TO agendappx_whatsapp USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON ritmo.plataforma_sesiones TO agendappx_whatsapp;
CREATE POLICY plataforma_operacion ON ritmo.plataforma_sesiones TO agendappx_whatsapp USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON ritmo.plataforma_alertas TO agendappx_whatsapp;
CREATE POLICY plataforma_operacion ON ritmo.plataforma_alertas TO agendappx_whatsapp USING(true) WITH CHECK(true);
CREATE OR REPLACE FUNCTION ritmo.sesion_vigente() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid; sid uuid; alta timestamptz; admin_actual boolean; actividad uuid; BEGIN
  u := ritmo.usuario_actual();
  sid := (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
  IF u IS NULL OR sid IS NULL OR u IS DISTINCT FROM auth.uid() THEN RETURN false; END IF;
  SELECT created_at INTO alta FROM auth.sessions WHERE id=sid AND user_id=u AND created_at IS NOT NULL
    AND (not_after IS NULL OR not_after > now());
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM ritmo.acceso_sesiones WHERE sesion_id=sid AND usuario_id=u) THEN RETURN false; END IF;
  SELECT EXISTS(SELECT 1 FROM ritmo.miembros WHERE negocio_id=ritmo.negocio_actual()
    AND usuario_id=u AND rol='admin' AND activo) INTO admin_actual;
  IF NOT admin_actual AND NOT EXISTS(SELECT 1 FROM ritmo.actividad_sesiones WHERE sesion_id=sid)
    AND alta <= now()-interval '30 days' THEN RETURN false; END IF;
  INSERT INTO ritmo.actividad_sesiones(sesion_id,usuario_id,ultima_actividad) VALUES (sid,u,now())
  ON CONFLICT (sesion_id) DO UPDATE SET ultima_actividad=EXCLUDED.ultima_actividad
    WHERE ritmo.actividad_sesiones.usuario_id=u AND NOT ritmo.actividad_sesiones.revocada
      AND (admin_actual OR ritmo.actividad_sesiones.ultima_actividad > now()-interval '30 days')
  RETURNING sesion_id INTO actividad;
  RETURN actividad IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION ritmo.sesion_vigente() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ritmo.sesion_vigente() TO ritmo_api,agendappx_whatsapp;
COMMIT;
