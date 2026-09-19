-- SRV-4 · Último check-in de cada persona de una lista, en una sola consulta.
--
-- La pantalla "Mi comité" muestra 30-80 personas y necesita la fecha del último
-- check-in de cada una. Pedirlo por fila son 80 consultas; traer todos sus
-- check-ins y quedarse con el máximo trae miles de filas para usar 80. Un
-- DISTINCT ON lo resuelve en una.
create or replace function public.ultimo_checkin_de_miembros(p_member_ids uuid[])
returns table (member_id uuid, checked_in_at timestamptz, event_title text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select distinct on (c.member_id)
         c.member_id, c.checked_in_at, e.title
  from event_checkins c
  join events e on e.id = c.event_id
  where c.member_id = any(p_member_ids)
    and c.checked_in_at is not null
  order by c.member_id, c.checked_in_at desc
$$;

-- Una función creada en `public` nace con EXECUTE para PUBLIC y PostgREST la
-- publica en /rest/v1/rpc/ — o sea, llamable con la llave pública del bundle,
-- sin sesión. Ver AGENTS.md y SEC-3 (2026-09-17).
revoke execute on function public.ultimo_checkin_de_miembros(uuid[]) from public, anon, authenticated;
grant  execute on function public.ultimo_checkin_de_miembros(uuid[]) to service_role;
