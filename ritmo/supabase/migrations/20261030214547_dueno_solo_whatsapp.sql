-- Antonio: dueño de Agendappx solo con código de WhatsApp, sin QR ni autenticadora.
-- Preparación local. Requiere respaldo y confirmación separada antes de aplicar.
BEGIN;
ALTER TABLE ritmo.acceso_sesiones ADD COLUMN plataforma_whatsapp_en timestamptz;
COMMENT ON COLUMN ritmo.acceso_sesiones.plataforma_whatsapp_en IS 'Prueba duradera del OTP de WhatsApp de esta sesión del dueño; no modifica aal ni contiene códigos.';
-- La API puede admitir una sesión con sus columnas habituales, pero no poner la prueba a mano.
REVOKE INSERT ON ritmo.acceso_sesiones FROM ritmo_api;
GRANT INSERT(sesion_id,usuario_id,solicitud_otp) ON ritmo.acceso_sesiones TO ritmo_api;

-- No basta con aal1 ni con tener el teléfono confirmado. La primera consulta exige
-- la solicitud OTP que el intermediario ligó a la sesión después de verificarla.
-- Guardar la prueba permite conservar la sesión cuando se depuran OTP de más de 24 h.
CREATE OR REPLACE FUNCTION ritmo.es_admin_plataforma() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; sid uuid; acreditada timestamptz; BEGIN
 u:=ritmo.usuario_actual();
 sid:=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
 IF u IS NULL OR sid IS NULL OR u IS DISTINCT FROM auth.uid()
  OR NOT EXISTS(SELECT 1 FROM ritmo.plataforma_admins WHERE usuario_id=u)
  OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND phone IS NOT NULL AND phone_confirmed_at IS NOT NULL)
  OR NOT ritmo.sesion_vigente() THEN RETURN false; END IF;

 SELECT plataforma_whatsapp_en INTO acreditada FROM ritmo.acceso_sesiones WHERE sesion_id=sid AND usuario_id=u;
 IF acreditada IS NOT NULL THEN RETURN true; END IF;
 UPDATE ritmo.acceso_sesiones s SET plataforma_whatsapp_en=clock_timestamp()
 WHERE s.sesion_id=sid AND s.usuario_id=u AND s.plataforma_whatsapp_en IS NULL
  AND EXISTS(SELECT 1 FROM ritmo.acceso_solicitudes a WHERE a.id=s.solicitud_otp
   AND a.usuario_id=u AND a.canal='whatsapp' AND a.tipo='sms' AND a.estado='usado' AND a.codigo_hash IS NOT NULL)
 RETURNING s.plataforma_whatsapp_en INTO acreditada;
 RETURN acreditada IS NOT NULL;
END $$;

-- El dueño conserva su moderación de Comunidad usando la misma prueba de WhatsApp.
-- Las identidades ajenas al dueño conservan la regla previa de moderador con MFA.
CREATE OR REPLACE FUNCTION ritmo.es_moderador_social() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF ritmo.usuario_actual() IS NULL OR ritmo.usuario_actual() IS DISTINCT FROM auth.uid()
  OR NOT EXISTS(SELECT 1 FROM ritmo.social_moderadores WHERE usuario_id=auth.uid()) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM ritmo.plataforma_admins WHERE usuario_id=auth.uid()) THEN RETURN ritmo.es_admin_plataforma(); END IF;
 RETURN (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal')='aal2' AND ritmo.sesion_vigente();
END $$;
REVOKE ALL ON FUNCTION ritmo.es_admin_plataforma(),ritmo.es_moderador_social() FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.es_admin_plataforma(),ritmo.es_moderador_social() TO ritmo_api;
COMMIT;
