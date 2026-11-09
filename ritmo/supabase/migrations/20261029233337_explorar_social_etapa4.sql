-- Etapa 4, preparaciÃ³n local. Requiere respaldo y confirmaciÃ³n separada.
BEGIN;
DO $$ BEGIN
 IF current_setting('ritmo.migracion_etapa4',true) IS DISTINCT FROM 'aprobada' THEN RAISE EXCEPTION 'Falta aprobar Explorar y Social'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=nullif(current_setting('ritmo.moderador_aprobado',true),'')::uuid) THEN RAISE EXCEPTION 'Falta identificar al moderador verificado'; END IF;
END $$;
CREATE TABLE ritmo.publico_perfiles(
 negocio_id uuid PRIMARY KEY REFERENCES ritmo.negocios(id),visible boolean NOT NULL DEFAULT true,
 descripcion text NOT NULL DEFAULT '' CHECK(length(descripcion)<=1000),ciudad text NOT NULL DEFAULT '' CHECK(length(ciudad)<=100),
 colonia text NOT NULL DEFAULT '' CHECK(length(colonia)<=150),direccion text NOT NULL DEFAULT '' CHECK(length(direccion)<=300),whatsapp text NOT NULL DEFAULT '' CHECK(whatsapp='' OR whatsapp ~ '^52[0-9]{10}$'),
 lat double precision CHECK(lat BETWEEN -90 AND 90),lon double precision CHECK(lon BETWEEN -180 AND 180),
 logo text CHECK(length(logo)<=48000),portada text CHECK(length(portada)<=48000),verificado boolean NOT NULL DEFAULT false,
 actualizado_en timestamptz NOT NULL DEFAULT now(),CHECK((lat IS NULL)=(lon IS NULL))
);
-- Los negocios existentes deciden cuÃ¡ndo publicar. Los nuevos nacen visibles, sin datos de otras agendas.
INSERT INTO ritmo.publico_perfiles(negocio_id,visible) SELECT id,false FROM ritmo.negocios;
CREATE TABLE ritmo.social_clientes(usuario_id uuid PRIMARY KEY REFERENCES auth.users(id),nombre text NOT NULL CHECK(length(trim(nombre)) BETWEEN 1 AND 100),creado_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE ritmo.social_publicadores(negocio_id uuid NOT NULL,usuario_id uuid NOT NULL,PRIMARY KEY(negocio_id,usuario_id),FOREIGN KEY(negocio_id,usuario_id) REFERENCES ritmo.miembros(negocio_id,usuario_id));
CREATE TABLE ritmo.social_trabajos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),servicio_id text NOT NULL,
 autor uuid NOT NULL REFERENCES auth.users(id),foto text CHECK(length(foto)<=48000),texto text NOT NULL CHECK(length(texto)<=1200),
 estado text NOT NULL DEFAULT 'visible' CHECK(estado IN ('visible','revision','retirado')),permiso_foto boolean NOT NULL CHECK(permiso_foto),
 creado_en timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(negocio_id,servicio_id) REFERENCES ritmo.belleza_objetos(negocio_id,id)
);
CREATE INDEX trabajos_negocio_fecha ON ritmo.social_trabajos(negocio_id,creado_en DESC);
CREATE INDEX trabajos_visibles_fecha ON ritmo.social_trabajos(creado_en DESC,id) WHERE estado='visible';
CREATE TABLE ritmo.social_comentarios(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),trabajo_id uuid NOT NULL REFERENCES ritmo.social_trabajos(id),usuario_id uuid NOT NULL REFERENCES auth.users(id),texto text NOT NULL CHECK(length(trim(texto)) BETWEEN 1 AND 1000),estado text NOT NULL DEFAULT 'visible' CHECK(estado IN ('visible','revision','oculto','retirado')),creado_en timestamptz NOT NULL DEFAULT now());
CREATE INDEX comentarios_trabajo_fecha ON ritmo.social_comentarios(trabajo_id,creado_en);
CREATE TABLE ritmo.social_seguidores(negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),usuario_id uuid NOT NULL REFERENCES auth.users(id),creado_en timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(negocio_id,usuario_id));
CREATE TABLE ritmo.social_me_gusta(trabajo_id uuid NOT NULL REFERENCES ritmo.social_trabajos(id),usuario_id uuid NOT NULL REFERENCES auth.users(id),creado_en timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(trabajo_id,usuario_id));
CREATE TABLE ritmo.social_guardados(usuario_id uuid NOT NULL REFERENCES auth.users(id),tipo text NOT NULL CHECK(tipo IN ('negocio','trabajo')),destino text NOT NULL CHECK(length(destino)<=60),creado_en timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(usuario_id,tipo,destino));
CREATE TABLE ritmo.social_resenas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),cita_id text NOT NULL,usuario_id uuid NOT NULL REFERENCES auth.users(id),estrellas integer NOT NULL CHECK(estrellas BETWEEN 1 AND 5),texto text NOT NULL CHECK(length(texto)<=1500),respuesta text CHECK(length(respuesta)<=1500),estado text NOT NULL DEFAULT 'visible' CHECK(estado IN ('visible','revision','retirada')),creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(negocio_id,cita_id),FOREIGN KEY(negocio_id,cita_id) REFERENCES ritmo.belleza_objetos(negocio_id,id));
CREATE INDEX resenas_negocio ON ritmo.social_resenas(negocio_id) WHERE estado='visible';
CREATE TABLE ritmo.social_reportes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tipo text NOT NULL CHECK(tipo IN ('trabajo','comentario','resena')),destino uuid NOT NULL,reportante_hash text NOT NULL CHECK(reportante_hash ~ '^[a-f0-9]{64}$'),motivo text NOT NULL CHECK(motivo IN ('sin_permiso','ofensivo','incorrecto','otro')),estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','resuelto')),creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(tipo,destino,reportante_hash));
CREATE INDEX reportes_revision ON ritmo.social_reportes(creado_en DESC) WHERE estado='pendiente';
CREATE TABLE ritmo.social_moderadores(usuario_id uuid PRIMARY KEY REFERENCES auth.users(id));
INSERT INTO ritmo.social_moderadores(usuario_id) VALUES(nullif(current_setting('ritmo.moderador_aprobado',true),'')::uuid);
CREATE TABLE ritmo.publico_visitas(negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),fecha date NOT NULL,visitante_hash text NOT NULL CHECK(visitante_hash ~ '^[a-f0-9]{64}$'),PRIMARY KEY(negocio_id,fecha,visitante_hash));
CREATE TABLE ritmo.publico_reservas(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),cita_id text NOT NULL,clienta_id text NOT NULL,
 solicitud_hash text UNIQUE NOT NULL CHECK(solicitud_hash ~ '^[a-f0-9]{64}$'),datos_hash text NOT NULL CHECK(datos_hash ~ '^[a-f0-9]{64}$'),
 ip_hash text NOT NULL CHECK(ip_hash ~ '^[a-f0-9]{64}$'),telefono_hash text NOT NULL CHECK(telefono_hash ~ '^[a-f0-9]{64}$'),
 origen text NOT NULL CHECK(origen IN ('explorar','social')),creado_en timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(negocio_id,cita_id) REFERENCES ritmo.belleza_objetos(negocio_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(negocio_id,clienta_id) REFERENCES ritmo.belleza_objetos(negocio_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX reservas_limite_ip ON ritmo.publico_reservas(ip_hash,creado_en);
CREATE INDEX reservas_limite_telefono ON ritmo.publico_reservas(negocio_id,telefono_hash,creado_en);
CREATE INDEX disponibilidad_publica ON ritmo.belleza_objetos(negocio_id,(data->>'date'),especialista_id) WHERE tipo='cita' AND data IS NOT NULL;

CREATE FUNCTION ritmo.telefono_publico_normalizado(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN length(d)=10 THEN '52'||d WHEN d ~ '^521[0-9]{10}$' THEN '52'||substr(d,4) ELSE d END FROM (SELECT regexp_replace(coalesce(t,''),'[^0-9]','','g') d) s
$$;
CREATE FUNCTION ritmo.usuario_cliente() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; BEGIN
 u:=ritmo.usuario_actual();
 IF u IS NULL OR u IS DISTINCT FROM auth.uid() OR NOT ritmo.sesion_vigente() OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND phone_confirmed_at IS NOT NULL AND ritmo.telefono_publico_normalizado(phone) ~ '^52[0-9]{10}$') THEN RAISE EXCEPTION 'Verifica tu WhatsApp' USING ERRCODE='28000'; END IF;
 RETURN u;
END $$;
CREATE FUNCTION ritmo.es_moderador_social() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN ritmo.usuario_actual() IS NOT NULL AND ritmo.usuario_actual()=auth.uid() AND (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal')='aal2' AND ritmo.sesion_vigente() AND EXISTS(SELECT 1 FROM ritmo.social_moderadores WHERE usuario_id=auth.uid()); END $$;
CREATE FUNCTION ritmo.puede_publicar_social(n uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m ritmo.miembros; BEGIN
 m:=ritmo.miembro_actual(n);
 RETURN m.usuario_id IS NOT NULL AND (m.rol='admin' OR EXISTS(SELECT 1 FROM ritmo.social_publicadores p WHERE p.negocio_id=n AND p.usuario_id=m.usuario_id));
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['publico_perfiles','social_clientes','social_publicadores','social_trabajos','social_comentarios','social_seguidores','social_me_gusta','social_guardados','social_resenas','social_reportes','social_moderadores','publico_visitas','publico_reservas'] LOOP
  EXECUTE format('ALTER TABLE ritmo.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE ritmo.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON ritmo.%I FROM PUBLIC,anon,authenticated,agendappx_whatsapp,ritmo_api',t);
 END LOOP;
END $$;
GRANT SELECT ON ritmo.publico_perfiles,ritmo.social_publicadores,ritmo.social_trabajos,ritmo.publico_visitas,ritmo.social_resenas TO ritmo_api;
CREATE POLICY perfil_admin ON ritmo.publico_perfiles FOR SELECT TO ritmo_api USING(ritmo.es_admin(negocio_id));
CREATE POLICY publicadores_admin ON ritmo.social_publicadores FOR SELECT TO ritmo_api USING(ritmo.es_admin(negocio_id));
CREATE POLICY trabajos_negocio ON ritmo.social_trabajos FOR SELECT TO ritmo_api USING((ritmo.miembro_actual(negocio_id)).usuario_id IS NOT NULL);
CREATE POLICY visitas_admin ON ritmo.publico_visitas FOR SELECT TO ritmo_api USING(ritmo.es_admin(negocio_id));
CREATE POLICY resenas_negocio ON ritmo.social_resenas FOR SELECT TO ritmo_api USING((ritmo.miembro_actual(negocio_id)).usuario_id IS NOT NULL);
-- El resto se opera por funciones acotadas: no existe acceso directo pÃºblico ni permisos generales de escritura.

CREATE FUNCTION ritmo.nuevo_perfil_publico() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN INSERT INTO ritmo.publico_perfiles(negocio_id) VALUES(NEW.id);RETURN NEW;END $$;
CREATE TRIGGER nuevo_perfil_publico AFTER INSERT ON ritmo.negocios FOR EACH ROW EXECUTE FUNCTION ritmo.nuevo_perfil_publico();

CREATE FUNCTION ritmo.nombre_social(u uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT nombre FROM ritmo.social_clientes WHERE usuario_id=u),'Cliente') $$;
CREATE FUNCTION ritmo.negocio_publico(n uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT EXISTS(SELECT 1 FROM ritmo.publico_perfiles p JOIN ritmo.negocios_enlaces e ON e.negocio_id=p.negocio_id WHERE p.negocio_id=n AND p.visible)$$;
CREATE FUNCTION ritmo.servicios_publicos(n uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nombre',o.data->>'nombre','categoria',o.data->>'categoria','precio',(o.data->>'precio')::numeric,'duracion',(o.data->>'duracion')::integer,'descripcion',coalesce(o.data->>'descripcion',''),'foto',o.data->>'foto') ORDER BY o.data->>'categoria',o.data->>'nombre'),'[]'::jsonb)
 FROM ritmo.belleza_objetos o WHERE o.negocio_id=n AND o.tipo='servicio' AND o.data IS NOT NULL AND coalesce((o.data->>'activo')::boolean,true)
$$;
CREATE FUNCTION ritmo.perfil_publico(s text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',n.id,'slug',e.slug,'nombre',coalesce(nullif(a.data->>'negocio','Mi salÃ³n'),n.nombre),'descripcion',p.descripcion,'ciudad',p.ciudad,'colonia',p.colonia,'direccion',p.direccion,'whatsapp',p.whatsapp,'trabajos',(SELECT count(*) FROM ritmo.social_trabajos t WHERE t.negocio_id=n.id AND t.estado='visible'),'lat',p.lat,'lon',p.lon,'logo',p.logo,'portada',p.portada,'verificado',p.verificado,'abre',coalesce(a.data->>'abre','10:00'),'cierra',coalesce(a.data->>'cierra','20:00'),'servicios',ritmo.servicios_publicos(n.id),'resenas',coalesce(r.cantidad,0),'promedio',r.promedio,'seguidores',(SELECT count(*) FROM ritmo.social_seguidores f WHERE f.negocio_id=n.id),'puedeAgendar',ritmo.plan_permite_escritura(n.id))
 FROM ritmo.negocios_enlaces e JOIN ritmo.negocios n ON n.id=e.negocio_id JOIN ritmo.publico_perfiles p ON p.negocio_id=n.id AND p.visible
 LEFT JOIN ritmo.belleza_objetos a ON a.negocio_id=n.id AND a.id='__settings'
 LEFT JOIN LATERAL(SELECT count(*) cantidad,round(avg(estrellas)::numeric,2) promedio FROM ritmo.social_resenas WHERE negocio_id=n.id AND estado='visible') r ON true WHERE e.slug=s
$$;
CREATE FUNCTION ritmo.explorar_publico() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(ritmo.perfil_publico(e.slug) ORDER BY e.slug),'[]'::jsonb) FROM ritmo.negocios_enlaces e JOIN ritmo.publico_perfiles p ON p.negocio_id=e.negocio_id AND p.visible
$$;
CREATE FUNCTION ritmo.trabajos_publicos(n_busqueda uuid DEFAULT NULL,seleccion uuid[] DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(t.obj ORDER BY t.fecha DESC),'[]'::jsonb) FROM (
 SELECT t.creado_en fecha,jsonb_build_object('id',t.id,'negocioId',t.negocio_id,'slug',e.slug,'negocio',coalesce(nullif(aj.data->>'negocio','Mi salón'),n.nombre),'foto',t.foto,'texto',t.texto,'servicioId',s.id,'servicio',s.data->>'nombre','categoria',s.data->>'categoria','precio',(s.data->>'precio')::numeric,'duracion',(s.data->>'duracion')::integer,'fecha',t.creado_en,'meGusta',(SELECT count(*) FROM ritmo.social_me_gusta l WHERE l.trabajo_id=t.id),'comentarios',(SELECT count(*) FROM ritmo.social_comentarios c WHERE c.trabajo_id=t.id AND c.estado='visible')) obj
 FROM ritmo.social_trabajos t JOIN ritmo.negocios n ON n.id=t.negocio_id JOIN ritmo.negocios_enlaces e ON e.negocio_id=n.id JOIN ritmo.publico_perfiles p ON p.negocio_id=n.id AND p.visible LEFT JOIN ritmo.belleza_objetos aj ON aj.negocio_id=n.id AND aj.id='__settings' JOIN ritmo.belleza_objetos s ON s.negocio_id=n.id AND s.id=t.servicio_id AND s.data IS NOT NULL
 WHERE t.estado='visible' AND coalesce((s.data->>'activo')::boolean,true) AND (n_busqueda IS NULL OR t.negocio_id=n_busqueda) AND (seleccion IS NULL OR t.id=ANY(seleccion)) ORDER BY t.creado_en DESC LIMIT 200) t
$$;
CREATE FUNCTION ritmo.detalle_social(t uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('comentarios',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'nombre',ritmo.nombre_social(c.usuario_id),'texto',c.texto,'fecha',c.creado_en) ORDER BY c.creado_en) FROM ritmo.social_comentarios c WHERE c.trabajo_id=t AND c.estado='visible'),'[]'::jsonb)) WHERE EXISTS(SELECT 1 FROM ritmo.social_trabajos WHERE id=t AND estado='visible' AND ritmo.negocio_publico(negocio_id))
$$;
CREATE FUNCTION ritmo.resenas_publicas(n uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',ritmo.nombre_social(usuario_id),'estrellas',estrellas,'texto',texto,'respuesta',respuesta,'fecha',creado_en) ORDER BY creado_en DESC),'[]'::jsonb) FROM ritmo.social_resenas WHERE negocio_id=n AND estado='visible' AND ritmo.negocio_publico(n)
$$;
CREATE FUNCTION ritmo.editar_perfil_publico(n uuid,d jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) THEN RAISE EXCEPTION 'Solo Admin' USING ERRCODE='42501'; END IF;
 IF d->>'slug' !~ '^[a-z0-9][a-z0-9-]{2,59}$' OR d->>'slug' IN('api','comunidad','planes','calendario','salud','webhooks','unirse','index','assets') THEN RAISE EXCEPTION 'Enlace invÃ¡lido' USING ERRCODE='22023'; END IF;
 INSERT INTO ritmo.negocios_enlaces(negocio_id,slug) VALUES(n,d->>'slug') ON CONFLICT(negocio_id) DO UPDATE SET slug=excluded.slug;
 UPDATE ritmo.publico_perfiles SET visible=(d->>'visible')::boolean,descripcion=d->>'descripcion',ciudad=d->>'ciudad',colonia=d->>'colonia',direccion=d->>'direccion',whatsapp=coalesce(d->>'whatsapp',''),lat=(d->>'lat')::float8,lon=(d->>'lon')::float8,logo=d->>'logo',portada=d->>'portada',actualizado_en=now() WHERE negocio_id=n;
END $$;
CREATE FUNCTION ritmo.visita_publica(n uuid,h text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF ritmo.negocio_publico(n) THEN INSERT INTO ritmo.publico_visitas VALUES(n,(now() AT TIME ZONE 'America/Mexico_City')::date,h) ON CONFLICT DO NOTHING; END IF; END $$;
CREATE FUNCTION ritmo.publicar_trabajo(n uuid,s text,f text,t text,permiso boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE x uuid; BEGIN
 IF NOT ritmo.sesion_vigente() OR NOT ritmo.puede_publicar_social(n) THEN RAISE EXCEPTION 'Sin permiso de publicaciÃ³n' USING ERRCODE='42501'; END IF;
 IF NOT ritmo.plan_permite_escritura(n) THEN RAISE EXCEPTION 'agendappx_prueba_finalizada'; END IF;
 PERFORM 1 FROM ritmo.negocios WHERE id=n FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM ritmo.belleza_objetos WHERE negocio_id=n AND id=s AND tipo='servicio' AND data IS NOT NULL) OR permiso IS DISTINCT FROM true OR f IS NULL THEN RAISE EXCEPTION 'Revisa servicio, foto y consentimiento' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM ritmo.social_trabajos WHERE negocio_id=n AND creado_en>=date_trunc('day',now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City')>=10 OR (SELECT count(*) FROM ritmo.social_trabajos WHERE negocio_id=n AND foto IS NOT NULL AND estado<>'retirado')>=30 THEN RAISE EXCEPTION 'LÃ­mite de publicaciones o fotos' USING ERRCODE='22023'; END IF;
 INSERT INTO ritmo.social_trabajos(negocio_id,servicio_id,autor,foto,texto,permiso_foto) VALUES(n,s,auth.uid(),f,t,true) RETURNING id INTO x;RETURN x;
END $$;
CREATE FUNCTION ritmo.autorizar_publicador(n uuid,u uuid,permitir boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) OR NOT EXISTS(SELECT 1 FROM ritmo.miembros WHERE negocio_id=n AND usuario_id=u AND activo) THEN RAISE EXCEPTION 'Solo Admin del equipo' USING ERRCODE='42501'; END IF;
 IF permitir THEN INSERT INTO ritmo.social_publicadores VALUES(n,u) ON CONFLICT DO NOTHING;ELSE DELETE FROM ritmo.social_publicadores WHERE negocio_id=n AND usuario_id=u;END IF;
END $$;
CREATE FUNCTION ritmo.estado_cliente() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; BEGIN u:=ritmo.usuario_cliente();RETURN jsonb_build_object('nombre',ritmo.nombre_social(u),'siguiendo',coalesce((SELECT jsonb_agg(negocio_id) FROM ritmo.social_seguidores WHERE usuario_id=u),'[]'::jsonb),'meGusta',coalesce((SELECT jsonb_agg(trabajo_id) FROM ritmo.social_me_gusta WHERE usuario_id=u),'[]'::jsonb),'guardados',coalesce((SELECT jsonb_agg(jsonb_build_object('tipo',tipo,'destino',destino)) FROM ritmo.social_guardados WHERE usuario_id=u),'[]'::jsonb),'moderador',ritmo.es_moderador_social());END $$;
CREATE FUNCTION ritmo.accion_social(tipo_accion text,d jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; n uuid; t uuid; x uuid; telefono text; BEGIN
 u:=ritmo.usuario_cliente();n:=nullif(d->>'negocioId','')::uuid;t:=nullif(d->>'trabajoId','')::uuid;
 IF tipo_accion='perfil' THEN
  INSERT INTO ritmo.social_clientes(usuario_id,nombre) VALUES(u,trim(d->>'nombre')) ON CONFLICT(usuario_id) DO UPDATE SET nombre=excluded.nombre;
 ELSIF tipo_accion='seguir' THEN
  IF NOT ritmo.negocio_publico(n) THEN RAISE EXCEPTION 'Negocio no disponible' USING ERRCODE='22023';END IF;
  IF (d->>'activo')::boolean THEN INSERT INTO ritmo.social_seguidores VALUES(n,u,now()) ON CONFLICT DO NOTHING;ELSE DELETE FROM ritmo.social_seguidores WHERE negocio_id=n AND usuario_id=u;END IF;
 ELSIF tipo_accion IN('me-gusta','comentar') THEN
  IF NOT EXISTS(SELECT 1 FROM ritmo.social_trabajos WHERE id=t AND estado='visible' AND ritmo.negocio_publico(negocio_id)) THEN RAISE EXCEPTION 'Trabajo no disponible' USING ERRCODE='22023'; END IF;
  IF tipo_accion='me-gusta' THEN
   IF (d->>'activo')::boolean THEN INSERT INTO ritmo.social_me_gusta VALUES(t,u,now()) ON CONFLICT DO NOTHING;ELSE DELETE FROM ritmo.social_me_gusta WHERE trabajo_id=t AND usuario_id=u;END IF;
  ELSE
   IF (SELECT count(*) FROM ritmo.social_comentarios WHERE usuario_id=u AND creado_en>now()-interval '1 hour')>=30 THEN RAISE EXCEPTION 'Espera antes de comentar' USING ERRCODE='22023';END IF;
   INSERT INTO ritmo.social_comentarios(trabajo_id,usuario_id,texto) VALUES(t,u,trim(d->>'texto')) RETURNING id INTO x;
  END IF;
 ELSIF tipo_accion='guardar' THEN
  IF d->>'tipo'='negocio' AND NOT ritmo.negocio_publico((d->>'destino')::uuid) OR d->>'tipo'='trabajo' AND NOT EXISTS(SELECT 1 FROM ritmo.social_trabajos WHERE id=(d->>'destino')::uuid AND estado='visible' AND ritmo.negocio_publico(negocio_id)) THEN RAISE EXCEPTION 'No disponible' USING ERRCODE='22023';END IF;
  IF (d->>'activo')::boolean THEN INSERT INTO ritmo.social_guardados VALUES(u,d->>'tipo',d->>'destino',now()) ON CONFLICT DO NOTHING;ELSE DELETE FROM ritmo.social_guardados WHERE usuario_id=u AND tipo=d->>'tipo' AND destino=d->>'destino';END IF;
 ELSIF tipo_accion='resena' THEN
  SELECT ritmo.telefono_publico_normalizado(phone) INTO telefono FROM auth.users WHERE id=u;
  IF NOT EXISTS(SELECT 1 FROM ritmo.belleza_objetos c JOIN ritmo.belleza_objetos cl ON cl.negocio_id=c.negocio_id AND cl.id=c.data->>'clienta' WHERE c.negocio_id=n AND c.id=d->>'citaId' AND c.tipo='cita' AND c.data->>'estado'='completada' AND cl.tipo='clienta' AND ritmo.telefono_publico_normalizado(cl.data->>'telefono')=telefono) THEN RAISE EXCEPTION 'Solo despuÃ©s de tu cita completada' USING ERRCODE='42501';END IF;
  INSERT INTO ritmo.social_resenas(negocio_id,cita_id,usuario_id,estrellas,texto) VALUES(n,d->>'citaId',u,(d->>'estrellas')::integer,d->>'texto') RETURNING id INTO x;
 ELSIF tipo_accion='eliminar-comentario' THEN
  UPDATE ritmo.social_comentarios SET estado='retirado' WHERE id=(d->>'id')::uuid AND usuario_id=u;
 ELSE RAISE EXCEPTION 'AcciÃ³n invÃ¡lida' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('guardado',true,'id',x);
END $$;
CREATE FUNCTION ritmo.mis_citas_cliente() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; tel text; BEGIN u:=ritmo.usuario_cliente(); SELECT ritmo.telefono_publico_normalizado(phone) INTO tel FROM auth.users WHERE id=u;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'negocioId',c.negocio_id,'negocio',n.nombre,'slug',e.slug,'fecha',c.data->>'date','hora',c.data->>'start','estado',c.data->>'estado','servicio',s.data->>'nombre','precio',(s.data->>'precio')::numeric,'duracion',(s.data->>'duracion')::integer,'puedeResenar',c.data->>'estado'='completada' AND NOT EXISTS(SELECT 1 FROM ritmo.social_resenas r WHERE r.negocio_id=c.negocio_id AND r.cita_id=c.id)) ORDER BY c.data->>'date' DESC,c.data->>'start') FROM ritmo.belleza_objetos c JOIN ritmo.belleza_objetos cl ON cl.negocio_id=c.negocio_id AND cl.id=c.data->>'clienta' AND cl.tipo='clienta' JOIN ritmo.belleza_objetos s ON s.negocio_id=c.negocio_id AND s.id=c.data->>'servicio' JOIN ritmo.negocios n ON n.id=c.negocio_id LEFT JOIN ritmo.negocios_enlaces e ON e.negocio_id=c.negocio_id WHERE c.tipo='cita' AND c.data IS NOT NULL AND ritmo.telefono_publico_normalizado(cl.data->>'telefono')=tel),'[]'::jsonb);
END $$;
CREATE FUNCTION ritmo.reportar_social(t text,x uuid,h text,m text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cantidad integer; existe boolean; BEGIN
 IF t='trabajo' THEN SELECT EXISTS(SELECT 1 FROM ritmo.social_trabajos WHERE id=x AND estado='visible' AND ritmo.negocio_publico(negocio_id)) INTO existe;
 ELSIF t='comentario' THEN SELECT EXISTS(SELECT 1 FROM ritmo.social_comentarios c JOIN ritmo.social_trabajos p ON p.id=c.trabajo_id WHERE c.id=x AND c.estado IN('visible','revision') AND ritmo.negocio_publico(p.negocio_id)) INTO existe;
 ELSIF t='resena' THEN SELECT EXISTS(SELECT 1 FROM ritmo.social_resenas WHERE id=x AND estado='visible' AND ritmo.negocio_publico(negocio_id)) INTO existe;END IF;
 IF existe IS DISTINCT FROM true THEN RAISE EXCEPTION 'Contenido no disponible' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('reporte-'||x::text,0));
 IF (SELECT count(*) FROM ritmo.social_reportes WHERE reportante_hash=h AND creado_en>now()-interval '1 day')>=20 THEN RAISE EXCEPTION 'LÃ­mite de reportes' USING ERRCODE='22023';END IF;
 INSERT INTO ritmo.social_reportes(tipo,destino,reportante_hash,motivo) VALUES(t,x,h,m) ON CONFLICT DO NOTHING;
 SELECT count(*) INTO cantidad FROM ritmo.social_reportes WHERE tipo=t AND destino=x AND estado='pendiente';
 IF t='comentario' AND cantidad>=3 THEN UPDATE ritmo.social_comentarios SET estado='revision' WHERE id=x AND estado='visible';END IF;
END $$;
CREATE FUNCTION ritmo.moderar_negocio(n uuid,t text,x uuid,texto_respuesta text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) THEN RAISE EXCEPTION 'Solo Admin' USING ERRCODE='42501';END IF;
 IF t='comentario' THEN UPDATE ritmo.social_comentarios SET estado='oculto' WHERE id=x AND trabajo_id IN(SELECT id FROM ritmo.social_trabajos WHERE negocio_id=n) AND estado='visible';
 ELSIF t='trabajo' THEN UPDATE ritmo.social_trabajos SET estado='retirado',foto=NULL WHERE id=x AND negocio_id=n;
 ELSIF t='resena' THEN UPDATE ritmo.social_resenas SET respuesta=trim(texto_respuesta) WHERE id=x AND negocio_id=n;
 ELSE RAISE EXCEPTION 'AcciÃ³n invÃ¡lida' USING ERRCODE='22023';END IF;
END $$;
CREATE FUNCTION ritmo.reportes_moderador() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT ritmo.es_moderador_social() THEN RAISE EXCEPTION 'Solo moderador' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'tipo',r.tipo,'destino',r.destino,'motivo',r.motivo,'fecha',r.creado_en,'texto',CASE r.tipo WHEN 'trabajo' THEN (SELECT texto FROM ritmo.social_trabajos WHERE id=r.destino) WHEN 'comentario' THEN (SELECT texto FROM ritmo.social_comentarios WHERE id=r.destino) ELSE (SELECT texto FROM ritmo.social_resenas WHERE id=r.destino) END)) FROM ritmo.social_reportes r WHERE r.estado='pendiente'),'[]'::jsonb);END $$;
CREATE FUNCTION ritmo.resolver_reporte(x uuid,retirar boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r ritmo.social_reportes; BEGIN
 IF NOT ritmo.es_moderador_social() THEN RAISE EXCEPTION 'Solo moderador' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM ritmo.social_reportes WHERE id=x FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no disponible' USING ERRCODE='22023';END IF;
 IF r.tipo='trabajo' THEN UPDATE ritmo.social_trabajos SET estado=CASE WHEN retirar THEN 'retirado' ELSE 'visible' END,foto=CASE WHEN retirar THEN NULL ELSE foto END WHERE id=r.destino;
 ELSIF r.tipo='comentario' THEN UPDATE ritmo.social_comentarios SET estado=CASE WHEN retirar THEN 'retirado' ELSE 'visible' END WHERE id=r.destino AND estado<>'retirado';
 ELSE UPDATE ritmo.social_resenas SET estado=CASE WHEN retirar THEN 'retirada' ELSE 'visible' END WHERE id=r.destino;END IF;
 UPDATE ritmo.social_reportes SET estado='resuelto' WHERE tipo=r.tipo AND destino=r.destino;END $$;
CREATE FUNCTION ritmo.minutos_publicos(h text) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT split_part(h,':',1)::integer*60+split_part(h,':',2)::integer $$;
CREATE FUNCTION ritmo.horarios_publicos(n uuid,s text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE servicio jsonb; ajustes jsonb; persona record; especial record; dia date; turno jsonb; comida jsonb; inicio integer; fin integer; a integer; h text; resultado jsonb:='[]'; dur integer; ahora timestamp; BEGIN
 IF NOT ritmo.negocio_publico(n) OR NOT ritmo.plan_permite_escritura(n) THEN RETURN resultado;END IF;
 SELECT data INTO servicio FROM ritmo.belleza_objetos WHERE negocio_id=n AND id=s AND tipo='servicio' AND data IS NOT NULL AND coalesce((data->>'activo')::boolean,true);IF NOT FOUND THEN RETURN resultado;END IF;
 SELECT data INTO ajustes FROM ritmo.belleza_objetos WHERE negocio_id=n AND id='__settings';ajustes:=coalesce(ajustes,'{}'::jsonb);dur:=(servicio->>'duracion')::integer;ahora:=now() AT TIME ZONE 'America/Mexico_City';
 FOR persona IN SELECT usuario_id,nombre,horario FROM ritmo.miembros WHERE negocio_id=n AND activo AND s=ANY(servicios) ORDER BY nombre,usuario_id LOOP
  FOR dia IN SELECT ahora::date+i FROM generate_series(0,6) i LOOP
   turno:=CASE WHEN persona.horario ? (ARRAY['dom','lun','mar','mie','jue','vie','sab'])[extract(dow FROM dia)::integer+1] THEN persona.horario->(ARRAY['dom','lun','mar','mie','jue','vie','sab'])[extract(dow FROM dia)::integer+1] ELSE jsonb_build_array(coalesce(ajustes->>'abre','10:00'),coalesce(ajustes->>'cierra','20:00')) END;
   SELECT tipo,desde,hasta INTO especial FROM ritmo.horario_especial WHERE negocio_id=n AND usuario_id=persona.usuario_id AND fecha=dia;
   IF especial.tipo='libre' THEN CONTINUE;END IF;
   IF especial.tipo='horario' THEN turno:=jsonb_build_array(especial.desde,especial.hasta);END IF;
   IF turno='null'::jsonb THEN CONTINUE;END IF;
   inicio:=greatest(ritmo.minutos_publicos(turno->>0),ritmo.minutos_publicos(coalesce(ajustes->>'abre','10:00')));fin:=least(ritmo.minutos_publicos(turno->>1),ritmo.minutos_publicos(coalesce(ajustes->>'cierra','20:00')));comida:=persona.horario->'comida';
   FOR a IN SELECT generate_series(inicio,fin-dur,15) LOOP
    h:=lpad((a/60)::text,2,'0')||':'||lpad((a%60)::text,2,'0');
    IF dia+h::time<=ahora OR comida IS NOT NULL AND comida<>'null'::jsonb AND a<ritmo.minutos_publicos(comida->>1) AND a+dur>ritmo.minutos_publicos(comida->>0) THEN CONTINUE;END IF;
    IF EXISTS(SELECT 1 FROM ritmo.belleza_objetos c LEFT JOIN ritmo.belleza_objetos cs ON cs.negocio_id=n AND cs.id=c.data->>'servicio' WHERE c.negocio_id=n AND c.tipo='cita' AND c.data IS NOT NULL AND c.data->>'date'=dia::text AND c.data->>'estado'<>'cancelada' AND (c.especialista_id=persona.usuario_id::text OR c.especialista_id IS NULL) AND a<ritmo.minutos_publicos(c.data->>'start')+coalesce((cs.data->>'duracion')::integer,(c.data->>'duracion')::integer,60) AND a+dur>ritmo.minutos_publicos(c.data->>'start')) THEN CONTINUE;END IF;
    resultado:=resultado||jsonb_build_array(jsonb_build_object('fecha',dia,'hora',h,'personaId',persona.usuario_id,'persona',persona.nombre));
   END LOOP;
  END LOOP;
 END LOOP;RETURN coalesce((SELECT jsonb_agg(elemento.valor ORDER BY elemento.valor->>'fecha',elemento.valor->>'hora',elemento.valor->>'persona') FROM jsonb_array_elements(resultado) AS elemento(valor)),'[]'::jsonb);
END $$;
CREATE FUNCTION ritmo.reservar_publica(n uuid,d jsonb,sol text,datos text,ip text,tel text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE anterior ritmo.publico_reservas; rid uuid; cid text; cliente text; revision_n integer; servicio jsonb; BEGIN
 IF NOT ritmo.negocio_publico(n) OR NOT ritmo.plan_permite_escritura(n) THEN RAISE EXCEPTION 'Negocio no disponible' USING ERRCODE='22023';END IF;
 -- Orden global para lÃ­mites por IP, y bloqueo de agenda antes de volver a comprobar el horario.
 PERFORM pg_advisory_xact_lock(hashtextextended('reservas-publicas',0));
 SELECT * INTO anterior FROM ritmo.publico_reservas WHERE solicitud_hash=sol;
 IF FOUND THEN IF anterior.datos_hash<>datos OR anterior.negocio_id<>n THEN RAISE EXCEPTION 'Solicitud distinta' USING ERRCODE='22023';END IF;RETURN jsonb_build_object('id',anterior.cita_id,'estado','solicitada');END IF;
 PERFORM 1 FROM ritmo.belleza_estado WHERE negocio_id=n FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Agenda no disponible' USING ERRCODE='22023';END IF;
 IF (SELECT count(*) FROM ritmo.publico_reservas WHERE ip_hash=ip AND creado_en>now()-interval '1 day')>=10 OR (SELECT count(*) FROM ritmo.publico_reservas WHERE negocio_id=n AND telefono_hash=tel AND creado_en>now()-interval '1 day')>=3 THEN RAISE EXCEPTION 'Espera antes de solicitar mÃ¡s citas' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ritmo.horarios_publicos(n,d->>'servicio')) h WHERE h->>'fecha'=d->>'fecha' AND h->>'hora'=d->>'hora' AND h->>'personaId'=d->>'personaId') THEN RAISE EXCEPTION 'agendappx_horario_ocupado' USING ERRCODE='P0001';END IF;
 SELECT data INTO servicio FROM ritmo.belleza_objetos WHERE negocio_id=n AND id=d->>'servicio' AND tipo='servicio';
 rid:=gen_random_uuid();cid:='pub_'||replace(gen_random_uuid()::text,'-','');cliente:='pub_'||replace(gen_random_uuid()::text,'-','');
 INSERT INTO ritmo.publico_reservas(id,negocio_id,cita_id,clienta_id,solicitud_hash,datos_hash,ip_hash,telefono_hash,origen) VALUES(rid,n,cid,cliente,sol,datos,ip,tel,d->>'origen');
 PERFORM set_config('ritmo.reserva_publica',rid::text,true);
 UPDATE ritmo.belleza_estado SET revision=revision+2 WHERE negocio_id=n RETURNING revision INTO revision_n;
 INSERT INTO ritmo.belleza_objetos(negocio_id,id,version,revision,data) VALUES(n,cliente,1,revision_n-1,jsonb_build_object('id',cliente,'kind','clienta','nombre',trim(d->>'nombre'),'telefono',d->>'telefono','whatsappOptIn',(d->>'consentimiento')::boolean));
 INSERT INTO ritmo.belleza_objetos(negocio_id,id,version,revision,data) VALUES(n,cid,1,revision_n,jsonb_build_object('id',cid,'kind','cita','clienta',cliente,'servicio',d->>'servicio','especialista',d->>'personaId','date',d->>'fecha','start',d->>'hora','estado','solicitada','duracion',(servicio->>'duracion')::integer,'precio',(servicio->>'precio')::numeric,'origen',d->>'origen'));
 PERFORM set_config('ritmo.reserva_publica','',true);RETURN jsonb_build_object('id',cid,'estado','solicitada');
END $$;
-- La excepciÃ³n de auditorÃ­a solo acepta las dos inserciones exactas de una reserva interna existente.
CREATE OR REPLACE FUNCTION ritmo.registrar_cambio() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE reserva uuid; BEGIN
 reserva:=nullif(current_setting('ritmo.reserva_publica',true),'')::uuid;
 IF reserva IS NOT NULL AND TG_OP='INSERT' AND NEW.version=1 AND EXISTS(SELECT 1 FROM ritmo.publico_reservas r WHERE r.id=reserva AND r.negocio_id=NEW.negocio_id AND ((r.cita_id=NEW.id AND NEW.tipo='cita' AND NEW.data->>'estado'='solicitada') OR (r.clienta_id=NEW.id AND NEW.tipo='clienta'))) THEN
  INSERT INTO ritmo.bitacora(negocio_id,usuario_id,accion,objeto_id,especialista_id,antes,despues) VALUES(NEW.negocio_id,NULL,'solicitud_publica',NEW.id,NEW.especialista_id,NULL,NEW.data);RETURN NEW;
 END IF;
 IF ritmo.usuario_actual() IS NULL OR ritmo.usuario_actual() IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Falta el actor verificado del cambio';END IF;
 INSERT INTO ritmo.bitacora(negocio_id,usuario_id,accion,objeto_id,especialista_id,antes,despues) VALUES(NEW.negocio_id,ritmo.usuario_actual(),CASE WHEN TG_OP='INSERT' THEN 'crear' WHEN NEW.data IS NULL THEN 'eliminar' WHEN NEW.data->>'estado'='cancelada' AND OLD.data->>'estado' IS DISTINCT FROM 'cancelada' THEN 'cancelar' WHEN NEW.tipo='cita' AND (NEW.data->>'date',NEW.data->>'start') IS DISTINCT FROM (OLD.data->>'date',OLD.data->>'start') THEN 'mover' ELSE 'editar' END,NEW.id,NEW.especialista_id,CASE WHEN TG_OP='UPDATE' THEN OLD.data ELSE NULL END,NEW.data);RETURN NEW;
END $$;

ALTER TABLE ritmo.registro_solicitudes DROP CONSTRAINT registro_solicitudes_tipo_check;
ALTER TABLE ritmo.registro_solicitudes ADD CONSTRAINT registro_solicitudes_tipo_check CHECK(tipo IN('salon','invitacion','cliente'));
CREATE OR REPLACE FUNCTION ritmo.finalizar_registro(ticket uuid, prueba text) RETURNS uuid
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
 IF r.tipo='cliente' THEN
  PERFORM ritmo.usuario_cliente();
  INSERT INTO ritmo.social_clientes(usuario_id,nombre) VALUES(u,left(r.perfil->>'nombre',100)) ON CONFLICT(usuario_id) DO NOTHING;
 ELSIF r.tipo='invitacion' THEN
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

DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS firma,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ritmo' AND p.proname=ANY(ARRAY['telefono_publico_normalizado','usuario_cliente','es_moderador_social','puede_publicar_social','nuevo_perfil_publico','nombre_social','negocio_publico','servicios_publicos','perfil_publico','explorar_publico','trabajos_publicos','detalle_social','resenas_publicas','editar_perfil_publico','visita_publica','publicar_trabajo','autorizar_publicador','estado_cliente','accion_social','mis_citas_cliente','reportar_social','moderar_negocio','reportes_moderador','resolver_reporte','minutos_publicos','horarios_publicos','reservar_publica','registrar_cambio','finalizar_registro']) LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,agendappx_whatsapp,ritmo_api',f.firma); IF f.proname=ANY(ARRAY['explorar_publico','perfil_publico','trabajos_publicos','detalle_social','resenas_publicas','editar_perfil_publico','visita_publica','publicar_trabajo','autorizar_publicador','estado_cliente','accion_social','mis_citas_cliente','reportar_social','moderar_negocio','reportes_moderador','resolver_reporte','horarios_publicos','reservar_publica','puede_publicar_social','finalizar_registro']) THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO ritmo_api',f.firma);END IF;END LOOP;END $$;
CREATE FUNCTION ritmo.comentarios_negocio(n uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) THEN RAISE EXCEPTION 'Solo Admin' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'trabajoId',c.trabajo_id,'nombre',ritmo.nombre_social(c.usuario_id),'texto',c.texto,'estado',c.estado)) FROM ritmo.social_comentarios c JOIN ritmo.social_trabajos t ON t.id=c.trabajo_id WHERE t.negocio_id=n AND c.estado IN('visible','revision')),'[]'::jsonb);END $$;
CREATE FUNCTION ritmo.metricas_social(n uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) THEN RAISE EXCEPTION 'Solo Admin' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('visitas',(SELECT count(*) FROM ritmo.publico_visitas WHERE negocio_id=n),'meGusta',(SELECT count(*) FROM ritmo.social_me_gusta l JOIN ritmo.social_trabajos t ON t.id=l.trabajo_id WHERE t.negocio_id=n));END $$;
CREATE FUNCTION ritmo.verificar_negocio_social(n uuid,v boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT ritmo.es_moderador_social() THEN RAISE EXCEPTION 'Solo moderador' USING ERRCODE='42501';END IF;UPDATE ritmo.publico_perfiles SET verificado=v WHERE negocio_id=n;END $$;
REVOKE ALL ON FUNCTION ritmo.comentarios_negocio(uuid),ritmo.metricas_social(uuid),ritmo.verificar_negocio_social(uuid,boolean) FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.comentarios_negocio(uuid),ritmo.metricas_social(uuid),ritmo.verificar_negocio_social(uuid,boolean) TO ritmo_api;
-- Avisos PWA voluntarios. Nunca contienen nombres, teléfonos ni detalles de una cita en la pantalla bloqueada.
CREATE TABLE ritmo.push_suscripciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario_id uuid NOT NULL REFERENCES auth.users(id),sesion_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,ambito text NOT NULL CHECK(ambito IN('cliente','negocio')),negocio_id uuid REFERENCES ritmo.negocios(id),endpoint text UNIQUE NOT NULL CHECK(length(endpoint)<=2048),suscripcion jsonb NOT NULL,activo boolean NOT NULL DEFAULT true,creado_en timestamptz NOT NULL DEFAULT now(),CHECK((ambito='negocio')=(negocio_id IS NOT NULL)));
CREATE INDEX push_sesion ON ritmo.push_suscripciones(sesion_id);
CREATE INDEX push_usuario ON ritmo.push_suscripciones(usuario_id) WHERE activo;
CREATE TABLE ritmo.push_cola(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),suscripcion_id uuid NOT NULL REFERENCES ritmo.push_suscripciones(id) ON DELETE CASCADE,negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),cita_id text NOT NULL,version integer NOT NULL,estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN('pendiente','intentado','enviado','fallido','vencido')),creado_en timestamptz NOT NULL DEFAULT now(),intento_en timestamptz,UNIQUE(suscripcion_id,negocio_id,cita_id,version));
CREATE INDEX push_pendientes ON ritmo.push_cola(creado_en) WHERE estado='pendiente';
CREATE INDEX push_intentos_dia ON ritmo.push_cola(intento_en) WHERE intento_en IS NOT NULL;
ALTER TABLE ritmo.push_suscripciones ENABLE ROW LEVEL SECURITY;ALTER TABLE ritmo.push_suscripciones FORCE ROW LEVEL SECURITY;ALTER TABLE ritmo.push_cola ENABLE ROW LEVEL SECURITY;ALTER TABLE ritmo.push_cola FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.push_suscripciones,ritmo.push_cola FROM PUBLIC,anon,authenticated,agendappx_whatsapp,ritmo_api;
CREATE FUNCTION ritmo.guardar_push(a text,n uuid,s jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; sid uuid; BEGIN
 u:=ritmo.usuario_cliente();sid:=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
 IF a NOT IN('cliente','negocio') OR a='cliente' AND n IS NOT NULL OR a='negocio' AND ((ritmo.miembro_actual(n)).usuario_id IS NULL OR NOT ritmo.plan_permite_escritura(n)) THEN RAISE EXCEPTION 'Sin acceso al salón' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM ritmo.push_suscripciones WHERE endpoint=s->>'endpoint' AND usuario_id<>u) THEN RAISE EXCEPTION 'Desactiva los avisos anteriores de este dispositivo' USING ERRCODE='42501';END IF;
 IF (SELECT count(*) FROM ritmo.push_suscripciones WHERE usuario_id=u AND activo)>=5 AND NOT EXISTS(SELECT 1 FROM ritmo.push_suscripciones WHERE endpoint=s->>'endpoint' AND usuario_id=u) THEN RAISE EXCEPTION 'Máximo cinco dispositivos' USING ERRCODE='22023';END IF;
 INSERT INTO ritmo.push_suscripciones(usuario_id,sesion_id,ambito,negocio_id,endpoint,suscripcion) VALUES(u,sid,a,n,s->>'endpoint',s) ON CONFLICT(endpoint) DO UPDATE SET sesion_id=sid,ambito=a,negocio_id=n,suscripcion=s,activo=true;
END $$;
CREATE FUNCTION ritmo.quitar_push(e text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM ritmo.usuario_cliente();UPDATE ritmo.push_suscripciones SET activo=false WHERE endpoint=e AND usuario_id=auth.uid();END $$;
CREATE FUNCTION ritmo.encolar_push_cita() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tel text; BEGIN
 IF NEW.tipo<>'cita' OR NEW.data IS NULL OR TG_OP='UPDATE' AND (NEW.data->>'estado',NEW.data->>'date',NEW.data->>'start') IS NOT DISTINCT FROM (OLD.data->>'estado',OLD.data->>'date',OLD.data->>'start') THEN RETURN NEW;END IF;
 SELECT ritmo.telefono_publico_normalizado(data->>'telefono') INTO tel FROM ritmo.belleza_objetos WHERE negocio_id=NEW.negocio_id AND id=NEW.data->>'clienta' AND tipo='clienta';
 INSERT INTO ritmo.push_cola(suscripcion_id,negocio_id,cita_id,version)
 SELECT s.id,NEW.negocio_id,NEW.id,NEW.version FROM ritmo.push_suscripciones s JOIN auth.sessions ses ON ses.id=s.sesion_id AND ses.user_id=s.usuario_id AND (ses.not_after IS NULL OR ses.not_after>now()) JOIN auth.users u ON u.id=s.usuario_id WHERE s.activo AND ((s.ambito='cliente' AND NEW.data->>'estado'<>'solicitada' AND u.phone_confirmed_at IS NOT NULL AND ritmo.telefono_publico_normalizado(u.phone)=tel) OR (s.ambito='negocio' AND s.negocio_id=NEW.negocio_id AND EXISTS(SELECT 1 FROM ritmo.miembros m WHERE m.negocio_id=NEW.negocio_id AND m.usuario_id=s.usuario_id AND m.activo AND (m.rol IN('admin','recepcion') OR m.usuario_id::text=NEW.especialista_id)))) ON CONFLICT DO NOTHING;
 RETURN NEW;END $$;
CREATE TRIGGER push_cita AFTER INSERT OR UPDATE ON ritmo.belleza_objetos FOR EACH ROW EXECUTE FUNCTION ritmo.encolar_push_cita();
CREATE FUNCTION ritmo.tomar_push() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cupo integer; resultado jsonb; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('agendappx-push-envios',0));
 UPDATE ritmo.push_cola SET estado='vencido' WHERE estado='pendiente' AND creado_en<now()-interval '1 day';
 SELECT greatest(0,least(2,300-count(*)))::integer INTO cupo FROM ritmo.push_cola WHERE intento_en>=date_trunc('day',now());
 WITH candidatas AS(SELECT q.id FROM ritmo.push_cola q JOIN ritmo.push_suscripciones s ON s.id=q.suscripcion_id AND s.activo JOIN auth.sessions ses ON ses.id=s.sesion_id AND ses.user_id=s.usuario_id AND (ses.not_after IS NULL OR ses.not_after>now()) JOIN auth.users u ON u.id=s.usuario_id JOIN ritmo.belleza_objetos c ON c.negocio_id=q.negocio_id AND c.id=q.cita_id AND c.data IS NOT NULL LEFT JOIN ritmo.belleza_objetos cl ON cl.negocio_id=c.negocio_id AND cl.id=c.data->>'clienta' WHERE q.estado='pendiente' AND ((s.ambito='cliente' AND u.phone_confirmed_at IS NOT NULL AND ritmo.telefono_publico_normalizado(u.phone)=ritmo.telefono_publico_normalizado(cl.data->>'telefono')) OR (s.ambito='negocio' AND s.negocio_id=q.negocio_id AND EXISTS(SELECT 1 FROM ritmo.miembros m WHERE m.negocio_id=q.negocio_id AND m.usuario_id=s.usuario_id AND m.activo AND (m.rol IN('admin','recepcion') OR m.usuario_id::text=c.especialista_id)))) ORDER BY q.creado_en LIMIT cupo FOR UPDATE OF q SKIP LOCKED),tomadas AS(UPDATE ritmo.push_cola q SET estado='intentado',intento_en=now() FROM candidatas x WHERE q.id=x.id RETURNING q.*) SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'suscripcion',s.suscripcion,'url',CASE WHEN s.ambito='cliente' THEN '/comunidad/#mis-citas' ELSE '/#hoy' END)),'[]'::jsonb) INTO resultado FROM tomadas t JOIN ritmo.push_suscripciones s ON s.id=t.suscripcion_id;RETURN resultado;END $$;
CREATE FUNCTION ritmo.terminar_push(x uuid,bien boolean,caducada boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid;BEGIN UPDATE ritmo.push_cola SET estado=CASE WHEN bien THEN 'enviado' ELSE 'fallido' END WHERE id=x AND estado='intentado' RETURNING suscripcion_id INTO sid;IF caducada AND sid IS NOT NULL THEN UPDATE ritmo.push_suscripciones SET activo=false WHERE id=sid;END IF;END $$;
REVOKE ALL ON FUNCTION ritmo.guardar_push(text,uuid,jsonb),ritmo.quitar_push(text),ritmo.encolar_push_cita(),ritmo.tomar_push(),ritmo.terminar_push(uuid,boolean,boolean) FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.guardar_push(text,uuid,jsonb),ritmo.quitar_push(text),ritmo.tomar_push(),ritmo.terminar_push(uuid,boolean,boolean) TO ritmo_api;
CREATE FUNCTION ritmo.favoritos_cliente() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; trabajos uuid[];BEGIN u:=ritmo.usuario_cliente();SELECT coalesce(array_agg(destino::uuid),'{}'::uuid[]) INTO trabajos FROM ritmo.social_guardados WHERE usuario_id=u AND tipo='trabajo';RETURN jsonb_build_object('trabajos',ritmo.trabajos_publicos(NULL,trabajos),'negocios',coalesce((SELECT jsonb_agg(ritmo.perfil_publico(e.slug)) FROM ritmo.social_guardados g JOIN ritmo.negocios_enlaces e ON e.negocio_id::text=g.destino WHERE g.usuario_id=u AND g.tipo='negocio' AND ritmo.negocio_publico(e.negocio_id)),'[]'::jsonb));END $$;
REVOKE ALL ON FUNCTION ritmo.favoritos_cliente() FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.favoritos_cliente() TO ritmo_api;
COMMIT;
