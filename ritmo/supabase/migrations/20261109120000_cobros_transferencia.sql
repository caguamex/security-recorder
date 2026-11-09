-- Preparación local: requiere respaldo y aprobación de Antonio antes de aplicar. Va después de 20261030214547.
-- Cobro por transferencia: el salón pide pagar, ve la CLABE y una referencia, avisa «Ya transferí» y el
-- administrador de la plataforma confirma el pago en su panel. Nada se cobra automáticamente.
-- Aditiva: no cambia agendas, membresías ni salones con acceso existente (legado).
BEGIN;
ALTER TABLE ritmo.negocios_planes ADD COLUMN pagado_hasta timestamptz;
CREATE TABLE ritmo.pagos_transferencia(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id) ON DELETE CASCADE,
 referencia text NOT NULL UNIQUE CHECK(referencia ~ '^AGX-[0-9A-F]{6}$'),
 plan text NOT NULL CHECK(plan IN ('solo','salon','pro')),anual boolean NOT NULL,
 monto integer NOT NULL CHECK(monto>0),
 estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','reportado','confirmado','rechazado','cancelado')),
 nota text CHECK(length(nota)<=200),motivo text CHECK(length(motivo)<=300),
 creado_por uuid NOT NULL,creado_en timestamptz NOT NULL DEFAULT now(),reportado_en timestamptz,
 revisado_por uuid,revisado_en timestamptz,periodo_inicio timestamptz,periodo_fin timestamptz
);
-- Un solo pago abierto por salón.
CREATE UNIQUE INDEX pagos_transferencia_abierto ON ritmo.pagos_transferencia(negocio_id) WHERE estado IN ('pendiente','reportado');
ALTER TABLE ritmo.pagos_transferencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.pagos_transferencia FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.pagos_transferencia FROM PUBLIC,anon,authenticated,agendappx_whatsapp,ritmo_api;

-- Escritura permitida: acceso existente, prueba vigente o periodo pagado (con 3 días de gracia para transferir).
CREATE OR REPLACE FUNCTION ritmo.plan_permite_escritura(n uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM ritmo.negocios_planes WHERE negocio_id=n AND (estado='legado' OR prueba_fin>clock_timestamp() OR pagado_hasta+interval '3 days'>clock_timestamp()))
$$;
-- Igual que en planes_etapa3, pero el periodo pagado también cuenta como vigente.
CREATE OR REPLACE FUNCTION ritmo.limitar_equipo_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p ritmo.negocios_planes; personas integer; admins integer; max_personas integer; max_admins integer; BEGIN
 SELECT * INTO p FROM ritmo.negocios_planes WHERE negocio_id=NEW.negocio_id FOR UPDATE;
 IF NOT FOUND OR p.estado='legado' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='miembros' THEN
  IF NOT NEW.activo THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.activo AND NEW.rol=OLD.rol THEN RETURN NEW; END IF;
 END IF;
 IF NOT ritmo.plan_permite_escritura(NEW.negocio_id) THEN RAISE EXCEPTION 'agendappx_prueba_finalizada' USING ERRCODE='P0001'; END IF;
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
-- Elegir plan sigue siendo solo para la prueba; con un periodo pagado, el cambio de plan se hace pagando el nuevo.
CREATE OR REPLACE FUNCTION ritmo.elegir_plan(n uuid,p text,a boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actual ritmo.negocios_planes; personas integer; admins integer; max_personas integer; max_admins integer; BEGIN
 IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) OR ritmo.usuario_actual() IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Solo Admin con MFA' USING ERRCODE='42501'; END IF;
 IF p IS NULL OR p NOT IN ('solo','salon','pro') OR a IS NULL THEN RAISE EXCEPTION 'Plan inválido' USING ERRCODE='22023'; END IF;
 SELECT * INTO actual FROM ritmo.negocios_planes WHERE negocio_id=n FOR UPDATE;
 IF NOT FOUND OR actual.estado='legado' THEN RAISE EXCEPTION 'El acceso existente se conserva' USING ERRCODE='22023'; END IF;
 IF actual.pagado_hasta>clock_timestamp() THEN RAISE EXCEPTION 'agendappx_plan_pagado' USING ERRCODE='P0001'; END IF;
 IF actual.prueba_fin<=clock_timestamp() THEN RAISE EXCEPTION 'agendappx_prueba_finalizada' USING ERRCODE='P0001'; END IF;
 SELECT count(*),count(*) FILTER(WHERE rol='admin') INTO personas,admins FROM ritmo.miembros WHERE negocio_id=n AND activo;
 max_personas:=CASE p WHEN 'solo' THEN 1 WHEN 'salon' THEN 5 ELSE 2147483647 END;
 max_admins:=CASE p WHEN 'solo' THEN 1 WHEN 'salon' THEN 2 ELSE 2147483647 END;
 IF personas>max_personas OR admins>max_admins THEN RAISE EXCEPTION 'agendappx_limite_plan' USING ERRCODE='P0001'; END IF;
 UPDATE ritmo.negocios_planes SET plan=p,anual=a,elegido_en=clock_timestamp() WHERE negocio_id=n;
END $$;

-- Precio en el servidor (mismo catálogo que planes/catalogo.ts): fundadora paga $199 el plan Salón; anual = 10 meses.
CREATE FUNCTION ritmo.precio_plan(p text,a boolean,fundadora boolean) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT (CASE p WHEN 'solo' THEN 249 WHEN 'salon' THEN CASE WHEN fundadora THEN 199 ELSE 449 END WHEN 'pro' THEN 799 END)*(CASE WHEN a THEN 10 ELSE 1 END)
$$;
CREATE FUNCTION ritmo.exigir_admin_negocio(n uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) OR ritmo.usuario_actual() IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Solo Admin' USING ERRCODE='42501'; END IF; END $$;
-- El salón pide pagar: se crea (o reemplaza) su pago pendiente con una referencia única.
CREATE FUNCTION ritmo.pago_solicitar(n uuid,p text,a boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actual ritmo.negocios_planes; personas integer; admins integer; max_personas integer; max_admins integer; ref text; nuevo ritmo.pagos_transferencia; BEGIN
 PERFORM ritmo.exigir_admin_negocio(n);
 IF p IS NULL OR p NOT IN ('solo','salon','pro') OR a IS NULL THEN RAISE EXCEPTION 'Plan inválido' USING ERRCODE='22023'; END IF;
 SELECT * INTO actual FROM ritmo.negocios_planes WHERE negocio_id=n FOR UPDATE;
 IF NOT FOUND OR actual.estado='legado' THEN RAISE EXCEPTION 'Tu acceso existente no requiere pago' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM ritmo.pagos_transferencia WHERE negocio_id=n AND estado='reportado') THEN RAISE EXCEPTION 'Ya tienes un pago por confirmar' USING ERRCODE='22023'; END IF;
 SELECT count(*),count(*) FILTER(WHERE rol='admin') INTO personas,admins FROM ritmo.miembros WHERE negocio_id=n AND activo;
 max_personas:=CASE p WHEN 'solo' THEN 1 WHEN 'salon' THEN 5 ELSE 2147483647 END;
 max_admins:=CASE p WHEN 'solo' THEN 1 WHEN 'salon' THEN 2 ELSE 2147483647 END;
 IF personas>max_personas OR admins>max_admins THEN RAISE EXCEPTION 'agendappx_limite_plan' USING ERRCODE='P0001'; END IF;
 UPDATE ritmo.pagos_transferencia SET estado='cancelado' WHERE negocio_id=n AND estado='pendiente';
 LOOP ref:='AGX-'||upper(substr(md5(gen_random_uuid()::text),1,6));
  EXIT WHEN NOT EXISTS(SELECT 1 FROM ritmo.pagos_transferencia WHERE referencia=ref); END LOOP;
 INSERT INTO ritmo.pagos_transferencia(negocio_id,referencia,plan,anual,monto,creado_por)
  VALUES(n,ref,p,a,ritmo.precio_plan(p,a,actual.fundadora_numero IS NOT NULL),auth.uid()) RETURNING * INTO nuevo;
 RETURN jsonb_build_object('id',nuevo.id,'referencia',nuevo.referencia,'monto',nuevo.monto,'plan',nuevo.plan,'anual',nuevo.anual,'estado',nuevo.estado);
END $$;
-- «Ya transferí»: queda por confirmar. La nota es opcional (banco, hora o últimos dígitos).
CREATE FUNCTION ritmo.pago_reportar(n uuid,id uuid,nota text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM ritmo.exigir_admin_negocio(n);
 UPDATE ritmo.pagos_transferencia t SET estado='reportado',reportado_en=now(),nota=nullif(left(trim(coalesce(pago_reportar.nota,'')),200),'') WHERE t.id=pago_reportar.id AND t.negocio_id=n AND t.estado='pendiente';
 IF NOT FOUND THEN RAISE EXCEPTION 'Este pago ya no está pendiente' USING ERRCODE='22023'; END IF;
END $$;
CREATE FUNCTION ritmo.pago_cancelar(n uuid,id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM ritmo.exigir_admin_negocio(n);
 UPDATE ritmo.pagos_transferencia t SET estado='cancelado' WHERE t.id=pago_cancelar.id AND t.negocio_id=n AND t.estado='pendiente';
 IF NOT FOUND THEN RAISE EXCEPTION 'Este pago ya no se puede cancelar' USING ERRCODE='22023'; END IF;
END $$;
CREATE FUNCTION ritmo.pagos_negocio(n uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM ritmo.exigir_admin_negocio(n);
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'referencia',referencia,'plan',plan,'anual',anual,'monto',monto,'estado',estado,'creadoEn',creado_en,'reportadoEn',reportado_en,'periodoFin',periodo_fin,'motivo',motivo) ORDER BY creado_en DESC)
  FROM (SELECT * FROM ritmo.pagos_transferencia WHERE negocio_id=n AND estado<>'cancelado' ORDER BY creado_en DESC LIMIT 12) x),'[]'::jsonb);
END $$;

-- Panel: pagos por confirmar. Solo el administrador de la plataforma (la base lo vuelve a exigir).
CREATE FUNCTION ritmo.plataforma_pagos() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM ritmo.exigir_admin_plataforma();
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'negocioId',t.negocio_id,'salon',n.nombre,'referencia',t.referencia,'plan',t.plan,'anual',t.anual,'monto',t.monto,'estado',t.estado,'nota',t.nota,'creadoEn',t.creado_en,'reportadoEn',t.reportado_en,'pagadoHasta',p.pagado_hasta) ORDER BY t.estado DESC,coalesce(t.reportado_en,t.creado_en))
  FROM ritmo.pagos_transferencia t JOIN ritmo.negocios n ON n.id=t.negocio_id LEFT JOIN ritmo.negocios_planes p ON p.negocio_id=t.negocio_id WHERE t.estado IN ('pendiente','reportado')),'[]'::jsonb);
END $$;
-- Confirmar: el periodo empieza al terminar lo ya cubierto (prueba o pago anterior) y el plan cambia al pagado.
CREATE FUNCTION ritmo.plataforma_pago_confirmar(id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t ritmo.pagos_transferencia; p ritmo.negocios_planes; inicio timestamptz; fin timestamptz; BEGIN
 PERFORM ritmo.exigir_admin_plataforma();
 SELECT * INTO t FROM ritmo.pagos_transferencia x WHERE x.id=plataforma_pago_confirmar.id FOR UPDATE;
 IF NOT FOUND OR t.estado NOT IN ('pendiente','reportado') THEN RAISE EXCEPTION 'Este pago ya fue revisado' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM ritmo.negocios_planes WHERE negocio_id=t.negocio_id FOR UPDATE;
 inicio:=greatest(now(),coalesce(p.pagado_hasta,'-infinity'),coalesce(p.prueba_fin,'-infinity'));
 fin:=inicio+CASE WHEN t.anual THEN interval '1 year' ELSE interval '1 month' END;
 UPDATE ritmo.negocios_planes SET plan=t.plan,anual=t.anual,pagado_hasta=fin,elegido_en=now() WHERE negocio_id=t.negocio_id;
 UPDATE ritmo.pagos_transferencia x SET estado='confirmado',revisado_por=auth.uid(),revisado_en=now(),periodo_inicio=inicio,periodo_fin=fin WHERE x.id=t.id;
 INSERT INTO ritmo.plataforma_bitacora(usuario_id,negocio_id,accion,detalle) VALUES(auth.uid(),t.negocio_id,'pago_confirmado',jsonb_build_object('referencia',t.referencia,'monto',t.monto,'plan',t.plan,'anual',t.anual,'hasta',fin));
 RETURN jsonb_build_object('pagadoHasta',fin);
END $$;
CREATE FUNCTION ritmo.plataforma_pago_rechazar(id uuid,motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t ritmo.pagos_transferencia; BEGIN
 PERFORM ritmo.exigir_admin_plataforma();
 IF coalesce(length(trim(motivo)),0) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'Escribe el motivo' USING ERRCODE='22023'; END IF;
 UPDATE ritmo.pagos_transferencia x SET estado='rechazado',motivo=trim(plataforma_pago_rechazar.motivo),revisado_por=auth.uid(),revisado_en=now() WHERE x.id=plataforma_pago_rechazar.id AND x.estado IN ('pendiente','reportado') RETURNING * INTO t;
 IF t.id IS NULL THEN RAISE EXCEPTION 'Este pago ya fue revisado' USING ERRCODE='22023'; END IF;
 INSERT INTO ritmo.plataforma_bitacora(usuario_id,negocio_id,accion,detalle) VALUES(auth.uid(),t.negocio_id,'pago_rechazado',jsonb_build_object('referencia',t.referencia,'motivo',t.motivo));
END $$;
REVOKE ALL ON FUNCTION ritmo.precio_plan(text,boolean,boolean),ritmo.exigir_admin_negocio(uuid),ritmo.pago_solicitar(uuid,text,boolean),ritmo.pago_reportar(uuid,uuid,text),ritmo.pago_cancelar(uuid,uuid),ritmo.pagos_negocio(uuid),ritmo.plataforma_pagos(),ritmo.plataforma_pago_confirmar(uuid),ritmo.plataforma_pago_rechazar(uuid,text) FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.pago_solicitar(uuid,text,boolean),ritmo.pago_reportar(uuid,uuid,text),ritmo.pago_cancelar(uuid,uuid),ritmo.pagos_negocio(uuid),ritmo.plataforma_pagos(),ritmo.plataforma_pago_confirmar(uuid),ritmo.plataforma_pago_rechazar(uuid,text) TO ritmo_api;
COMMIT;
