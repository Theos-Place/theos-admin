-- REP-6 · Personas nuevas: quién entró, por dónde y si se quedó.
--
-- "Nueva" = su PRIMERA ACTIVIDAD cae en el período. Primera actividad es la más
-- antigua entre el primer check-in a charla, la primera matrícula de estudio y
-- la primera inscripción a un evento. Así cuenta también quien entra
-- matriculándose sin haber asistido todavía.
--
-- NO se usa la fecha de creación de la ficha: se infla con los imports (23k
-- fichas de CCB llegaron el mismo día) y hoy hay 9.181 fichas SIN NINGUNA
-- actividad, que no son personas nuevas — son fichas. Las actividades migradas
-- de CCB sí cuentan: son actividad real de esa persona en su fecha real; lo que
-- no cuenta es la creación de la ficha por el import.

-- Base compartida. Existe como función propia para que la serie mensual y el
-- detalle no tengan cada una su copia del cálculo: dos definiciones de "primera
-- actividad" se desincronizan y el gráfico deja de cuadrar con la tabla.
create or replace function public.primera_actividad_por_miembro()
returns table (
  member_id uuid,
  fecha date,
  canal text,
  origen text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with charla as (
    select distinct on (ec.member_id)
           ec.member_id,
           (ec.checked_in_at at time zone 'America/Costa_Rica')::date as f,
           e.title as origen
    from event_checkins ec
    join events e on e.id = ec.event_id
    where e.event_type = 'charla' and ec.member_id is not null and ec.checked_in_at is not null
    order by ec.member_id, ec.checked_in_at asc
  ),
  estudio as (
    select distinct on (se.member_id)
           se.member_id,
           coalesce(se.enrolled_at::date, se.created_at::date) as f,
           coalesce(sp.name, sg.name, 'Estudio') as origen
    from study_enrollments se
    left join study_groups sg on sg.id = se.group_id
    left join study_plans sp on sp.id = coalesce(se.plan_id, sg.plan_id)
    where coalesce(se.enrolled_at, se.created_at) is not null
    order by se.member_id, coalesce(se.enrolled_at, se.created_at) asc
  ),
  evento as (
    select distinct on (er.member_id)
           er.member_id,
           er.registered_at::date as f,
           e.title as origen
    from event_registrations er
    join events e on e.id = er.event_id
    where er.registered_at is not null
    order by er.member_id, er.registered_at asc
  )
  select m.id,
         least(coalesce(c.f, 'infinity'::date), coalesce(s.f, 'infinity'::date), coalesce(v.f, 'infinity'::date)) as fecha,
         -- El empate se desempata en este orden a propósito: si alguien se
         -- matriculó y asistió el mismo día, entró por la charla — es donde lo
         -- vieron primero.
         case
           when c.f is not null and c.f <= least(coalesce(s.f, 'infinity'::date), coalesce(v.f, 'infinity'::date)) then 'charla'
           when s.f is not null and s.f <= coalesce(v.f, 'infinity'::date) then 'estudio'
           when v.f is not null then 'evento'
         end as canal,
         case
           when c.f is not null and c.f <= least(coalesce(s.f, 'infinity'::date), coalesce(v.f, 'infinity'::date)) then c.origen
           when s.f is not null and s.f <= coalesce(v.f, 'infinity'::date) then s.origen
           when v.f is not null then v.origen
         end as origen
  from members m
  left join charla  c on c.member_id = m.id
  left join estudio s on s.member_id = m.id
  left join evento  v on v.member_id = m.id
  -- Una ficha sin ninguna actividad no es una persona nueva todavía.
  where (c.f is not null or s.f is not null or v.f is not null)
    and m.first_name not ilike '%[prueba]%'
    and m.last_name  not ilike '%[prueba]%'
$$;

-- Serie para los gráficos: mes a mes y por canal. Chiquita, la trae entera.
create or replace function public.report_personas_nuevas_series()
returns table (anio integer, mes integer, canal text, n bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select extract(year from p.fecha)::int, extract(month from p.fecha)::int, p.canal, count(*)::bigint
  from primera_actividad_por_miembro() p
  group by 1, 2, 3
$$;

-- Detalle del período elegido, con las dos columnas de RETENCIÓN que el BI no
-- tiene: si volvió dentro de las 8 semanas siguientes, y si llegó a
-- matricularse después de su primera actividad. Son la diferencia entre medir
-- captación y medir permanencia.
create or replace function public.report_personas_nuevas(p_desde date, p_hasta date)
returns table (
  member_id uuid,
  nombre text,
  birth_date date,
  phone text,
  fecha date,
  canal text,
  origen text,
  volvio boolean,
  se_matriculo boolean,
  es_servidor boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.member_id,
         btrim(m.first_name || ' ' || m.last_name),
         m.birth_date,
         m.phone,
         p.fecha,
         p.canal,
         p.origen,
         exists (
           select 1 from event_checkins ec
           join events e on e.id = ec.event_id
           where ec.member_id = p.member_id
             and e.event_type = 'charla'
             and ec.checked_in_at is not null
             and (ec.checked_in_at at time zone 'America/Costa_Rica')::date > p.fecha
             and (ec.checked_in_at at time zone 'America/Costa_Rica')::date <= p.fecha + 56
         ),
         exists (
           select 1 from study_enrollments se
           where se.member_id = p.member_id
             and coalesce(se.enrolled_at::date, se.created_at::date) > p.fecha
         ),
         exists (
           select 1 from volunteers v where v.member_id = p.member_id and v.status = 'active'
         )
  from primera_actividad_por_miembro() p
  join members m on m.id = p.member_id
  where p.fecha between p_desde and p_hasta
  order by p.fecha desc, 2
$$;

-- Las tres en `public` nacen con EXECUTE para PUBLIC y PostgREST las publica en
-- /rest/v1/rpc/. El detalle devuelve teléfonos. Ver AGENTS.md y SEC-3.
revoke execute on function public.primera_actividad_por_miembro() from public, anon, authenticated;
revoke execute on function public.report_personas_nuevas_series() from public, anon, authenticated;
revoke execute on function public.report_personas_nuevas(date, date) from public, anon, authenticated;
grant  execute on function public.primera_actividad_por_miembro() to service_role;
grant  execute on function public.report_personas_nuevas_series() to service_role;
grant  execute on function public.report_personas_nuevas(date, date) to service_role;
