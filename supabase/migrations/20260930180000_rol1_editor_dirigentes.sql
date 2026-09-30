-- ROL-1 · El rol acotado `editor_dirigentes` llega a quien ya tiene el puesto.
--
-- SOLO EL PASO ADITIVO. La parte que QUITA `coordinador_dirigentes` a las seis
-- personas que no son la encargada NO está acá: va en
-- `scripts/rol1/` con su dry-run, porque toca accesos de gente con nombre y
-- apellido y dos de ellas perderían la cola de evaluaciones. La regla de la
-- casa es dry-run aprobado antes de un cambio de roles masivo.
--
-- POR QUÉ EL BACKFILL: la regla nueva de `position-roles` funciona sola de
-- ahora en adelante, pero el sync corre cuando alguien TOCA una asignación, y
-- las cuatro personas ya tienen el puesto desde antes.
--
-- MEDIDO ANTES (producción, 2026-09-30) — el puesto «Colaborador
-- actualización y datos» del Comité Dirigentes Administrativo lo ocupan
-- CUATRO personas:
--   · Andrey Rojas Moreno      — hoy con `coordinador_dirigentes`, 0 acciones
--   · Diego Quesada Matamoros  — hoy con `coordinador_dirigentes`, 0 acciones
--   · Wilbert Céspedes Chaves  — hoy con `coordinador_dirigentes`, 0 acciones
--   · Marianela Hernandez Sanchez — HOY SIN NINGÚN ROL: es la única que GANA
--     acceso con este cambio, y lo gana acotado a lo que es su trabajo.
--
-- Se llama a `grant_position_role`, no se inserta: ya es idempotente, ya
-- respeta un rol puesto a mano y ya crea la fila de
-- `member_role_position_grants`, que es lo que hace que al dejar el puesto
-- pierda el acceso.

begin;

-- 0) EL CHECK DE `member_roles.role` NO CONOCE EL ROL NUEVO, y sin esto el
--    paso de abajo falla con 23514. Es una trampa que este esquema ya cobró
--    antes (ver la nota de roles y accesos): la lista de roles vive DOS veces,
--    en `types/auth.ts` y en esta restricción.
--
--    Se agrega el valor sin reescribir la lista a mano —que sería la tercera
--    copia y la que se desactualiza—: se lee la definición vigente y se le
--    suma el valor nuevo.
do $$
declare v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid = 'public.member_roles'::regclass and conname = 'member_roles_role_check';

  if v_def is null then
    raise exception 'No existe member_roles_role_check — revisar antes de seguir';
  end if;

  if position('editor_dirigentes' in v_def) > 0 then
    raise notice 'ROL-1: el CHECK ya conocía editor_dirigentes.';
  else
    execute 'alter table public.member_roles drop constraint member_roles_role_check';
    execute 'alter table public.member_roles add constraint member_roles_role_check '
         || replace(v_def, 'ARRAY[', 'ARRAY[''editor_dirigentes''::text, ');
  end if;
end $$;

do $$
declare v record; v_n int := 0;
begin
  for v in
    select distinct vol.member_id, sp.id as position_id
      from public.volunteers vol
      join public.service_positions sp on sp.id = vol.position_id and sp.is_active
      join public.areas a on a.id = sp.area_id and a.is_active and a.area_type = 'committee'
     where vol.status = 'active'
       and a.name ilike '%dirigente%'
       and unaccent(lower(sp.title)) like 'colaborador%actualizacion%datos%'
  loop
    perform public.grant_position_role(v.member_id, 'editor_dirigentes', v.position_id);
    v_n := v_n + 1;
  end loop;
  raise notice 'ROL-1: editor_dirigentes otorgado a % persona(s).', v_n;
end $$;


-- 2) EL HELPER DE RLS TIENE QUE CONOCER EL ROL NUEVO.
--
-- `private.ve_estudios()` lleva la lista de roles escrita a mano en SQL — una
-- copia de lo que `roles.ts` ya dice—, y sin esto la base le negaría el paso a
-- quien la app sí deja pasar. No se notaría desde la app, que lee con la llave
-- de servicio, pero la defensa en profundidad quedaría mintiendo.
--
-- Lo encontró el test `rls-helpers`, que existe exactamente para esto. De paso
-- se descubrió que ese test leía UNA migración fija y no habría visto esta
-- redefinición: ahora barre todas y toma la vigente.
create or replace function private.ve_estudios()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select private.has_any_role(ARRAY['admin','direccion','solo_lectura','coordinador_estudios',
    'coordinador_dirigentes','editor_grupos_estudio','editor_dirigentes']);
$$;

-- AGENTS.md: el revoke va igual aunque la función viva en `private` y aunque
-- `create or replace` conserve los permisos — el esquema no es el permiso.
revoke execute on function private.ve_estudios() from public, anon, authenticated;
grant  execute on function private.ve_estudios() to service_role;

commit;
