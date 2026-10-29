-- Etapa 2 aditiva. No aplicar sin respaldo y confirmación específica de Antonio.
BEGIN;
DO $$ BEGIN IF current_setting('ritmo.migracion_etapa2',true) IS DISTINCT FROM 'aprobada' THEN RAISE EXCEPTION 'Falta aprobar la migración de horarios de la etapa 2'; END IF; END $$;
CREATE TABLE ritmo.horario_especial (
 negocio_id uuid NOT NULL,usuario_id uuid NOT NULL,fecha date NOT NULL,
 tipo text NOT NULL CHECK(tipo IN ('libre','horario')),desde text,hasta text,
 PRIMARY KEY(negocio_id,usuario_id,fecha),FOREIGN KEY(negocio_id,usuario_id) REFERENCES ritmo.miembros(negocio_id,usuario_id),
 CHECK((tipo='libre' AND desde IS NULL AND hasta IS NULL) OR (tipo='horario' AND desde ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND hasta ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND desde IS NOT NULL AND hasta IS NOT NULL AND desde<hasta))
);
ALTER TABLE ritmo.horario_especial ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.horario_especial FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.horario_especial FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT SELECT ON ritmo.horario_especial TO ritmo_api;
CREATE POLICY horario_miembros ON ritmo.horario_especial FOR SELECT TO ritmo_api USING ((ritmo.miembro_actual(negocio_id)).usuario_id IS NOT NULL);
-- Excepción estrecha para editar únicamente el horario propio; no concede UPDATE general sobre miembros.
CREATE FUNCTION ritmo.guardar_horario(n uuid,u uuid,h jsonb,e jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m ritmo.miembros; kv record; v jsonb; BEGIN
 m:=ritmo.miembro_actual(n);
 IF ritmo.usuario_actual() IS DISTINCT FROM auth.uid() OR NOT ritmo.sesion_vigente() OR m.usuario_id IS NULL OR (m.rol<>'admin' AND m.usuario_id<>u) THEN RAISE EXCEPTION 'Horario de otra persona' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM ritmo.miembros WHERE negocio_id=n AND usuario_id=u AND activo) THEN RAISE EXCEPTION 'Persona no disponible' USING ERRCODE='22023'; END IF;
 IF h IS NULL OR jsonb_typeof(h)<>'object' OR e IS NULL OR jsonb_typeof(e)<>'array' OR jsonb_array_length(e)>370 THEN RAISE EXCEPTION 'Horario inválido' USING ERRCODE='22023'; END IF;
 FOR kv IN SELECT * FROM jsonb_each(h) LOOP
  IF kv.key NOT IN ('lun','mar','mie','jue','vie','sab','dom','comida') OR (kv.value<>'null'::jsonb AND (jsonb_typeof(kv.value)<>'array' OR jsonb_array_length(kv.value)<>2 OR jsonb_typeof(kv.value->0)<>'string' OR jsonb_typeof(kv.value->1)<>'string' OR (kv.value->>0) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR (kv.value->>1) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR (kv.value->>0)>=(kv.value->>1))) THEN RAISE EXCEPTION 'Horario inválido' USING ERRCODE='22023'; END IF;
 END LOOP;
 -- El salón serializa cambios de horario y reservas; una actualización no toca citas ni pagos existentes.
 PERFORM 1 FROM ritmo.belleza_estado WHERE negocio_id=n FOR UPDATE;
 UPDATE ritmo.miembros SET horario=h WHERE negocio_id=n AND usuario_id=u AND activo;
 DELETE FROM ritmo.horario_especial WHERE negocio_id=n AND usuario_id=u;
 FOR v IN SELECT * FROM jsonb_array_elements(e) LOOP
  IF v->>'fecha' IS NULL OR (v->>'fecha') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR (v->>'tipo' IS NULL OR v->>'tipo' NOT IN ('libre','horario')) OR EXISTS(SELECT 1 FROM jsonb_object_keys(v) k WHERE k NOT IN ('fecha','tipo','desde','hasta')) THEN RAISE EXCEPTION 'Día especial inválido' USING ERRCODE='22023'; END IF;
  INSERT INTO ritmo.horario_especial(negocio_id,usuario_id,fecha,tipo,desde,hasta) VALUES(n,u,(v->>'fecha')::date,v->>'tipo',CASE WHEN v->>'tipo'='horario' THEN v->>'desde' END,CASE WHEN v->>'tipo'='horario' THEN v->>'hasta' END);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION ritmo.guardar_horario(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.guardar_horario(uuid,uuid,jsonb,jsonb) TO ritmo_api;
COMMIT;
