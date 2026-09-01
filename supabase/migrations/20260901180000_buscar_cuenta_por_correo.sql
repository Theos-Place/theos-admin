-- Buscar una cuenta de Auth por correo, desde el servidor.
--
-- POR QUÉ HACE FALTA. El endpoint que cambia el correo de acceso tenía que
-- saber si ya existe otra cuenta con esa dirección, y lo resolvía con
-- auth.admin.listUsers({ page: 1, perPage: 1000 }): miraba MIL de las 18.415
-- cuentas. O sea el guard fallaba en silencio para el 95% del padrón, y cuando
-- no encontraba el duplicado el cambio reventaba más adelante con un 500 de
-- Supabase que no le dice nada a nadie.
--
-- auth.users no está expuesta por PostgREST, así que se consulta por acá.
--
-- SECURITY DEFINER con el search_path fijo, y REVOCADA de anon/authenticated:
-- devuelve si un correo tiene cuenta, que es justo lo que sirve para enumerar
-- direcciones registradas. Solo la llama el servidor con service_role.
CREATE OR REPLACE FUNCTION public.buscar_cuenta_por_correo(p_email text)
RETURNS TABLE (id uuid, email text, ha_entrado boolean, confirmada boolean, fichas bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT u.id,
         u.email::text,
         u.last_sign_in_at IS NOT NULL,
         u.email_confirmed_at IS NOT NULL,
         (SELECT count(*) FROM public.members m WHERE m.auth_user_id = u.id)
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.buscar_cuenta_por_correo(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buscar_cuenta_por_correo(text) FROM anon;
REVOKE ALL ON FUNCTION public.buscar_cuenta_por_correo(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_cuenta_por_correo(text) TO service_role;
