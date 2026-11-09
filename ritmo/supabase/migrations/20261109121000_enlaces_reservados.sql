-- Preparación local: aplicar junto con 20261109120000. Aditiva: solo amplía la lista de enlaces reservados.
-- /privacidad, /terminos y /legal son páginas de Agendappx; también se reservan /plataforma y /recuperar-acceso,
-- que el servidor ya rechazaba pero la función de la base no.
BEGIN;
CREATE OR REPLACE FUNCTION ritmo.editar_perfil_publico(n uuid,d jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ritmo.sesion_vigente() OR NOT ritmo.es_admin(n) THEN RAISE EXCEPTION 'Solo Admin' USING ERRCODE='42501'; END IF;
 IF d->>'slug' !~ '^[a-z0-9][a-z0-9-]{2,59}$' OR d->>'slug' IN('api','comunidad','planes','calendario','salud','webhooks','unirse','index','assets','plataforma','recuperar-acceso','privacidad','terminos','legal') THEN RAISE EXCEPTION 'Enlace inválido' USING ERRCODE='22023'; END IF;
 INSERT INTO ritmo.negocios_enlaces(negocio_id,slug) VALUES(n,d->>'slug') ON CONFLICT(negocio_id) DO UPDATE SET slug=excluded.slug;
 UPDATE ritmo.publico_perfiles SET visible=(d->>'visible')::boolean,descripcion=d->>'descripcion',ciudad=d->>'ciudad',colonia=d->>'colonia',direccion=d->>'direccion',whatsapp=coalesce(d->>'whatsapp',''),lat=(d->>'lat')::float8,lon=(d->>'lon')::float8,logo=d->>'logo',portada=d->>'portada',actualizado_en=now() WHERE negocio_id=n;
END $$;
COMMIT;
