-- Preparada localmente. No ejecutar sin respaldo y aprobación de migración.
DO $$ BEGIN
 IF current_setting('ritmo.migracion_autorizada',true) IS DISTINCT FROM 'si' THEN RAISE EXCEPTION 'Falta autorización de migración'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='agendappx_whatsapp') THEN CREATE ROLE agendappx_whatsapp NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='agendappx_whatsapp' AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN RAISE EXCEPTION 'El rol del mensajero tiene permisos excesivos'; END IF;
END $$;
CREATE TABLE ritmo.whatsapp_config(negocio_id uuid PRIMARY KEY REFERENCES ritmo.negocios(id), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE ritmo.whatsapp_conexiones(
 negocio_id uuid PRIMARY KEY REFERENCES ritmo.negocios(id), esperado text, numero text, estado text NOT NULL DEFAULT 'sin_vincular',
 manual boolean NOT NULL DEFAULT false, freno boolean NOT NULL DEFAULT false, motivo text NOT NULL DEFAULT '',
 ultima_conexion timestamptz, desconectado_desde timestamptz, latido timestamptz,
 propietario uuid, cerca bigint NOT NULL DEFAULT 0, reserva_hasta timestamptz,
 ventana_codigo timestamptz, codigos integer NOT NULL DEFAULT 0, proximo_envio timestamptz, ultima_solicitud timestamptz
);
CREATE UNIQUE INDEX whatsapp_un_numero ON ritmo.whatsapp_conexiones(numero) WHERE numero IS NOT NULL AND NOT manual;
CREATE TABLE ritmo.whatsapp_sesiones(negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id), llave text NOT NULL CHECK(llave ~ '^[a-f0-9]{64}$'), cifrado jsonb NOT NULL, actualizado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(negocio_id,llave));
CREATE TABLE ritmo.whatsapp_citas(negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),cita_id text NOT NULL,huella text NOT NULL,config_huella text NOT NULL DEFAULT '',generacion integer NOT NULL DEFAULT 0,creada_en timestamptz NOT NULL,PRIMARY KEY(negocio_id,cita_id));
CREATE TABLE ritmo.whatsapp_anticipos(
 negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),cita_id text NOT NULL,monto numeric(12,2) NOT NULL CHECK(monto>=0),
 estado text NOT NULL CHECK(estado IN ('pendiente','recibido','vencido','no_aplica')),limite timestamptz NOT NULL,
 recibido_en timestamptz,recibido_por uuid,metodo text,comprobante text CHECK(length(comprobante)<=48000),
 PRIMARY KEY(negocio_id,cita_id)
);
CREATE TABLE ritmo.whatsapp_envios(
 id text PRIMARY KEY CHECK(length(id)=64),negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),cita_id text NOT NULL,tipo text NOT NULL CHECK(tipo IN ('inicio','anticipo','dia','antes','cambio')),
 huella text NOT NULL,debido timestamptz NOT NULL,estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','procesando','aceptado','incierto','omitido','cancelado')),
 intento_en timestamptz,aceptado_en timestamptz,numero text,mensaje_id text,motivo text NOT NULL DEFAULT '',intentos integer NOT NULL DEFAULT 0
);
CREATE INDEX whatsapp_pendientes ON ritmo.whatsapp_envios(negocio_id,debido,id) WHERE estado='pendiente';
CREATE INDEX whatsapp_topes ON ritmo.whatsapp_envios(numero,intento_en) WHERE intento_en IS NOT NULL;
CREATE INDEX whatsapp_por_cita ON ritmo.whatsapp_envios(negocio_id,cita_id);
CREATE TABLE ritmo.whatsapp_alertas(id text PRIMARY KEY,negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),cita_id text,tipo text NOT NULL,creado_en timestamptz NOT NULL DEFAULT now(),resuelta boolean NOT NULL DEFAULT false);
-- Las citas anteriores no reciben un aviso de alta por activar el servicio.
INSERT INTO ritmo.whatsapp_citas(negocio_id,cita_id,huella,creada_en) SELECT negocio_id,id,'',actualizado_en FROM ritmo.belleza_objetos WHERE data->>'kind'='cita';
GRANT USAGE ON SCHEMA ritmo TO agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.sesion_vigente() TO agendappx_whatsapp;
GRANT SELECT(negocio_id,id,version,data,actualizado_en) ON ritmo.belleza_objetos TO agendappx_whatsapp;
GRANT SELECT(negocio_id,usuario_id,rol,activo,nombre,ver_todas,servicios) ON ritmo.miembros TO agendappx_whatsapp;
GRANT SELECT(id,nombre) ON ritmo.negocios TO agendappx_whatsapp;
CREATE POLICY whatsapp_fuentes ON ritmo.belleza_objetos FOR SELECT TO agendappx_whatsapp USING (data IS NULL OR id='__settings' OR data->>'kind' IN ('cita','clienta','servicio'));
CREATE POLICY whatsapp_miembros ON ritmo.miembros FOR SELECT TO agendappx_whatsapp USING(true);
CREATE POLICY whatsapp_negocios ON ritmo.negocios FOR SELECT TO agendappx_whatsapp USING(true);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['whatsapp_config','whatsapp_conexiones','whatsapp_sesiones','whatsapp_citas','whatsapp_anticipos','whatsapp_envios','whatsapp_alertas'] LOOP
  EXECUTE format('ALTER TABLE ritmo.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE ritmo.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON ritmo.%I FROM PUBLIC,anon,authenticated,ritmo_api',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON ritmo.%I TO agendappx_whatsapp',t);
  -- El procesador global de este proyecto requiere los salones propios; no es el rol de la app.
  EXECUTE format('CREATE POLICY mensajero ON ritmo.%I TO agendappx_whatsapp USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
-- El backend de cuentas solo puede leer metadatos conforme a RLS; nunca la sesión cifrada.
GRANT SELECT ON ritmo.whatsapp_config,ritmo.whatsapp_conexiones,ritmo.whatsapp_envios TO ritmo_api;
CREATE POLICY api_config ON ritmo.whatsapp_config FOR SELECT TO ritmo_api USING(ritmo.es_admin(negocio_id));
CREATE POLICY api_conexion ON ritmo.whatsapp_conexiones FOR SELECT TO ritmo_api USING(ritmo.es_admin(negocio_id));
CREATE POLICY api_envios ON ritmo.whatsapp_envios FOR SELECT TO ritmo_api USING(ritmo.es_admin(negocio_id));
GRANT SELECT ON ritmo.whatsapp_anticipos,ritmo.whatsapp_alertas TO ritmo_api;
CREATE POLICY api_anticipo ON ritmo.whatsapp_anticipos FOR SELECT TO ritmo_api USING((ritmo.miembro_actual(negocio_id)).rol IN ('admin','recepcion'));
CREATE POLICY api_alertas ON ritmo.whatsapp_alertas FOR SELECT TO ritmo_api USING((ritmo.miembro_actual(negocio_id)).rol IN ('admin','recepcion'));

-- Dependencia mínima del acceso: preservar calendarios privados al activar RLS por salón.
CREATE TABLE ritmo.calendarios_cuentas(huella text PRIMARY KEY,token text NOT NULL CHECK(token ~ '^[a-f0-9]{64}$'),negocio_id uuid NOT NULL REFERENCES ritmo.negocios(id),usuario_id uuid NOT NULL,creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(negocio_id,usuario_id));
ALTER TABLE ritmo.calendarios_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.calendarios_cuentas FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.calendarios_cuentas FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT SELECT,INSERT,UPDATE,DELETE ON ritmo.calendarios_cuentas TO ritmo_api;
CREATE POLICY calendario_persona ON ritmo.calendarios_cuentas TO ritmo_api USING(usuario_id=ritmo.usuario_actual() AND (ritmo.miembro_actual(negocio_id)).usuario_id IS NOT NULL) WITH CHECK(usuario_id=ritmo.usuario_actual() AND (ritmo.miembro_actual(negocio_id)).usuario_id IS NOT NULL);
INSERT INTO ritmo.calendarios_cuentas(huella,token,negocio_id,usuario_id)
 SELECT encode(sha256(convert_to(b.data->>'token','UTF8')),'hex'),b.data->>'token',b.negocio_id,m.usuario_id
 FROM ritmo.belleza_integraciones b JOIN ritmo.miembros m ON m.negocio_id=b.negocio_id AND m.rol='admin' AND m.activo
 WHERE b.id='calendario' AND b.data->>'token' ~ '^[a-f0-9]{64}$'
 AND m.usuario_id=nullif(current_setting('ritmo.migracion_admin',true),'')::uuid;
CREATE FUNCTION ritmo.feed_cuentas(h text) RETURNS TABLE(id text,version integer,data jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH p AS (SELECT c.negocio_id,c.usuario_id,m.rol,m.ver_todas FROM ritmo.calendarios_cuentas c JOIN ritmo.miembros m ON m.negocio_id=c.negocio_id AND m.usuario_id=c.usuario_id AND m.activo WHERE c.huella=h),
 citas AS (SELECT o.* FROM ritmo.belleza_objetos o JOIN p ON p.negocio_id=o.negocio_id WHERE o.data->>'kind'='cita' AND o.data->>'estado'<>'cancelada' AND (p.rol<>'especialista' OR o.data->>'especialista'=p.usuario_id::text))
 SELECT o.id,o.version,
 CASE WHEN o.id='__settings' THEN jsonb_build_object('negocio',o.data->>'negocio')
 WHEN o.data->>'kind'='cita' THEN jsonb_build_object('id',o.id,'kind','cita','date',o.data->>'date','start',o.data->>'start','estado',o.data->>'estado','servicio',o.data->>'servicio','clienta',o.data->>'clienta','updatedAt',o.data->>'updatedAt')
 WHEN o.data->>'kind'='servicio' THEN jsonb_build_object('id',o.id,'kind','servicio','nombre',o.data->>'nombre','duracion',o.data->'duracion')
 ELSE jsonb_build_object('id',o.id,'kind','clienta','nombre',o.data->>'nombre') END
 FROM ritmo.belleza_objetos o JOIN p ON p.negocio_id=o.negocio_id
 WHERE o.id='__settings' OR o.id IN(SELECT c.id FROM citas c) OR o.id IN(SELECT c.data->>'servicio' FROM citas c) OR o.id IN(SELECT c.data->>'clienta' FROM citas c)
 $$;
REVOKE ALL ON FUNCTION ritmo.feed_cuentas(text) FROM PUBLIC,anon,authenticated,agendappx_whatsapp;
GRANT EXECUTE ON FUNCTION ritmo.feed_cuentas(text) TO ritmo_api;
