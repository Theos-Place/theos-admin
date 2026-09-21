-- REP-6 · "Volvió" pasa de 8 a 5 semanas (decisión del usuario, 2026-09-21).
--
-- Cinco es el mismo corte que ya usa REP-5 para decir que alguien dejó de
-- venir. Tener dos ventanas distintas para la misma idea —"¿siguió viniendo?"—
-- obligaba a recordar cuál aplica en qué pantalla, y los dos reportes se miran
-- juntos.
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
             -- 5 semanas = 35 días. Mismo corte que SEMANAS_DE_CORTE en
             -- lib/reports/abandonos.ts, que es de donde sale el de REP-5.
             and (ec.checked_in_at at time zone 'America/Costa_Rica')::date <= p.fecha + 35
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

revoke execute on function public.report_personas_nuevas(date, date) from public, anon, authenticated;
grant  execute on function public.report_personas_nuevas(date, date) to service_role;
