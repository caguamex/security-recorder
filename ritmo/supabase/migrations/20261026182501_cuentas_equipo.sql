-- Preparado para revisión. NO aplicar a producción sin respaldo y aprobación de Antonio.
-- El ejecutor debe fijar ritmo.migracion_autorizada, ritmo.migracion_negocio y
-- ritmo.migracion_admin dentro de esta misma transacción. No es un alta pública.
BEGIN;
DO $$ BEGIN
  IF current_setting('ritmo.migracion_autorizada', true) IS DISTINCT FROM 'si' THEN
    RAISE EXCEPTION 'Falta la confirmación de migración y el respaldo previo';
  END IF;
  IF nullif(current_setting('ritmo.migracion_negocio', true), '')::uuid IS NULL OR
     nullif(current_setting('ritmo.migracion_admin', true), '')::uuid IS NULL THEN
    RAISE EXCEPTION 'Falta el negocio o el usuario verificado de arranque';
  END IF;
END $$;
SET LOCAL search_path = ritmo, pg_catalog;
CREATE TABLE ritmo.negocios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nombre text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ritmo.miembros (
  negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id), usuario_id uuid NOT NULL REFERENCES auth.users(id),
  rol text NOT NULL CHECK (rol IN ('admin', 'recepcion', 'especialista')),
  nombre text NOT NULL CHECK (length(nombre) BETWEEN 1 AND 200), color text NOT NULL DEFAULT '#b89a63',
  servicios text[] NOT NULL DEFAULT '{}', ver_todas boolean NOT NULL DEFAULT false,
  horario jsonb NOT NULL DEFAULT '{}', activo boolean NOT NULL DEFAULT true,
  resumen_correo boolean NOT NULL DEFAULT true, creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (negocio_id, usuario_id)
);
CREATE INDEX miembros_por_usuario ON ritmo.miembros(usuario_id, negocio_id) WHERE activo;
CREATE TABLE ritmo.invitaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),
  codigo_hash text NOT NULL UNIQUE CHECK (codigo_hash ~ '^[a-f0-9]{64}$'),
  nombre text NOT NULL CHECK (length(nombre) BETWEEN 1 AND 200),
  rol text NOT NULL CHECK (rol IN ('admin', 'recepcion', 'especialista')),
  servicios text[] NOT NULL DEFAULT '{}', horario jsonb NOT NULL DEFAULT '{}',
  creada_por uuid NOT NULL REFERENCES auth.users(id), creada_en timestamptz NOT NULL DEFAULT now(),
  vence_en timestamptz NOT NULL DEFAULT now() + interval '48 hours', usada_en timestamptz,
  usada_por uuid REFERENCES auth.users(id), revocada_en timestamptz,
  CHECK (vence_en > creada_en AND vence_en <= creada_en + interval '48 hours'),
  CHECK ((usada_en IS NULL) = (usada_por IS NULL))
);
CREATE INDEX invitaciones_por_negocio ON ritmo.invitaciones(negocio_id, vence_en) WHERE usada_en IS NULL AND revocada_en IS NULL;
CREATE TABLE ritmo.bitacora (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id), usuario_id uuid REFERENCES auth.users(id),
  accion text NOT NULL, objeto_id text NOT NULL, especialista_id text,
  antes jsonb, despues jsonb, en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX bitacora_por_objeto ON ritmo.bitacora(negocio_id, objeto_id, en DESC);

INSERT INTO ritmo.negocios(id, nombre) VALUES (current_setting('ritmo.migracion_negocio')::uuid, 'AB'' Beauty Room');
INSERT INTO ritmo.miembros(negocio_id, usuario_id, rol, nombre)
VALUES (current_setting('ritmo.migracion_negocio')::uuid, current_setting('ritmo.migracion_admin')::uuid, 'admin', 'Antonio');

-- La revisión y las claves de sincronización pasan a estar acotadas al salón.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['belleza_estado','belleza_objetos','belleza_mutaciones',
    'belleza_integraciones','belleza_whatsapp_contactos','belleza_whatsapp_entradas','belleza_whatsapp_cola'] LOOP
    EXECUTE format('ALTER TABLE ritmo.%I ADD COLUMN negocio_id uuid REFERENCES ritmo.negocios(id)', t);
    EXECUTE format('UPDATE ritmo.%I SET negocio_id = $1', t) USING current_setting('ritmo.migracion_negocio')::uuid;
    EXECUTE format('ALTER TABLE ritmo.%I ALTER COLUMN negocio_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE ritmo.%I DROP CONSTRAINT %I', t, t || '_pkey');
    IF t = 'belleza_estado' THEN
      EXECUTE format('ALTER TABLE ritmo.%I ADD PRIMARY KEY (negocio_id)', t);
    ELSE
      EXECUTE format('ALTER TABLE ritmo.%I ADD PRIMARY KEY (negocio_id, %I)', t,
        CASE WHEN t = 'belleza_whatsapp_contactos' THEN 'telefono' ELSE 'id' END);
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS acceso_servidor ON ritmo.%I', t);
  END LOOP;
END $$;
ALTER TABLE ritmo.belleza_estado DROP COLUMN id;
ALTER TABLE ritmo.belleza_mutaciones ADD COLUMN usuario_id uuid REFERENCES auth.users(id);
UPDATE ritmo.belleza_mutaciones SET usuario_id = current_setting('ritmo.migracion_admin')::uuid;
ALTER TABLE ritmo.belleza_mutaciones ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE ritmo.belleza_objetos ADD COLUMN tipo text;
ALTER TABLE ritmo.belleza_objetos ADD COLUMN especialista_id text;
ALTER TABLE ritmo.belleza_objetos ADD COLUMN creada_por uuid REFERENCES auth.users(id);
UPDATE ritmo.belleza_objetos SET tipo = CASE WHEN id = '__settings' THEN 'ajustes' ELSE data->>'kind' END,
  especialista_id = data->>'especialista', creada_por = current_setting('ritmo.migracion_admin')::uuid;
CREATE INDEX objetos_por_especialista ON ritmo.belleza_objetos(negocio_id, especialista_id) WHERE tipo = 'cita';
CREATE INDEX objetos_por_clienta ON ritmo.belleza_objetos(negocio_id, (data->>'clienta')) WHERE tipo = 'cita' AND data IS NOT NULL;
CREATE INDEX objetos_por_revision ON ritmo.belleza_objetos(negocio_id, revision);

CREATE FUNCTION ritmo.usuario_actual() RETURNS uuid LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT nullif(current_setting('ritmo.usuario', true), '')::uuid
$$;
CREATE FUNCTION ritmo.negocio_actual() RETURNS uuid LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT nullif(current_setting('ritmo.negocio', true), '')::uuid
$$;
-- Consulta interna para evitar recursión en las políticas de miembros.
-- Solo el backend SQL de confianza puede fijar el contexto; no hay acceso Data API.
CREATE FUNCTION ritmo.miembro_actual(n uuid) RETURNS ritmo.miembros
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m FROM ritmo.miembros m
  WHERE m.negocio_id = n AND n = ritmo.negocio_actual()
    AND m.usuario_id = ritmo.usuario_actual() AND m.usuario_id = auth.uid() AND m.activo
    AND (m.rol <> 'admin' OR nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'aal' = 'aal2')
    AND EXISTS (SELECT 1 FROM auth.sessions s WHERE s.user_id=m.usuario_id
      AND s.id=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid
      AND s.created_at IS NOT NULL AND (s.not_after IS NULL OR s.not_after>now()))
$$;
CREATE FUNCTION ritmo.es_admin(n uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce((ritmo.miembro_actual(n)).rol = 'admin', false)
$$;
CREATE FUNCTION ritmo.clienta_propia(n uuid, cli text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (ritmo.miembro_actual(n)).usuario_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM ritmo.belleza_objetos o WHERE o.negocio_id = n AND o.data IS NOT NULL AND
      ((o.tipo = 'clienta' AND o.id = cli AND o.creada_por = ritmo.usuario_actual()) OR
       (o.tipo = 'cita' AND o.data->>'clienta' = cli AND o.especialista_id = ritmo.usuario_actual()::text))
  )
$$;
CREATE FUNCTION ritmo.puede_leer_objeto(n uuid, tipo text, esp text, oid text) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE m ritmo.miembros; BEGIN
  m := ritmo.miembro_actual(n);
  IF m.usuario_id IS NULL THEN RETURN false; END IF;
  IF m.rol IN ('admin','recepcion') THEN RETURN true; END IF;
  RETURN CASE tipo
    WHEN 'cita' THEN m.ver_todas OR esp = m.usuario_id::text
    WHEN 'clienta' THEN ritmo.clienta_propia(n, oid)
    WHEN 'servicio' THEN true WHEN 'promo' THEN true WHEN 'ajustes' THEN true ELSE false END;
END $$;
CREATE FUNCTION ritmo.puede_escribir_objeto(n uuid, d jsonb, oid text, tipo_anterior text, esp_anterior text) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE m ritmo.miembros; t text; BEGIN
  m := ritmo.miembro_actual(n);
  IF m.usuario_id IS NULL THEN RETURN false; END IF;
  IF m.rol = 'admin' THEN RETURN true; END IF;
  t := CASE WHEN oid = '__settings' THEN 'ajustes' WHEN d IS NULL THEN tipo_anterior ELSE d->>'kind' END;
  IF m.rol = 'recepcion' THEN RETURN t IN ('cita','clienta'); END IF;
  IF t = 'clienta' THEN RETURN ritmo.clienta_propia(n, oid); END IF;
  IF t <> 'cita' THEN RETURN false; END IF;
  IF d IS NULL THEN RETURN esp_anterior = m.usuario_id::text; END IF;
  RETURN d->>'especialista' = m.usuario_id::text AND (d->>'servicio') = ANY(m.servicios)
    AND ritmo.clienta_propia(n, d->>'clienta');
END $$;

-- No se confía en metadatos de rol o autor enviados por el navegador.
CREATE FUNCTION ritmo.metadatos_objeto() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.negocio_id <> OLD.negocio_id OR NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'No se puede trasladar un objeto a otro salón';
    END IF;
    NEW.creada_por := OLD.creada_por;
    IF OLD.tipo IS NOT NULL AND NEW.data IS NOT NULL AND OLD.tipo IS DISTINCT FROM
      (CASE WHEN NEW.id = '__settings' THEN 'ajustes' ELSE NEW.data->>'kind' END) THEN
      RAISE EXCEPTION 'No se puede cambiar el tipo de un objeto';
    END IF;
  ELSE NEW.creada_por := ritmo.usuario_actual(); END IF;
  IF NEW.data IS NOT NULL THEN
    NEW.tipo := CASE WHEN NEW.id = '__settings' THEN 'ajustes' ELSE NEW.data->>'kind' END;
    NEW.especialista_id := NEW.data->>'especialista';
  ELSIF TG_OP = 'UPDATE' THEN NEW.tipo := OLD.tipo; NEW.especialista_id := OLD.especialista_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER metadatos_objeto BEFORE INSERT OR UPDATE ON ritmo.belleza_objetos FOR EACH ROW EXECUTE FUNCTION ritmo.metadatos_objeto();

CREATE FUNCTION ritmo.registrar_cambio() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF ritmo.usuario_actual() IS NULL OR ritmo.usuario_actual() IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Falta el actor verificado del cambio';
  END IF;
  INSERT INTO ritmo.bitacora(negocio_id, usuario_id, accion, objeto_id, especialista_id, antes, despues)
  VALUES (NEW.negocio_id, ritmo.usuario_actual(),
    CASE WHEN TG_OP = 'INSERT' THEN 'crear' WHEN NEW.data IS NULL THEN 'eliminar'
      WHEN NEW.data->>'estado' = 'cancelada' AND OLD.data->>'estado' IS DISTINCT FROM 'cancelada' THEN 'cancelar'
      WHEN NEW.tipo = 'cita' AND (NEW.data->>'date',NEW.data->>'start') IS DISTINCT FROM (OLD.data->>'date',OLD.data->>'start') THEN 'mover'
      ELSE 'editar' END,
    NEW.id, NEW.especialista_id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.data ELSE NULL END, NEW.data);
  RETURN NEW;
END $$;
CREATE TRIGGER registrar_cambio AFTER INSERT OR UPDATE ON ritmo.belleza_objetos FOR EACH ROW EXECUTE FUNCTION ritmo.registrar_cambio();

CREATE FUNCTION ritmo.conservar_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM ritmo.negocios WHERE id = OLD.negocio_id FOR UPDATE;
  IF TG_OP = 'UPDATE' AND (NEW.negocio_id <> OLD.negocio_id OR NEW.usuario_id <> OLD.usuario_id) THEN
    RAISE EXCEPTION 'No se puede trasladar una membresía';
  END IF;
  IF OLD.rol = 'admin' AND OLD.activo AND
    (TG_OP = 'DELETE' OR NOT NEW.activo OR NEW.rol <> 'admin') AND NOT EXISTS (
      SELECT 1 FROM ritmo.miembros WHERE negocio_id = OLD.negocio_id
        AND usuario_id <> OLD.usuario_id AND rol = 'admin' AND activo
    ) THEN RAISE EXCEPTION 'El salón debe conservar al menos un Admin'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER conservar_admin BEFORE UPDATE OR DELETE ON ritmo.miembros FOR EACH ROW EXECUTE FUNCTION ritmo.conservar_admin();

CREATE TABLE ritmo.actividad_sesiones (
  sesion_id uuid PRIMARY KEY, usuario_id uuid NOT NULL REFERENCES auth.users(id),
  ultima_actividad timestamptz NOT NULL DEFAULT now(), revocada boolean NOT NULL DEFAULT false
);
ALTER TABLE ritmo.actividad_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.actividad_sesiones FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.actividad_sesiones FROM PUBLIC, anon, authenticated, ritmo_api;
-- Lee únicamente existencia y vigencia de auth.sessions; el rol de la API no recibe
-- acceso a esa tabla ni a los tokens de renovación de Supabase.
CREATE FUNCTION ritmo.sesion_vigente() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid; sid uuid; alta timestamptz; admin_actual boolean; actividad uuid; BEGIN
  u := ritmo.usuario_actual();
  sid := (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
  IF u IS NULL OR sid IS NULL OR u IS DISTINCT FROM auth.uid() THEN RETURN false; END IF;
  SELECT created_at INTO alta FROM auth.sessions WHERE id=sid AND user_id=u AND created_at IS NOT NULL
    AND (not_after IS NULL OR not_after > now());
  IF NOT FOUND THEN RETURN false; END IF;
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

-- Los intentos se guardan con una huella de IP calculada por el servidor, no con la IP en claro.
CREATE TABLE ritmo.intentos_invitacion (
  ip_hash text NOT NULL CHECK (ip_hash ~ '^[a-f0-9]{64}$'), ventana timestamptz NOT NULL,
  intentos integer NOT NULL CHECK (intentos BETWEEN 1 AND 10), PRIMARY KEY(ip_hash, ventana)
);
CREATE INDEX intentos_invitacion_caducidad ON ritmo.intentos_invitacion(ventana);
ALTER TABLE ritmo.intentos_invitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.intentos_invitacion FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.intentos_invitacion FROM PUBLIC, anon, authenticated, ritmo_api;
CREATE FUNCTION ritmo.limitar_invitacion(ip text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE resultado integer; BEGIN
  IF ip !~ '^[a-f0-9]{64}$' OR ip IS NULL THEN RETURN false; END IF;
  DELETE FROM ritmo.intentos_invitacion WHERE ventana < now() - interval '2 hours';
  INSERT INTO ritmo.intentos_invitacion(ip_hash,ventana,intentos) VALUES (ip,date_trunc('hour',now()),1)
  ON CONFLICT (ip_hash,ventana) DO UPDATE SET intentos=ritmo.intentos_invitacion.intentos+1
    WHERE ritmo.intentos_invitacion.intentos < 10
  RETURNING intentos INTO resultado;
  RETURN resultado IS NOT NULL;
END $$;
-- Vista previa mínima antes de iniciar sesión; solo se ejecuta desde el backend,
-- después de consumir un intento. No devuelve nombres de clientas, contactos ni el hash.
CREATE FUNCTION ritmo.ver_invitacion(h text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('negocioId',n.id,'salon',n.nombre,'nombre',i.nombre,
    'rol',i.rol,'servicios',i.servicios,'venceEn',i.vence_en)
  FROM ritmo.invitaciones i JOIN ritmo.negocios n ON n.id=i.negocio_id
  WHERE i.codigo_hash=h AND i.usada_en IS NULL AND i.revocada_en IS NULL AND i.vence_en > now()
    AND EXISTS (SELECT 1 FROM ritmo.miembros m WHERE m.negocio_id=i.negocio_id
      AND m.usuario_id=i.creada_por AND m.rol='admin' AND m.activo)
$$;
CREATE FUNCTION ritmo.aceptar_invitacion(h text, perfil text, resumen boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitacion ritmo.invitaciones; u uuid; BEGIN
  u := ritmo.usuario_actual();
  IF u IS NULL OR u IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Inicia sesión de nuevo' USING ERRCODE='28000'; END IF;
  IF perfil IS NULL OR length(trim(perfil)) NOT BETWEEN 1 AND 200 OR resumen IS NULL THEN
    RAISE EXCEPTION 'Perfil inválido' USING ERRCODE='22023';
  END IF;
  SELECT * INTO invitacion FROM ritmo.invitaciones WHERE codigo_hash=h FOR UPDATE;
  IF NOT FOUND OR invitacion.usada_en IS NOT NULL OR invitacion.revocada_en IS NOT NULL OR
    invitacion.vence_en <= clock_timestamp() OR NOT EXISTS (SELECT 1 FROM ritmo.miembros m
      WHERE m.negocio_id=invitacion.negocio_id AND m.usuario_id=invitacion.creada_por AND m.rol='admin' AND m.activo) THEN
    RAISE EXCEPTION 'La invitación no está disponible' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM ritmo.miembros WHERE negocio_id=invitacion.negocio_id AND usuario_id=u AND activo) THEN
    RAISE EXCEPTION 'Ya formas parte del equipo' USING ERRCODE='22023';
  END IF;
  INSERT INTO ritmo.miembros(negocio_id,usuario_id,rol,nombre,servicios,horario,resumen_correo)
    VALUES (invitacion.negocio_id,u,invitacion.rol,trim(perfil),invitacion.servicios,invitacion.horario,resumen)
  ON CONFLICT (negocio_id,usuario_id) DO UPDATE SET rol=EXCLUDED.rol,nombre=EXCLUDED.nombre,
    servicios=EXCLUDED.servicios,horario=EXCLUDED.horario,resumen_correo=EXCLUDED.resumen_correo,activo=true,ver_todas=false;
  UPDATE ritmo.invitaciones SET usada_en=clock_timestamp(),usada_por=u WHERE id=invitacion.id;
  RETURN invitacion.negocio_id;
END $$;

-- Una sola condición por operación combina salón, membresía, MFA y alcance del rol.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['negocios','miembros','invitaciones','bitacora','belleza_estado',
    'belleza_objetos','belleza_mutaciones','belleza_integraciones','belleza_whatsapp_contactos',
    'belleza_whatsapp_entradas','belleza_whatsapp_cola'] LOOP
    EXECUTE format('ALTER TABLE ritmo.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE ritmo.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON ritmo.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;
CREATE POLICY negocio_lectura ON ritmo.negocios FOR SELECT TO ritmo_api USING ((ritmo.miembro_actual(id)).usuario_id IS NOT NULL);
CREATE POLICY negocio_edicion ON ritmo.negocios FOR UPDATE TO ritmo_api USING (ritmo.es_admin(id)) WITH CHECK (ritmo.es_admin(id));
CREATE POLICY miembros_lectura ON ritmo.miembros FOR SELECT TO ritmo_api USING ((ritmo.miembro_actual(negocio_id)).usuario_id IS NOT NULL);
CREATE POLICY miembros_edicion ON ritmo.miembros FOR ALL TO ritmo_api USING (ritmo.es_admin(negocio_id)) WITH CHECK (ritmo.es_admin(negocio_id));
CREATE POLICY invitaciones_admin ON ritmo.invitaciones FOR ALL TO ritmo_api USING (ritmo.es_admin(negocio_id)) WITH CHECK (ritmo.es_admin(negocio_id));
CREATE POLICY estado_por_negocio ON ritmo.belleza_estado TO ritmo_api
  USING ((ritmo.miembro_actual(negocio_id)).usuario_id IS NOT NULL)
  WITH CHECK ((ritmo.miembro_actual(negocio_id)).usuario_id IS NOT NULL);
CREATE POLICY objetos_lectura ON ritmo.belleza_objetos FOR SELECT TO ritmo_api
  USING (ritmo.puede_leer_objeto(negocio_id, tipo, especialista_id, id));
CREATE POLICY objetos_alta ON ritmo.belleza_objetos FOR INSERT TO ritmo_api
  WITH CHECK (ritmo.puede_escribir_objeto(negocio_id, data, id, tipo, especialista_id) OR
    (tipo = 'clienta' AND creada_por = ritmo.usuario_actual() AND (ritmo.miembro_actual(negocio_id)).rol = 'especialista'));
CREATE POLICY objetos_edicion ON ritmo.belleza_objetos FOR UPDATE TO ritmo_api
  USING (ritmo.puede_escribir_objeto(negocio_id, data, id, tipo, especialista_id))
  WITH CHECK (ritmo.puede_escribir_objeto(negocio_id, data, id, tipo, especialista_id));
CREATE POLICY mutaciones_propias ON ritmo.belleza_mutaciones TO ritmo_api
  USING ((ritmo.miembro_actual(negocio_id)).usuario_id = usuario_id)
  WITH CHECK ((ritmo.miembro_actual(negocio_id)).usuario_id = usuario_id);
CREATE POLICY bitacora_lectura ON ritmo.bitacora FOR SELECT TO ritmo_api USING (
  ritmo.es_admin(negocio_id) OR ((ritmo.miembro_actual(negocio_id)).rol = 'recepcion' AND especialista_id IS NOT NULL) OR
  ((ritmo.miembro_actual(negocio_id)).rol = 'especialista' AND especialista_id = ritmo.usuario_actual()::text AND
    EXISTS (SELECT 1 FROM ritmo.belleza_objetos o WHERE o.negocio_id = bitacora.negocio_id AND o.id = bitacora.objeto_id AND o.especialista_id = ritmo.usuario_actual()::text))
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['belleza_integraciones','belleza_whatsapp_contactos','belleza_whatsapp_entradas','belleza_whatsapp_cola'] LOOP
    EXECUTE format('CREATE POLICY solo_admin ON ritmo.%I TO ritmo_api USING (ritmo.es_admin(negocio_id)) WITH CHECK (ritmo.es_admin(negocio_id))', t);
  END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ritmo FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ritmo TO ritmo_api;
GRANT EXECUTE ON FUNCTION ritmo.usuario_actual(), ritmo.negocio_actual(), ritmo.miembro_actual(uuid),
  ritmo.es_admin(uuid), ritmo.clienta_propia(uuid,text), ritmo.puede_leer_objeto(uuid,text,text,text),
  ritmo.puede_escribir_objeto(uuid,jsonb,text,text,text) TO ritmo_api;
GRANT EXECUTE ON FUNCTION ritmo.sesion_vigente() TO ritmo_api;
GRANT EXECUTE ON FUNCTION ritmo.limitar_invitacion(text), ritmo.ver_invitacion(text),
  ritmo.aceptar_invitacion(text,text,boolean) TO ritmo_api;
GRANT SELECT, UPDATE ON ritmo.negocios TO ritmo_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ritmo.miembros, ritmo.invitaciones TO ritmo_api;
GRANT SELECT, INSERT, UPDATE ON ritmo.belleza_objetos, ritmo.belleza_estado, ritmo.belleza_mutaciones TO ritmo_api;
-- El historial solo se escribe desde el trigger, no desde la API ni siquiera como Admin.
GRANT SELECT ON ritmo.bitacora TO ritmo_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ritmo.belleza_integraciones, ritmo.belleza_whatsapp_contactos,
  ritmo.belleza_whatsapp_entradas, ritmo.belleza_whatsapp_cola TO ritmo_api;
COMMIT;
