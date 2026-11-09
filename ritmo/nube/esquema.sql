BEGIN;
SET LOCAL search_path = ritmo, pg_catalog;

CREATE TABLE IF NOT EXISTS belleza_estado (id integer PRIMARY KEY CHECK (id = 1), revision integer NOT NULL DEFAULT 0);
ALTER TABLE belleza_estado ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
INSERT INTO belleza_estado (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS belleza_objetos (
  id text PRIMARY KEY, version integer NOT NULL CHECK (version > 0), data jsonb,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE belleza_objetos ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS belleza_objetos_revision ON belleza_objetos (revision);
CREATE TABLE IF NOT EXISTS belleza_mutaciones (
  id text PRIMARY KEY, huella text NOT NULL, resultado jsonb NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS belleza_integraciones (id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS belleza_whatsapp_contactos (telefono text PRIMARY KEY, ultimo_mensaje timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS belleza_whatsapp_entradas (id text PRIMARY KEY, recibido_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS belleza_whatsapp_cola (
  id text PRIMARY KEY, cita_id text NOT NULL, tipo text NOT NULL, telefono text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente', mensaje_id text, creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(), motivo text
);
CREATE INDEX IF NOT EXISTS belleza_whatsapp_mensaje ON belleza_whatsapp_cola (mensaje_id);

ALTER TABLE ritmo.belleza_estado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acceso_servidor ON ritmo.belleza_estado;
CREATE POLICY acceso_servidor ON ritmo.belleza_estado TO ritmo_api USING (true) WITH CHECK (true);
ALTER TABLE ritmo.belleza_objetos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acceso_servidor ON ritmo.belleza_objetos;
CREATE POLICY acceso_servidor ON ritmo.belleza_objetos TO ritmo_api USING (true) WITH CHECK (true);
ALTER TABLE ritmo.belleza_mutaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acceso_servidor ON ritmo.belleza_mutaciones;
CREATE POLICY acceso_servidor ON ritmo.belleza_mutaciones TO ritmo_api USING (true) WITH CHECK (true);
ALTER TABLE ritmo.belleza_integraciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acceso_servidor ON ritmo.belleza_integraciones;
CREATE POLICY acceso_servidor ON ritmo.belleza_integraciones TO ritmo_api USING (true) WITH CHECK (true);
ALTER TABLE ritmo.belleza_whatsapp_contactos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acceso_servidor ON ritmo.belleza_whatsapp_contactos;
CREATE POLICY acceso_servidor ON ritmo.belleza_whatsapp_contactos TO ritmo_api USING (true) WITH CHECK (true);
ALTER TABLE ritmo.belleza_whatsapp_entradas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acceso_servidor ON ritmo.belleza_whatsapp_entradas;
CREATE POLICY acceso_servidor ON ritmo.belleza_whatsapp_entradas TO ritmo_api USING (true) WITH CHECK (true);
ALTER TABLE ritmo.belleza_whatsapp_cola ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acceso_servidor ON ritmo.belleza_whatsapp_cola;
CREATE POLICY acceso_servidor ON ritmo.belleza_whatsapp_cola TO ritmo_api USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ritmo TO ritmo_api;
REVOKE ALL ON ALL TABLES IN SCHEMA ritmo FROM PUBLIC, anon, authenticated;
COMMIT;
