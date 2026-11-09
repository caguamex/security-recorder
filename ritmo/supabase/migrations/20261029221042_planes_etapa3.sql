-- Preparada localmente: requiere respaldo y confirmación independiente de Antonio.
BEGIN;
DO $$ BEGIN IF current_setting('ritmo.migracion_etapa3',true) IS DISTINCT FROM 'aprobada' THEN RAISE EXCEPTION 'Falta aprobar la migración de planes'; END IF; END $$;
CREATE TABLE ritmo.negocios_planes(
 negocio_id uuid PRIMARY KEY REFERENCES ritmo.negocios(id),plan text NOT NULL DEFAULT 'salon' CHECK(plan IN ('solo','salon','pro')),
 estado text NOT NULL CHECK(estado IN ('legado','prueba')),prueba_inicio timestamptz,prueba_fin timestamptz,
 anual boolean NOT NULL DEFAULT false,elegido_en timestamptz,fundadora_numero integer UNIQUE CHECK(fundadora_numero BETWEEN 1 AND 20),
 factura jsonb NOT NULL DEFAULT '{}',
 CHECK((estado='legado' AND prueba_inicio IS NULL AND prueba_fin IS NULL) OR (estado='prueba' AND prueba_inicio IS NOT NULL AND prueba_fin=prueba_inicio+interval '30 days'))
);
CREATE TABLE ritmo.fundadoras_control(id boolean PRIMARY KEY DEFAULT true CHECK(id),asignados integer NOT NULL CHECK(asignados BETWEEN 0 AND 20));
INSERT INTO ritmo.fundadoras_control(id,asignados) SELECT true,least(count(*),20)::integer FROM ritmo.negocios;
-- Cuentas ya existentes: acceso conservado, sin caducidad ni límite nuevo sobre su equipo.
INSERT INTO ritmo.negocios_planes(negocio_id,plan,estado,fundadora_numero)
 SELECT id,'salon','legado',CASE WHEN posicion<=20 THEN posicion::integer END FROM (SELECT id,row_number() OVER(ORDER BY creado_en,id) AS posicion FROM ritmo.negocios) n;
ALTER TABLE ritmo.negocios_planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.negocios_planes FORCE ROW LEVEL SECURITY;
ALTER TABLE ritmo.fundadoras_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.fundadoras_control FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.negocios_planes,ritmo.fundadoras_control FROM PUBLIC,anon,authenticated,agendappx_whatsapp,ritmo_api;
GRANT SELECT ON ritmo.negocios_planes TO ritmo_api;
CREATE POLICY plan_admin ON ritmo.negocios_planes FOR SELECT TO ritmo_api USING(ritmo.es_admin(negocio_id));
CREATE FUNCTION ritmo.iniciar_prueba_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cupo integer; inicio timestamptz; BEGIN
 inicio:=clock_timestamp();
 UPDATE ritmo.fundadoras_control SET asignados=asignados+1 WHERE id AND asignados<20 RETURNING asignados INTO cupo;
 INSERT INTO ritmo.negocios_planes(negocio_id,plan,estado,prueba_inicio,prueba_fin,fundadora_numero) VALUES(NEW.id,'salon','prueba',inicio,inicio+interval '30 days',cupo);
 RETURN NEW;
END $$;
CREATE TRIGGER nuevo_salon_prueba AFTER INSERT ON ritmo.negocios FOR EACH ROW EXECUTE FUNCTION ritmo.iniciar_prueba_plan();
CREATE FUNCTION ritmo.cupos_fundadoras() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT 20-asignados FROM ritmo.fundadoras_control WHERE id$$;
CREATE FUNCTION ritmo.elegir_plan(n uuid,p text,a boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actual ritmo.negocios_planes; personas integer; admins integer; max_personas integer; max_admins integer; BEGIN
 IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) OR ritmo.usuario_actual() IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Solo Admin con MFA' USING ERRCODE='42501'; END IF;
 IF p IS NULL OR p NOT IN ('solo','salon','pro') OR a IS NULL THEN RAISE EXCEPTION 'Plan inválido' USING ERRCODE='22023'; END IF;
 SELECT * INTO actual FROM ritmo.negocios_planes WHERE negocio_id=n FOR UPDATE;
 IF NOT FOUND OR actual.estado='legado' THEN RAISE EXCEPTION 'El acceso existente se conserva' USING ERRCODE='22023'; END IF;
 IF actual.prueba_fin<=clock_timestamp() THEN RAISE EXCEPTION 'agendappx_prueba_finalizada' USING ERRCODE='P0001'; END IF;
 SELECT count(*),count(*) FILTER(WHERE rol='admin') INTO personas,admins FROM ritmo.miembros WHERE negocio_id=n AND activo;
 max_personas:=CASE p WHEN 'solo' THEN 1 WHEN 'salon' THEN 5 ELSE 2147483647 END;
 max_admins:=CASE p WHEN 'solo' THEN 1 WHEN 'salon' THEN 2 ELSE 2147483647 END;
 IF personas>max_personas OR admins>max_admins THEN RAISE EXCEPTION 'agendappx_limite_plan' USING ERRCODE='P0001'; END IF;
 UPDATE ritmo.negocios_planes SET plan=p,anual=a,elegido_en=clock_timestamp() WHERE negocio_id=n;
END $$;
CREATE FUNCTION ritmo.guardar_factura_plan(n uuid,d jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) OR ritmo.usuario_actual() IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Solo Admin con MFA' USING ERRCODE='42501'; END IF;
 IF d IS NULL OR jsonb_typeof(d)<>'object' OR octet_length(d::text)>4096 OR EXISTS(SELECT 1 FROM jsonb_each(d) x WHERE x.key NOT IN ('rfc','razonSocial','codigoPostal','regimen','usoCFDI','correo') OR jsonb_typeof(x.value)<>'string' OR length(x.value#>>'{}')>250) THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 UPDATE ritmo.negocios_planes SET factura=d WHERE negocio_id=n;
END $$;
-- Las altas y cambios de rol se serializan con la misma fila del plan.
CREATE FUNCTION ritmo.limitar_equipo_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p ritmo.negocios_planes; personas integer; admins integer; max_personas integer; max_admins integer; BEGIN
 SELECT * INTO p FROM ritmo.negocios_planes WHERE negocio_id=NEW.negocio_id FOR UPDATE;
 IF NOT FOUND OR p.estado='legado' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='miembros' THEN
  IF NOT NEW.activo THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.activo AND NEW.rol=OLD.rol THEN RETURN NEW; END IF;
 END IF;
 IF p.prueba_fin<=clock_timestamp() THEN RAISE EXCEPTION 'agendappx_prueba_finalizada' USING ERRCODE='P0001'; END IF;
 max_personas:=CASE p.plan WHEN 'solo' THEN 1 WHEN 'salon' THEN 5 ELSE 2147483647 END;
 max_admins:=CASE p.plan WHEN 'solo' THEN 1 WHEN 'salon' THEN 2 ELSE 2147483647 END;
 IF TG_TABLE_NAME='miembros' THEN
  SELECT count(*),count(*) FILTER(WHERE rol='admin') INTO personas,admins FROM ritmo.miembros WHERE negocio_id=NEW.negocio_id AND activo AND usuario_id<>NEW.usuario_id;
 ELSE
  SELECT count(*),count(*) FILTER(WHERE rol='admin') INTO personas,admins FROM ritmo.miembros WHERE negocio_id=NEW.negocio_id AND activo;
  SELECT personas+count(*),admins+count(*) FILTER(WHERE rol='admin') INTO personas,admins FROM ritmo.invitaciones WHERE negocio_id=NEW.negocio_id AND usada_en IS NULL AND revocada_en IS NULL AND vence_en>clock_timestamp();
 END IF;
 IF personas+1>max_personas OR admins+(CASE WHEN NEW.rol='admin' THEN 1 ELSE 0 END)>max_admins THEN RAISE EXCEPTION 'agendappx_limite_plan' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER limite_miembros_plan BEFORE INSERT OR UPDATE ON ritmo.miembros FOR EACH ROW EXECUTE FUNCTION ritmo.limitar_equipo_plan();
CREATE TRIGGER limite_invitaciones_plan BEFORE INSERT ON ritmo.invitaciones FOR EACH ROW EXECUTE FUNCTION ritmo.limitar_equipo_plan();
CREATE FUNCTION ritmo.plan_permite_escritura(n uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM ritmo.negocios_planes WHERE negocio_id=n AND (estado='legado' OR prueba_fin>clock_timestamp()))
$$;
CREATE FUNCTION ritmo.proteger_fin_prueba() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT ritmo.plan_permite_escritura(NEW.negocio_id) THEN RAISE EXCEPTION 'agendappx_prueba_finalizada' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$;
CREATE TRIGGER plan_escrituras BEFORE INSERT OR UPDATE ON ritmo.belleza_objetos FOR EACH ROW EXECUTE FUNCTION ritmo.proteger_fin_prueba();
REVOKE ALL ON FUNCTION ritmo.iniciar_prueba_plan(),ritmo.cupos_fundadoras(),ritmo.elegir_plan(uuid,text,boolean),ritmo.guardar_factura_plan(uuid,jsonb),ritmo.limitar_equipo_plan(),ritmo.plan_permite_escritura(uuid),ritmo.proteger_fin_prueba() FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.cupos_fundadoras(),ritmo.elegir_plan(uuid,text,boolean),ritmo.guardar_factura_plan(uuid,jsonb) TO ritmo_api;
COMMIT;
