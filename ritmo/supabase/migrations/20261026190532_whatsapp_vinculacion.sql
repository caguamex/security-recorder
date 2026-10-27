-- Requiere cuentas y autorización explícita antes de migrar. No contiene secretos.
BEGIN;
DO $$ BEGIN
  IF current_setting('ritmo.migracion_autorizada',true) IS DISTINCT FROM 'si' THEN
    RAISE EXCEPTION 'Falta la autorización de migración';
  END IF;
END $$;
CREATE TABLE ritmo.whatsapp_vinculaciones (
  negocio_id uuid PRIMARY KEY REFERENCES ritmo.negocios(id),
  clave_webhook_hash text NOT NULL CHECK (clave_webhook_hash ~ '^[a-f0-9]{64}$'),
  instancia text NOT NULL UNIQUE CHECK (instancia = 'agendappx_' || replace(negocio_id::text,'-','')),
  estado text NOT NULL DEFAULT 'sin_vincular' CHECK (estado IN
    ('sin_vincular','vinculando','conectado','reconectando','requiere_vincular','revisar')),
  telefono_esperado text, telefono_vinculado text, ultima_conexion timestamptz,
  ultima_revision timestamptz, detalle text NOT NULL DEFAULT '',
  cerrada_manualmente boolean NOT NULL DEFAULT false, generacion integer NOT NULL DEFAULT 0,
  operacion_id uuid, operacion_hasta timestamptz,
  ventana_codigos timestamptz NOT NULL DEFAULT now(), cantidad_codigos integer NOT NULL DEFAULT 0,
  fallos integer NOT NULL DEFAULT 0, recuperar_despues timestamptz,
  evento_en timestamptz, actualizado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ritmo.whatsapp_vinculaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ritmo.whatsapp_vinculaciones FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ritmo.whatsapp_vinculaciones FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON ritmo.whatsapp_vinculaciones TO ritmo_api;
CREATE POLICY conexion_admin ON ritmo.whatsapp_vinculaciones TO ritmo_api
  USING (ritmo.es_admin(negocio_id)) WITH CHECK (ritmo.es_admin(negocio_id));
-- El webhook no tiene una sesión de Admin: esta función interna solo cambia el estado
-- de la instancia cuya clave secreta demuestra y jamás entrega datos del salón.
CREATE FUNCTION ritmo.evento_vinculacion_whatsapp(n uuid,secreto text,s text,motivo integer,cuando timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF s NOT IN ('open','close','connecting') OR cuando>now()+interval '1 minute' OR cuando<now()-interval '1 day' THEN RETURN; END IF;
  UPDATE ritmo.whatsapp_vinculaciones SET
    estado=CASE WHEN motivo IN (401,403) THEN 'requiere_vincular' WHEN motivo=440 THEN 'revisar'
      WHEN estado='requiere_vincular' THEN estado WHEN s='open' AND estado='conectado' THEN estado ELSE 'reconectando' END,
    detalle=CASE WHEN motivo IN (401,403) THEN 'WhatsApp cerró la sesión. Vincula de nuevo.'
      WHEN motivo=440 THEN 'Otra conexión reemplazó esta sesión. Revisa los dispositivos vinculados.' ELSE '' END,
    recuperar_despues=CASE WHEN motivo=440 THEN now()+interval '1 day' ELSE recuperar_despues END,
    evento_en=cuando
    WHERE negocio_id=n AND clave_webhook_hash=encode(sha256(convert_to(secreto,'UTF8')),'hex')
      AND NOT cerrada_manualmente AND (evento_en IS NULL OR cuando>evento_en);
END $$;
REVOKE ALL ON FUNCTION ritmo.evento_vinculacion_whatsapp(uuid,text,text,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ritmo.evento_vinculacion_whatsapp(uuid,text,text,integer,timestamptz) TO ritmo_api;
-- No se guardan códigos de vinculación, llaves de Evolution ni credenciales del dispositivo aquí.
COMMIT;
