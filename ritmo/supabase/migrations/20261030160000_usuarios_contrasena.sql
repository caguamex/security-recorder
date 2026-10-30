-- Preparación local: requiere respaldo y aprobación de Antonio antes de aplicar.
-- Aditiva: no cambia usuarios, sesiones, membresías ni agendas existentes.
BEGIN;
-- Nombre de usuario de cada cuenta. La contraseña vive solo en Supabase Auth.
CREATE TABLE ritmo.usuarios_acceso(
 usuario_id uuid PRIMARY KEY REFERENCES auth.users(id),
 usuario text NOT NULL UNIQUE CHECK(usuario ~ '^[a-z0-9][a-z0-9._]{2,19}$'),
 con_contrasena boolean NOT NULL DEFAULT false,
 -- Cuentas creadas por Admin sin WhatsApp: entran con contraseña temporal y deben cambiarla.
 creada_por uuid REFERENCES auth.users(id), negocio_id uuid REFERENCES ritmo.negocios(id),
 debe_cambiar boolean NOT NULL DEFAULT false, temporal_vence timestamptz,
 creado_en timestamptz NOT NULL DEFAULT now(), actualizado_en timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT debe_cambiar OR temporal_vence IS NOT NULL)
);
-- Un usuario queda apartado mientras se confirma el WhatsApp del registro.
CREATE TABLE ritmo.usuarios_apartados(
 usuario text PRIMARY KEY CHECK(usuario ~ '^[a-z0-9][a-z0-9._]{2,19}$'),
 registro_id uuid NOT NULL UNIQUE REFERENCES ritmo.registro_solicitudes(id) ON DELETE CASCADE,
 vence_en timestamptz NOT NULL
);
-- Fallos de contraseña por cuenta y por red (huellas HMAC; nunca la cuenta ni la IP en claro).
CREATE TABLE ritmo.contrasena_fallos(
 clave_hash text NOT NULL CHECK(clave_hash ~ '^[a-f0-9]{64}$'), en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contrasena_fallos_por_clave ON ritmo.contrasena_fallos(clave_hash,en);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['usuarios_acceso','usuarios_apartados','contrasena_fallos'] LOOP
  EXECUTE format('ALTER TABLE ritmo.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE ritmo.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON ritmo.%I FROM PUBLIC,anon,authenticated,agendappx_whatsapp',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON ritmo.%I TO ritmo_api',t);
  EXECUTE format('CREATE POLICY backend ON ritmo.%I TO ritmo_api USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
-- El rol de la API no lee auth.users: solo obtiene el identificador de acceso de un usuario.
CREATE FUNCTION ritmo.identificador_acceso(nombre text) RETURNS TABLE(usuario_id uuid,phone text,email text,debe_cambiar boolean,temporal_vence timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.usuario_id,u.phone,u.email,a.debe_cambiar,a.temporal_vence
 FROM ritmo.usuarios_acceso a JOIN auth.users u ON u.id=a.usuario_id WHERE a.usuario=lower(nombre)
$$;
-- Quita todas las sesiones admitidas de una persona del propio salón (contraseña nueva o acceso quitado).
CREATE FUNCTION ritmo.revocar_sesiones_miembro(n uuid,u uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) OR ritmo.usuario_actual() IS DISTINCT FROM auth.uid() OR u=auth.uid()
  OR NOT EXISTS(SELECT 1 FROM ritmo.miembros WHERE negocio_id=n AND usuario_id=u) THEN
  RAISE EXCEPTION 'Solo Admin' USING ERRCODE='42501'; END IF;
 DELETE FROM ritmo.acceso_sesiones WHERE usuario_id=u;
 UPDATE ritmo.actividad_sesiones SET revocada=true WHERE usuario_id=u;
END $$;
-- Alta de una persona del equipo con usuario y contraseña temporal, creada antes en Auth por el intermediario.
-- El disparador limite_miembros_plan sigue aplicando los límites del plan.
CREATE FUNCTION ritmo.alta_miembro_usuario(n uuid,u uuid,nombre_persona text,rol_persona text,nombre_usuario text,vence timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) OR ritmo.usuario_actual() IS DISTINCT FROM auth.uid()
  OR (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal') IS DISTINCT FROM 'aal2' THEN
  RAISE EXCEPTION 'Solo Admin con MFA' USING ERRCODE='42501'; END IF;
 IF rol_persona NOT IN ('recepcion','especialista') THEN RAISE EXCEPTION 'Rol no permitido' USING ERRCODE='22023'; END IF;
 IF vence<=clock_timestamp() OR vence>clock_timestamp()+interval '72 hours' THEN RAISE EXCEPTION 'Vigencia inválida' USING ERRCODE='22023'; END IF;
 INSERT INTO ritmo.miembros(negocio_id,usuario_id,rol,nombre,resumen_correo) VALUES(n,u,rol_persona,nombre_persona,false);
 INSERT INTO ritmo.usuarios_acceso(usuario_id,usuario,con_contrasena,creada_por,negocio_id,debe_cambiar,temporal_vence)
 VALUES(u,nombre_usuario,true,auth.uid(),n,true,vence);
END $$;
REVOKE ALL ON FUNCTION ritmo.alta_miembro_usuario(uuid,uuid,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.alta_miembro_usuario(uuid,uuid,text,text,text,timestamptz) TO ritmo_api;
REVOKE ALL ON FUNCTION ritmo.identificador_acceso(text),ritmo.revocar_sesiones_miembro(uuid,uuid) FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.identificador_acceso(text),ritmo.revocar_sesiones_miembro(uuid,uuid) TO ritmo_api;
COMMIT;
