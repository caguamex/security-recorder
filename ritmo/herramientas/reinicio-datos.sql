-- Operación extraordinaria autorizada por Antonio: reiniciar solo los datos de Agendappx.
-- Requiere respaldo privado verificado y publicación preparada. No es una migración automática.
-- La eliminación de Auth y reserva de la identidad nueva se hacen después por Auth Admin, fuera de este SQL.
-- Configurar en la misma conexión: ritmo.reinicio_autorizado='agendappx-20261030',
-- ritmo.reinicio_usuarios='<JSON con los UUID esperados de Auth>', ritmo.reinicio_respaldo='<SHA-256 del respaldo>'.
BEGIN;
DO $$
DECLARE actuales text[]; esperados text[]; tablas text[];
BEGIN
 IF current_setting('ritmo.reinicio_autorizado',true) IS DISTINCT FROM 'agendappx-20261030'
 OR coalesce(current_setting('ritmo.reinicio_respaldo',true),'') !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Falta la autorización y huella del respaldo verificado'; END IF;
 SELECT array_agg(id::text ORDER BY id::text) INTO actuales FROM auth.users;
 SELECT array_agg(value ORDER BY value) INTO esperados FROM jsonb_array_elements_text(current_setting('ritmo.reinicio_usuarios')::jsonb);
 IF actuales IS DISTINCT FROM esperados OR esperados IS NULL THEN RAISE EXCEPTION 'Las cuentas cambiaron desde la revisión; detener y respaldar de nuevo'; END IF;
 SELECT array_agg(table_name::text ORDER BY table_name::text) INTO tablas FROM information_schema.tables WHERE table_schema='ritmo' AND table_type='BASE TABLE';
 IF tablas IS DISTINCT FROM ARRAY['acceso_sesiones','acceso_solicitudes','actividad_sesiones','belleza_estado','belleza_integraciones','belleza_mutaciones','belleza_objetos','belleza_whatsapp_cola','belleza_whatsapp_contactos','belleza_whatsapp_entradas','bitacora','calendarios_cuentas','codigos_manuales','contrasena_fallos','fundadoras_control','horario_especial','intentos_invitacion','invitaciones','miembros','negocios','negocios_enlaces','negocios_planes','negocios_suspendidos','plataforma_admins','plataforma_alertas','plataforma_bitacora','plataforma_conexiones','plataforma_sesiones','publico_perfiles','publico_reservas','publico_visitas','push_cola','push_suscripciones','registro_solicitudes','social_clientes','social_comentarios','social_guardados','social_me_gusta','social_moderadores','social_publicadores','social_reportes','social_resenas','social_seguidores','social_trabajos','usuarios_acceso','usuarios_apartados','whatsapp_alertas','whatsapp_anticipos','whatsapp_citas','whatsapp_conexiones','whatsapp_config','whatsapp_envios','whatsapp_sesiones']::text[] THEN
  RAISE EXCEPTION 'El esquema no coincide con el revisado; no se borra nada'; END IF;
END $$;
-- Lista explícita y RESTRICT: jamás propagar el borrado a otros esquemas ni a la conexión de códigos.
TRUNCATE TABLE
 ritmo.acceso_sesiones,
 ritmo.acceso_solicitudes,
 ritmo.actividad_sesiones,
 ritmo.belleza_estado,
 ritmo.belleza_integraciones,
 ritmo.belleza_mutaciones,
 ritmo.belleza_objetos,
 ritmo.belleza_whatsapp_cola,
 ritmo.belleza_whatsapp_contactos,
 ritmo.belleza_whatsapp_entradas,
 ritmo.bitacora,
 ritmo.calendarios_cuentas,
 ritmo.codigos_manuales,
 ritmo.contrasena_fallos,
 ritmo.horario_especial,
 ritmo.intentos_invitacion,
 ritmo.invitaciones,
 ritmo.miembros,
 ritmo.negocios,
 ritmo.negocios_enlaces,
 ritmo.negocios_planes,
 ritmo.negocios_suspendidos,
 ritmo.plataforma_admins,
 ritmo.plataforma_bitacora,
 ritmo.publico_perfiles,
 ritmo.publico_reservas,
 ritmo.publico_visitas,
 ritmo.push_cola,
 ritmo.push_suscripciones,
 ritmo.registro_solicitudes,
 ritmo.social_clientes,
 ritmo.social_comentarios,
 ritmo.social_guardados,
 ritmo.social_me_gusta,
 ritmo.social_moderadores,
 ritmo.social_publicadores,
 ritmo.social_reportes,
 ritmo.social_resenas,
 ritmo.social_seguidores,
 ritmo.social_trabajos,
 ritmo.usuarios_acceso,
 ritmo.usuarios_apartados,
 ritmo.whatsapp_alertas,
 ritmo.whatsapp_anticipos,
 ritmo.whatsapp_citas,
 ritmo.whatsapp_conexiones,
 ritmo.whatsapp_config,
 ritmo.whatsapp_envios,
 ritmo.whatsapp_sesiones
RESTART IDENTITY RESTRICT;
UPDATE ritmo.fundadoras_control SET asignados=0 WHERE id;
COMMIT;
