-- SRV · Un solo rol para los puestos y las aplicaciones de servicio.
--
-- EL CASO (2026-10-06): Jazmín Sánchez trató de publicar los puestos y no veía
-- el botón. Tiene `solicitudes_puestos`, que abre la pantalla y baja el Excel
-- pero NO publica — y el comentario del propio endpoint de solicitudes decía
-- «es la misma gente que va a apretar Publicar». La contradicción estaba
-- escrita en el código.
--
-- LA DECISIÓN (Floriana, 2026-10-07): los dos roles automáticos del comité de
-- servidores —«Colaborador Solicitud Puestos» y «Colaborador Aplicaciones»—
-- pasan a ser UNO, y ese rol ve las dos pantallas y publica.
--
-- SE PODÍA HABER DEJADO LOS DOS IDS COMO ALIAS Y NO SE HIZO. Tenían permisos
-- IDÉNTICOS (`servidores: view, all`) y solo los separaban los guards de las
-- rutas: mantener dos nombres para una misma cosa es la receta para que
-- mañana alguien le agregue algo a uno y no al otro, que es cómo nació este
-- bug.
--
-- A QUIÉN MUEVE, medido antes de escribirlo:
--   · solicitudes_puestos  → Jazmin Sanchez Arias
--   · aplicaciones_servicio → Diana Bermudez Paniagua, Wendy Buchanan Monge
-- Las tres quedan con el rol nuevo. Diana y Wendy GANAN publicar; Jazmín gana
-- ver las aplicaciones. Es lo que se pidió.

-- 1 · El rol nuevo entra al CHECK. Los dos viejos se QUEDAN aceptados: si una
--     fila sobrevive en algún lado, no se cae nada — simplemente ya no la
--     crea nadie.
do $$
declare v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid = 'public.member_roles'::regclass
     and conname = 'member_roles_role_check';
  if v_def is null then
    raise exception 'No existe member_roles_role_check: revisar antes de seguir.';
  end if;
  if position('puestos_servicio' in v_def) > 0 then
    raise notice 'El CHECK ya acepta puestos_servicio; no se toca.';
  else
    alter table public.member_roles drop constraint member_roles_role_check;
    execute format(
      'alter table public.member_roles add constraint member_roles_role_check %s',
      replace(v_def, '''aplicaciones_servicio''::text',
                     '''aplicaciones_servicio''::text, ''puestos_servicio''::text'));
  end if;
end $$;

-- 2 · Las personas. Se migra con ON CONFLICT porque alguien podría tener los
--     DOS roles viejos y quedaría con dos filas del nuevo.
insert into public.member_roles (member_id, role, is_active, origen)
select distinct r.member_id, 'puestos_servicio', true, coalesce(r.origen, 'automatico')
  from public.member_roles r
 where r.role in ('solicitudes_puestos', 'aplicaciones_servicio')
   and r.is_active
on conflict do nothing;

-- 3 · Los viejos se apagan. No se BORRAN: si mañana hay que revisar quién
--     tenía qué antes de la unificación, la fila está.
update public.member_roles
   set is_active = false
 where role in ('solicitudes_puestos', 'aplicaciones_servicio')
   and is_active;

-- 4 · El helper de RLS tiene que conocer el rol nuevo, o la base le bloquea
--     los datos de servidores aunque la pantalla se los muestre.
--
-- LO AGARRÓ UN TEST (`rls-helpers.test.ts`), que compara los roles del helper
-- contra los del módulo en la app. Sin él, Jazmín habría visto la pantalla
-- vacía en vez de un error: RLS no falla, devuelve cero filas.
--
-- La función se DERIVÓ de la que corre en producción (`pg_get_functiondef`),
-- no se reescribió de memoria. Lo único que cambia es que se agrega
-- 'puestos_servicio' a la lista; los dos viejos se quedan porque sus filas
-- siguen existiendo, apagadas.
CREATE OR REPLACE FUNCTION private.ve_servidores()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select private.has_any_role(ARRAY['admin','direccion','solo_lectura','encargado_staff',
    'coordinador_servidores','aplicaciones_servicio','solicitudes_puestos','puestos_servicio',
    'lider_comite']);
$function$;

-- AGENTS.md / SEC-3: una función nueva en un esquema publicado nace con
-- EXECUTE para PUBLIC. Ésta vive en `private`, que PostgREST no expone, y
-- `create or replace` conserva los permisos — se dejan explícitos igual para
-- que un `drop` futuro no la reabra.
revoke execute on function private.ve_servidores() from public, anon;
grant  execute on function private.ve_servidores() to authenticated, service_role;
