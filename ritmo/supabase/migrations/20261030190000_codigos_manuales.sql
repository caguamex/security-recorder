-- Preparación local: requiere respaldo y aprobación de Antonio antes de aplicar. Va después del panel (20261030180000).
-- Respaldo manual de códigos: si WhatsApp no entrega un código, queda cifrado para que el administrador
-- de la plataforma lo envíe desde su propio WhatsApp. Nunca se guarda en claro.
BEGIN;
ALTER TABLE ritmo.acceso_solicitudes DROP CONSTRAINT acceso_solicitudes_estado_check;
ALTER TABLE ritmo.acceso_solicitudes ADD CONSTRAINT acceso_solicitudes_estado_check CHECK(estado IN ('pendiente','enviando','enviado','verificando','usado','fallido','incierto','manual'));
CREATE TABLE ritmo.codigos_manuales(
 solicitud_id uuid PRIMARY KEY REFERENCES ritmo.acceso_solicitudes(id) ON DELETE CASCADE,
 -- AES-256-GCM con una llave derivada de ACCESO_HMAC_KEY: base64url(iv).base64url(tag).base64url(datos)
 cifrado text NOT NULL CHECK(length(cifrado)<=500 AND cifrado ~ '^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{20,}$'),
 motivo text NOT NULL CHECK(motivo IN ('desconectado','detenido','sin_confirmar','error')),
 creado_en timestamptz NOT NULL DEFAULT now(),vence_en timestamptz NOT NULL,
 avisado_en timestamptz,revelado_en timestamptz,revelado_por uuid REFERENCES auth.users(id),entregado_en timestamptz,entregado_por uuid REFERENCES auth.users(id)
);
ALTER TABLE ritmo.codigos_manuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.codigos_manuales FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.codigos_manuales FROM PUBLIC,anon,authenticated,ritmo_api,agendappx_whatsapp;
-- El servicio de WhatsApp solo puede agregar; no lee ni cambia lo guardado.
GRANT INSERT ON ritmo.codigos_manuales TO agendappx_whatsapp;
CREATE POLICY servicio_agrega ON ritmo.codigos_manuales FOR INSERT TO agendappx_whatsapp WITH CHECK(true);
-- Códigos pendientes para el panel (vigentes y sin entregar). Solo administrador de plataforma con MFA.
CREATE FUNCTION ritmo.plataforma_codigos() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM ritmo.exigir_admin_plataforma();
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.solicitud_id,'cifrado',m.cifrado,'motivo',m.motivo,'tipo',s.tipo,'creadoEn',m.creado_en,'venceEn',m.vence_en,'revelado',m.revelado_en IS NOT NULL,'usado',s.estado='usado') ORDER BY m.creado_en DESC)
  FROM ritmo.codigos_manuales m JOIN ritmo.acceso_solicitudes s ON s.id=m.solicitud_id WHERE m.entregado_en IS NULL AND m.vence_en>now() AND s.estado<>'usado'),'[]'::jsonb);
END $$;
-- Ver el código queda en la bitácora: quién y cuándo.
CREATE FUNCTION ritmo.plataforma_revelar_codigo(id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c text; BEGIN PERFORM ritmo.exigir_admin_plataforma();
 UPDATE ritmo.codigos_manuales SET revelado_en=coalesce(revelado_en,now()),revelado_por=coalesce(revelado_por,auth.uid()) WHERE solicitud_id=id AND entregado_en IS NULL AND vence_en>now() RETURNING cifrado INTO c;
 IF c IS NULL THEN RAISE EXCEPTION 'El código ya venció o ya se entregó' USING ERRCODE='22023'; END IF;
 INSERT INTO ritmo.plataforma_bitacora(usuario_id,accion,detalle) VALUES(auth.uid(),'ver_codigo',jsonb_build_object('solicitud',id));
 RETURN c; END $$;
CREATE FUNCTION ritmo.plataforma_codigo_entregado(id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM ritmo.exigir_admin_plataforma();
 UPDATE ritmo.codigos_manuales SET entregado_en=now(),entregado_por=auth.uid() WHERE solicitud_id=id AND entregado_en IS NULL AND revelado_en IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Primero abre el código' USING ERRCODE='22023'; END IF;
 INSERT INTO ritmo.plataforma_bitacora(usuario_id,accion,detalle) VALUES(auth.uid(),'codigo_enviado',jsonb_build_object('solicitud',id));
END $$;
-- Avisos al celular del administrador: toma los códigos sin avisar y devuelve sus dispositivos.
-- Lo llama el Worker sin identidad (aviso firmado del servicio o la tarea programada), solo con el rol de la API.
CREATE FUNCTION ritmo.plataforma_tomar_avisos_codigos() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer; BEGIN
 WITH x AS (UPDATE ritmo.codigos_manuales SET avisado_en=now() WHERE avisado_en IS NULL AND vence_en>now() RETURNING 1) SELECT count(*) INTO n FROM x;
 IF n=0 THEN RETURN jsonb_build_object('codigos',0,'dispositivos','[]'::jsonb); END IF;
 RETURN jsonb_build_object('codigos',n,'dispositivos',coalesce((SELECT jsonb_agg(p.suscripcion) FROM ritmo.push_suscripciones p JOIN ritmo.plataforma_admins a ON a.usuario_id=p.usuario_id WHERE p.activo),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION ritmo.plataforma_codigos(),ritmo.plataforma_revelar_codigo(uuid),ritmo.plataforma_codigo_entregado(uuid),ritmo.plataforma_tomar_avisos_codigos() FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.plataforma_codigos(),ritmo.plataforma_revelar_codigo(uuid),ritmo.plataforma_codigo_entregado(uuid),ritmo.plataforma_tomar_avisos_codigos() TO ritmo_api;
COMMIT;
