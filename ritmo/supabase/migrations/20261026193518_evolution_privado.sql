-- Solo prepara el esquema privado. No habilita LOGIN ni configura una contraseña.
-- Antes de aplicarlo: respaldo, aprobación de Antonio y verificación del presupuesto.
BEGIN;
DO $$ BEGIN
  IF current_setting('ritmo.migracion_autorizada',true) IS DISTINCT FROM 'si' THEN
    RAISE EXCEPTION 'Falta la autorización de migración';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='agendappx_evolution') THEN
    CREATE ROLE agendappx_evolution NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='agendappx_evolution' AND
    (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls OR rolreplication)) THEN
    RAISE EXCEPTION 'El rol existente tiene privilegios inesperados; revisar antes de continuar';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS agendappx_evolution AUTHORIZATION agendappx_evolution;
DO $$ BEGIN
  IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='agendappx_evolution')<>'agendappx_evolution' THEN
    RAISE EXCEPTION 'El esquema existente tiene otro propietario; no modificarlo';
  END IF;
END $$;
REVOKE ALL ON SCHEMA agendappx_evolution FROM PUBLIC,anon,authenticated,ritmo_api;
GRANT USAGE,CREATE ON SCHEMA agendappx_evolution TO agendappx_evolution;
ALTER DEFAULT PRIVILEGES FOR ROLE agendappx_evolution IN SCHEMA agendappx_evolution
  REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,ritmo_api;
ALTER DEFAULT PRIVILEGES FOR ROLE agendappx_evolution IN SCHEMA agendappx_evolution
  REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated,ritmo_api;
-- Prisma instala sus tablas solo después de aprobar el despliegue y proporcionar
-- la contraseña fuera de Git. Las tablas ritmo y las de FiNeCi quedan fuera de este rol.
COMMIT;
