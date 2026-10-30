-- Preparación local: requiere respaldo y aprobación de Antonio antes de aplicar.
-- Panel de Agendappx (plataforma): solo personas en ritmo.plataforma_admins, con MFA y sesión vigente.
-- Aditiva: no cambia agendas, membresías ni planes existentes.
BEGIN;
DO $$ BEGIN IF nullif(current_setting('ritmo.plataforma_admin',true),'') IS NULL THEN RAISE EXCEPTION 'Falta identificar al administrador de la plataforma (ritmo.plataforma_admin)'; END IF; END $$;
CREATE TABLE ritmo.plataforma_admins(usuario_id uuid PRIMARY KEY REFERENCES auth.users(id),creado_en timestamptz NOT NULL DEFAULT now());
INSERT INTO ritmo.plataforma_admins(usuario_id) VALUES(current_setting('ritmo.plataforma_admin')::uuid);
-- Pausa de un salón: no puede escribir en su agenda y sale de Explorar. Sus datos se conservan.
CREATE TABLE ritmo.negocios_suspendidos(negocio_id uuid PRIMARY KEY REFERENCES ritmo.negocios(id),motivo text NOT NULL CHECK(length(trim(motivo)) BETWEEN 1 AND 300),por uuid NOT NULL REFERENCES auth.users(id),en timestamptz NOT NULL DEFAULT now());
CREATE TABLE ritmo.plataforma_bitacora(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,usuario_id uuid NOT NULL REFERENCES auth.users(id),negocio_id uuid REFERENCES ritmo.negocios(id),accion text NOT NULL,detalle jsonb NOT NULL DEFAULT '{}',en timestamptz NOT NULL DEFAULT clock_timestamp());
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['plataforma_admins','negocios_suspendidos','plataforma_bitacora'] LOOP
  EXECUTE format('ALTER TABLE ritmo.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE ritmo.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON ritmo.%I FROM PUBLIC,anon,authenticated,ritmo_api,agendappx_whatsapp',t);
 END LOOP;
END $$;
-- Todo el acceso pasa por funciones; el rol de la API no lee estas tablas directamente.
CREATE FUNCTION ritmo.es_admin_plataforma() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN ritmo.usuario_actual() IS NOT NULL AND ritmo.usuario_actual()=auth.uid()
 AND (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal')='aal2' AND ritmo.sesion_vigente()
 AND EXISTS(SELECT 1 FROM ritmo.plataforma_admins WHERE usuario_id=auth.uid()); END $$;
CREATE FUNCTION ritmo.exigir_admin_plataforma() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT ritmo.es_admin_plataforma() THEN RAISE EXCEPTION 'Solo el administrador de Agendappx' USING ERRCODE='42501'; END IF; END $$;
-- Cifras generales de la plataforma.
CREATE FUNCTION ritmo.plataforma_resumen() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM ritmo.exigir_admin_plataforma();
 RETURN jsonb_build_object(
  'salones',(SELECT count(*) FROM ritmo.negocios),
  'nuevosSemana',(SELECT count(*) FROM ritmo.negocios WHERE creado_en>now()-interval '7 days'),
  'enPrueba',(SELECT count(*) FROM ritmo.negocios_planes WHERE estado='prueba' AND prueba_fin>now()),
  'pruebaPorVencer',(SELECT count(*) FROM ritmo.negocios_planes WHERE estado='prueba' AND prueba_fin>now() AND prueba_fin<=now()+interval '5 days'),
  'pruebaVencida',(SELECT count(*) FROM ritmo.negocios_planes WHERE estado='prueba' AND prueba_fin<=now()),
  'heredados',(SELECT count(*) FROM ritmo.negocios_planes WHERE estado='legado'),
  'porPlan',(SELECT coalesce(jsonb_object_agg(plan,n),'{}') FROM (SELECT plan,count(*) AS n FROM ritmo.negocios_planes GROUP BY plan) x),
  'fundadoras',(SELECT count(*) FROM ritmo.negocios_planes WHERE fundadora_numero IS NOT NULL),
  'personas',(SELECT count(DISTINCT usuario_id) FROM ritmo.miembros WHERE activo),
  'clientas',(SELECT count(*) FROM ritmo.social_clientes),
  'citasSemana',(SELECT count(*) FROM ritmo.belleza_objetos WHERE tipo='cita' AND data IS NOT NULL AND actualizado_en>now()-interval '7 days'),
  'solicitudesSemana',(SELECT count(*) FROM ritmo.publico_reservas WHERE creado_en>now()-interval '7 days'),
  'visiblesExplorar',(SELECT count(*) FROM ritmo.publico_perfiles WHERE visible),
  'verificados',(SELECT count(*) FROM ritmo.publico_perfiles WHERE verificado),
  'suspendidos',(SELECT count(*) FROM ritmo.negocios_suspendidos),
  'reportesPendientes',(SELECT count(*) FROM ritmo.social_reportes WHERE estado='pendiente'),
  'registrosSemana',(SELECT count(*) FROM ritmo.registro_solicitudes WHERE completado_en>now()-interval '7 days'),
  'registrosSinTerminar',(SELECT count(*) FROM ritmo.registro_solicitudes WHERE completado_en IS NULL AND creado_en>now()-interval '7 days'),
  'codigosHoy',(SELECT count(*) FROM ritmo.acceso_solicitudes WHERE canal='whatsapp' AND creado_en>now()-interval '24 hours'),
  'codigosFallidosHoy',(SELECT count(*) FROM ritmo.acceso_solicitudes WHERE canal='whatsapp' AND estado IN ('fallido','incierto') AND creado_en>now()-interval '24 hours'),
  'whatsappPlataforma',(SELECT jsonb_build_object('estado',to_jsonb(c)->>'estado','ultimaConexion',to_jsonb(c)->>'ultima_conexion') FROM ritmo.plataforma_conexiones c WHERE c.negocio_id='codigos'));
END $$;
-- Un renglón por salón con lo necesario para darle seguimiento. Sin agendas ni datos de clientas.
CREATE FUNCTION ritmo.plataforma_salones() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM ritmo.exigir_admin_plataforma();
 RETURN coalesce((SELECT jsonb_agg(x ORDER BY x->>'creadoEn' DESC) FROM (SELECT jsonb_build_object(
  'id',n.id,'nombre',coalesce(nullif(s.data->>'negocio',''),n.nombre),'slug',e.slug,'creadoEn',n.creado_en,
  'plan',p.plan,'estado',p.estado,'pruebaFin',p.prueba_fin,'fundadora',p.fundadora_numero,'anual',p.anual,
  'duena',(SELECT jsonb_build_object('nombre',m.nombre,'whatsapp',u.phone) FROM ritmo.miembros m JOIN auth.users u ON u.id=m.usuario_id WHERE m.negocio_id=n.id AND m.rol='admin' AND m.activo ORDER BY m.creado_en LIMIT 1),
  'personas',(SELECT count(*) FROM ritmo.miembros m WHERE m.negocio_id=n.id AND m.activo),
  'citas30',(SELECT count(*) FROM ritmo.belleza_objetos o WHERE o.negocio_id=n.id AND o.tipo='cita' AND o.data IS NOT NULL AND o.actualizado_en>now()-interval '30 days'),
  'servicios',(SELECT count(*) FROM ritmo.belleza_objetos o WHERE o.negocio_id=n.id AND o.tipo='servicio' AND o.data IS NOT NULL),
  'ultimoUso',(SELECT max(a.ultima_actividad) FROM ritmo.actividad_sesiones a JOIN ritmo.miembros m ON m.usuario_id=a.usuario_id AND m.negocio_id=n.id),
  'visible',coalesce(pp.visible,false),'verificado',coalesce(pp.verificado,false),'ciudad',pp.ciudad,
  'trabajos',(SELECT count(*) FROM ritmo.social_trabajos t WHERE t.negocio_id=n.id),
  'suspendido',sp.motivo IS NOT NULL,'motivoSuspension',sp.motivo) AS x
  FROM ritmo.negocios n LEFT JOIN ritmo.negocios_enlaces e ON e.negocio_id=n.id LEFT JOIN ritmo.negocios_planes p ON p.negocio_id=n.id
  LEFT JOIN ritmo.publico_perfiles pp ON pp.negocio_id=n.id LEFT JOIN ritmo.negocios_suspendidos sp ON sp.negocio_id=n.id
  LEFT JOIN ritmo.belleza_objetos s ON s.negocio_id=n.id AND s.id='__settings') q),'[]'::jsonb);
END $$;
-- Acciones del panel. Cada una queda en la bitácora con quién y cuándo.
CREATE FUNCTION ritmo.plataforma_accion(n uuid,accion text,valor jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE dias integer; BEGIN PERFORM ritmo.exigir_admin_plataforma();
 IF NOT EXISTS(SELECT 1 FROM ritmo.negocios WHERE id=n) THEN RAISE EXCEPTION 'Salón inexistente' USING ERRCODE='22023'; END IF;
 IF accion='verificar' THEN
  INSERT INTO ritmo.publico_perfiles(negocio_id,visible,verificado) VALUES(n,false,(valor->>'si')::boolean)
  ON CONFLICT(negocio_id) DO UPDATE SET verificado=(valor->>'si')::boolean,actualizado_en=now();
 ELSIF accion='ocultar' THEN
  UPDATE ritmo.publico_perfiles SET visible=false,actualizado_en=now() WHERE negocio_id=n;
 ELSIF accion='extender_prueba' THEN
  dias:=(valor->>'dias')::integer;IF dias IS NULL OR dias NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Días inválidos' USING ERRCODE='22023'; END IF;
  -- La prueba conserva 30 días exactos: se recorre la ventana completa.
  UPDATE ritmo.negocios_planes SET prueba_inicio=prueba_inicio+make_interval(days=>dias),prueba_fin=prueba_fin+make_interval(days=>dias) WHERE negocio_id=n AND estado='prueba';
  IF NOT FOUND THEN RAISE EXCEPTION 'Este salón no está en prueba' USING ERRCODE='22023'; END IF;
 ELSIF accion='plan' THEN
  IF valor->>'plan' NOT IN ('solo','salon','pro') THEN RAISE EXCEPTION 'Plan inválido' USING ERRCODE='22023'; END IF;
  UPDATE ritmo.negocios_planes SET plan=valor->>'plan' WHERE negocio_id=n;
  IF NOT FOUND THEN RAISE EXCEPTION 'Salón sin plan' USING ERRCODE='22023'; END IF;
 ELSIF accion='suspender' THEN
  IF coalesce(length(trim(valor->>'motivo')),0) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Escribe el motivo' USING ERRCODE='22023'; END IF;
  INSERT INTO ritmo.negocios_suspendidos(negocio_id,motivo,por) VALUES(n,trim(valor->>'motivo'),auth.uid()) ON CONFLICT(negocio_id) DO UPDATE SET motivo=EXCLUDED.motivo,por=EXCLUDED.por,en=now();
  UPDATE ritmo.publico_perfiles SET visible=false,actualizado_en=now() WHERE negocio_id=n;
 ELSIF accion='reactivar' THEN
  DELETE FROM ritmo.negocios_suspendidos WHERE negocio_id=n;
 ELSE RAISE EXCEPTION 'Acción inválida' USING ERRCODE='22023'; END IF;
 INSERT INTO ritmo.plataforma_bitacora(usuario_id,negocio_id,accion,detalle) VALUES(auth.uid(),n,accion,coalesce(valor,'{}'));
 RETURN jsonb_build_object('hecho',true);
END $$;
CREATE FUNCTION ritmo.plataforma_bitacora_reciente() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM ritmo.exigir_admin_plataforma();
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('accion',b.accion,'detalle',b.detalle,'en',b.en,'salon',coalesce(n.nombre,'')) ORDER BY b.id DESC)
  FROM (SELECT * FROM ritmo.plataforma_bitacora ORDER BY id DESC LIMIT 50) b LEFT JOIN ritmo.negocios n ON n.id=b.negocio_id),'[]'::jsonb);
END $$;
-- Un salón en pausa no puede escribir en su agenda (además del fin de prueba que ya existía).
CREATE OR REPLACE FUNCTION ritmo.proteger_fin_prueba() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF EXISTS(SELECT 1 FROM ritmo.negocios_suspendidos WHERE negocio_id=NEW.negocio_id) THEN RAISE EXCEPTION 'agendappx_salon_suspendido' USING ERRCODE='P0001'; END IF;
 IF NOT ritmo.plan_permite_escritura(NEW.negocio_id) THEN RAISE EXCEPTION 'agendappx_prueba_finalizada' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$;
-- Un salón en pausa no vuelve a Explorar aunque su Admin active el perfil.
CREATE FUNCTION ritmo.perfil_sin_pausa() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NEW.visible AND EXISTS(SELECT 1 FROM ritmo.negocios_suspendidos WHERE negocio_id=NEW.negocio_id) THEN NEW.visible:=false; END IF; RETURN NEW; END $$;
CREATE TRIGGER perfil_sin_pausa BEFORE INSERT OR UPDATE ON ritmo.publico_perfiles FOR EACH ROW EXECUTE FUNCTION ritmo.perfil_sin_pausa();
REVOKE ALL ON FUNCTION ritmo.es_admin_plataforma(),ritmo.exigir_admin_plataforma(),ritmo.plataforma_resumen(),ritmo.plataforma_salones(),ritmo.plataforma_accion(uuid,text,jsonb),ritmo.plataforma_bitacora_reciente(),ritmo.perfil_sin_pausa() FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.es_admin_plataforma(),ritmo.plataforma_resumen(),ritmo.plataforma_salones(),ritmo.plataforma_accion(uuid,text,jsonb),ritmo.plataforma_bitacora_reciente() TO ritmo_api;
COMMIT;
