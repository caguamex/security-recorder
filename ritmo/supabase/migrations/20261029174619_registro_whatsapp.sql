-- Preparación local: requiere respaldo y aprobación antes de aplicar.
BEGIN;
-- Liga el código usado a la sesión que realmente creó, sin afectar sesiones anteriores.
ALTER TABLE ritmo.acceso_sesiones ADD COLUMN solicitud_otp uuid;
CREATE TABLE ritmo.registro_solicitudes(
 id uuid PRIMARY KEY, prueba_hash text NOT NULL CHECK(prueba_hash ~ '^[a-f0-9]{64}$'),
 destino_hash text NOT NULL, ip_hash text NOT NULL,
 tipo text NOT NULL CHECK(tipo IN ('salon','invitacion')),
 perfil jsonb NOT NULL, invitacion_hash text,
 usuario_id uuid REFERENCES auth.users(id), sesion_id uuid,
 creado_en timestamptz NOT NULL DEFAULT now(), vence_en timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
 verificado_en timestamptz, completado_en timestamptz, negocio_id uuid REFERENCES ritmo.negocios(id),
 CHECK((tipo='invitacion')=(invitacion_hash IS NOT NULL))
);
CREATE INDEX registro_por_ip ON ritmo.registro_solicitudes(ip_hash,creado_en);
ALTER TABLE ritmo.registro_solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.registro_solicitudes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.registro_solicitudes FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT SELECT,INSERT,UPDATE,DELETE ON ritmo.registro_solicitudes TO ritmo_api;
CREATE POLICY registro_backend ON ritmo.registro_solicitudes TO ritmo_api USING(true) WITH CHECK(true);
CREATE TABLE ritmo.negocios_enlaces(
 negocio_id uuid PRIMARY KEY REFERENCES ritmo.negocios(id),
 slug text UNIQUE NOT NULL CHECK(slug ~ '^[a-z0-9][a-z0-9-]{2,59}$')
);
ALTER TABLE ritmo.negocios_enlaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.negocios_enlaces FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.negocios_enlaces FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT SELECT ON ritmo.negocios_enlaces TO ritmo_api;
CREATE POLICY enlaces_miembro ON ritmo.negocios_enlaces TO ritmo_api USING((ritmo.miembro_actual(negocio_id)).usuario_id IS NOT NULL);
-- Solo enumera membresías propias de una sesión admitida; no expone la agenda sin MFA.
CREATE FUNCTION ritmo.mis_negocios() RETURNS TABLE(negocio_id uuid,rol text,nombre text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE admin_negocio uuid; previo text; BEGIN
 previo:=coalesce(current_setting('ritmo.negocio',true),'');
 SELECT m.negocio_id INTO admin_negocio FROM ritmo.miembros m WHERE m.usuario_id=auth.uid() AND m.activo AND m.rol='admin' LIMIT 1;
 IF admin_negocio IS NOT NULL THEN PERFORM set_config('ritmo.negocio',admin_negocio::text,true); END IF;
 IF ritmo.usuario_actual() IS DISTINCT FROM auth.uid() OR NOT ritmo.sesion_vigente() THEN
  RAISE EXCEPTION 'Sesión inválida' USING ERRCODE='28000';
 END IF;
 RETURN QUERY SELECT m.negocio_id,m.rol,n.nombre FROM ritmo.miembros m JOIN ritmo.negocios n ON n.id=m.negocio_id
 WHERE m.usuario_id=auth.uid() AND m.activo ORDER BY n.creado_en,m.negocio_id;
 PERFORM set_config('ritmo.negocio',previo,true);
END $$;
-- Único punto de alta de membresías. El ticket exige OTP verificado por el proxy y la misma sesión.
CREATE FUNCTION ritmo.finalizar_registro(ticket uuid, prueba text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r ritmo.registro_solicitudes; u uuid; sid uuid; n uuid; rol_inv text; BEGIN
 u:=ritmo.usuario_actual(); sid:=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
 IF u IS NULL OR u IS DISTINCT FROM auth.uid() OR NOT ritmo.sesion_vigente() THEN
  RAISE EXCEPTION 'Sesión inválida' USING ERRCODE='28000'; END IF;
 SELECT * INTO r FROM ritmo.registro_solicitudes WHERE id=ticket FOR UPDATE;
 IF NOT FOUND OR r.prueba_hash IS DISTINCT FROM prueba OR r.usuario_id IS DISTINCT FROM u OR r.sesion_id IS DISTINCT FROM sid OR r.verificado_en IS NULL THEN
  RAISE EXCEPTION 'Registro inválido' USING ERRCODE='22023'; END IF;
 IF r.completado_en IS NOT NULL THEN RETURN r.negocio_id; END IF;
 IF r.vence_en<=clock_timestamp() THEN RAISE EXCEPTION 'Registro vencido' USING ERRCODE='22023'; END IF;
 IF r.tipo='invitacion' THEN
  SELECT i.rol INTO rol_inv FROM ritmo.invitaciones i WHERE i.codigo_hash=r.invitacion_hash;
 END IF;
 IF (r.tipo='salon' OR rol_inv='admin') AND (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal') IS DISTINCT FROM 'aal2' THEN
  RAISE EXCEPTION 'Completa los dos pasos' USING ERRCODE='42501'; END IF;
 IF r.tipo='invitacion' THEN
  -- El procedimiento existente vuelve a comprobar caducidad, creador, revocación y uso único bajo bloqueo.
  n:=ritmo.aceptar_invitacion(r.invitacion_hash,r.perfil->>'nombre',false);
 ELSE
  n:=gen_random_uuid();
  INSERT INTO ritmo.negocios(id,nombre) VALUES(n,r.perfil->>'salon');
  INSERT INTO ritmo.negocios_enlaces(negocio_id,slug) VALUES(n,r.perfil->>'slug');
  INSERT INTO ritmo.miembros(negocio_id,usuario_id,rol,nombre,resumen_correo) VALUES(n,u,'admin',r.perfil->>'nombre',false);
  PERFORM set_config('ritmo.negocio',n::text,true);
  INSERT INTO ritmo.belleza_estado(negocio_id,revision) VALUES(n,1);
  INSERT INTO ritmo.belleza_objetos(negocio_id,id,version,revision,data) VALUES(n,'__settings',1,1,
   jsonb_build_object('negocio',r.perfil->>'salon','skin','clasico','modo','white','abre','10:00','cierra','20:00','examplesOff',true));
 END IF;
 UPDATE ritmo.registro_solicitudes SET completado_en=clock_timestamp(),negocio_id=n WHERE id=ticket;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION ritmo.mis_negocios(),ritmo.finalizar_registro(uuid,text) FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.mis_negocios(),ritmo.finalizar_registro(uuid,text) TO ritmo_api;
COMMIT;
