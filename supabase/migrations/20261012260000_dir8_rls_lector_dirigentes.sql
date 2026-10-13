-- DIR-8 · `lector_dirigentes` entra al helper de RLS de estudios.
--
-- El rol nuevo tiene `estudios: view` con alcance `all`, igual que
-- `editor_dirigentes`. La lista de roles vive en DOS lugares —`lib/auth/roles`
-- y esta función— y el test `rls-helpers.test.ts` (INF-2) existe justamente
-- para que no diverjan: lo cazó al minuto de agregar el rol.
--
-- Sin esto, quien tuviera solo `lector_dirigentes` entraría a la pantalla y
-- la vería VACÍA: la app lo deja pasar y RLS no le devuelve filas. Es el peor
-- modo de fallo de un permiso, porque no se parece a un error de permisos.

create or replace function private.ve_estudios()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select private.has_any_role(ARRAY['admin','direccion','solo_lectura','coordinador_estudios',
    'coordinador_dirigentes','editor_grupos_estudio','editor_dirigentes','lector_dirigentes']);
$function$;
