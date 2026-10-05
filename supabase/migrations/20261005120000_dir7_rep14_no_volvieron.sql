-- DIR-7 / REP-14 · Los que dejaron de venir.
--
-- Dos reportes sobre la misma idea: DIR-7 le muestra a cada dirigente sus
-- exalumnos perdidos para escribirles, y REP-14 le muestra a dirección los
-- RECURRENTES que se fueron. La definición de «dejó de venir» —seis meses sin
-- ninguna señal— vive en lib/reports/no-volvieron.ts y acá se respeta; el
-- parámetro de meses entra desde afuera para que no haya dos verdades.
--
-- TODO AGREGADO EN SQL. Son 175 061 check-ins a charla: traerlos al cliente
-- para contarlos sería absurdo, y un N+1 por persona sobre 5 200 estudiantes
-- tampoco es opción.

-- ───────────────────────────────────────────────────────────────────────────
-- 1 · El seguimiento del contacto (DIR-7)
-- ───────────────────────────────────────────────────────────────────────────
--
-- NO SE SOBREESCRIBE: cada marca es una fila. El pedido dice «historial de
-- contactos si se marca más de una vez», y tiene sentido — «le escribí y no
-- contestó» seguido de «quiere volver» es la historia que importa, y guardar
-- solo lo último la borra.

create table if not exists public.contact_followups (
  id             uuid primary key default gen_random_uuid(),
  -- A quién se contactó.
  member_id      uuid not null references public.members(id) on delete cascade,
  -- Quién lo marcó. Se conserva la fila aunque la ficha se desactive: el
  -- historial dice quién dijo qué, y borrarlo al desactivar lo falsearía.
  marked_by      uuid references public.members(id) on delete set null,
  estado         text not null check (estado in (
                   'escrito_sin_respuesta', 'quiere_volver',
                   'cambio_de_iglesia', 'no_quiere_volver', 'numero_equivocado')),
  -- Solo cuando dijo que quiere volver.
  a_que_vuelve   text check (a_que_vuelve in ('charla', 'estudio', 'evento')),
  -- Solo cuando se cambió de iglesia: a cuál. Opcional.
  iglesia        text,
  nota           text,
  created_at     timestamptz not null default now()
);

comment on table public.contact_followups is
  'DIR-7: cada intento de reconectar con alguien que dejó de venir. Es un HISTORIAL: no se actualiza, se agrega.';

-- La consulta que importa es «lo último de cada persona», y se hace mil veces
-- al pintar la lista de un dirigente.
create index if not exists contact_followups_member_fecha
  on public.contact_followups (member_id, created_at desc);

-- Para el resumen de dirección: cuántos en cada desenlace.
create index if not exists contact_followups_estado
  on public.contact_followups (estado);

-- ───────────────────────────────────────────────────────────────────────────
-- 2 · DIR-7 · Los exalumnos de un dirigente que dejaron de venir
-- ───────────────────────────────────────────────────────────────────────────
--
-- «Su» exalumno = estuvo matriculado en un grupo que esa persona dirigió,
-- actual o histórico. Si estuvo en varios grupos del mismo dirigente se
-- reporta el MÁS RECIENTE, que es el que la persona recuerda.
--
-- La señal de vida mira DOS cosas, no solo las charlas: el último check-in a
-- charla y la última matrícula. Alguien que no va a la charla pero se
-- matriculó el mes pasado no está perdido.

create or replace function public.report_exalumnos_perdidos(
  p_leader_id uuid,
  p_meses     int default 6
)
returns table (
  member_id        uuid,
  nombre           text,
  telefono         text,
  grupo            text,
  anio_del_grupo   int,
  resultado        text,
  ultima_senal     timestamptz,
  ultimo_estado    text,
  ultimo_contacto  timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with corte as (select (now() - make_interval(months => p_meses)) as limite),
  -- Última charla de cada persona.
  charla as (
    select ci.member_id, max(ci.checked_in_at) as ultima
      from event_checkins ci
      join events e on e.id = ci.event_id
     where ci.member_id is not null and e.event_type = 'charla'
     group by ci.member_id
  ),
  -- Última señal de estudio: la matrícula más reciente.
  estudio as (
    select en.member_id, max(coalesce(en.completed_at, en.enrolled_at, en.created_at)) as ultima
      from study_enrollments en
     group by en.member_id
  ),
  -- El grupo MÁS RECIENTE de cada persona con ESTE dirigente.
  suyos as (
    select distinct on (en.member_id)
           en.member_id,
           coalesce(sp.name, g.name)                       as grupo,
           extract(year from coalesce(g.starts_at, g.created_at))::int as anio,
           en.status                                        as resultado,
           coalesce(g.starts_at, g.created_at::date)        as orden
      from study_enrollments en
      join study_groups g on g.id = en.group_id
      left join study_plans sp on sp.id = g.plan_id
     where g.leader_id = p_leader_id
     order by en.member_id, coalesce(g.starts_at, g.created_at::date) desc
  ),
  -- El último seguimiento registrado de cada persona.
  seguimiento as (
    select distinct on (f.member_id) f.member_id, f.estado, f.created_at
      from contact_followups f
     order by f.member_id, f.created_at desc
  )
  select s.member_id,
         trim(m.first_name || ' ' || m.last_name) as nombre,
         m.phone,
         s.grupo,
         s.anio,
         s.resultado,
         greatest(coalesce(c.ultima, 'epoch'::timestamptz),
                  coalesce(es.ultima, 'epoch'::timestamptz)) as ultima_senal,
         sg.estado,
         sg.created_at
    from suyos s
    join members m on m.id = s.member_id
    left join charla  c  on c.member_id  = s.member_id
    left join estudio es on es.member_id = s.member_id
    left join seguimiento sg on sg.member_id = s.member_id
   where m.is_active
     -- Un servidor activo NO está perdido: sirve aunque no asista a charla.
     -- Mandarle un «hace rato no te vemos» sería una metida de pata.
     and not exists (select 1 from volunteers v
                      where v.member_id = s.member_id and v.status = 'active')
     -- Sin ninguna señal en la ventana. `epoch` cubre a quien nunca tuvo una:
     -- el exalumno que terminó y jamás apareció por una charla es justamente
     -- a quien hay que buscar.
     and greatest(coalesce(c.ultima, 'epoch'::timestamptz),
                  coalesce(es.ultima, 'epoch'::timestamptz))
         < (select limite from corte)
   order by s.anio desc nulls last, nombre;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3 · REP-14 · Los recurrentes que ya no van
-- ───────────────────────────────────────────────────────────────────────────
--
-- Recurrente = al menos N check-ins a charla en TODO su histórico. Los 168k+
-- migrados cuentan: son asistencia real de esa persona en su fecha real.
--
-- La SEDE es la más frecuente de su histórico y no la calculada del sistema:
-- la calculada mira el último año, y esta gente justamente no tiene último
-- año. El título crudo va de vuelta para que el TS lo unifique con
-- `sedeFromTitle`, igual que el resto de los reportes (REP-13) — repetir el
-- diccionario de alias acá sería garantizar que se desincronicen.

create or replace function public.report_recurrentes_perdidos(
  p_min_checkins int default 20,
  p_meses        int default 6
)
returns table (
  member_id        uuid,
  nombre           text,
  telefono         text,
  email            text,
  sede_titulo      text,
  total_asistencias int,
  ultimo_checkin   timestamptz,
  anios            int[],
  llevo_estudio    boolean,
  ultimo_estudio   text,
  dirigente        text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with corte as (select (now() - make_interval(months => p_meses)) as limite),
  ci as (
    select c.member_id,
           count(*)::int                        as total,
           max(c.checked_in_at)                 as ultimo,
           array_agg(distinct extract(year from c.checked_in_at)::int
                     order by extract(year from c.checked_in_at)::int) as anios
      from event_checkins c
      join events e on e.id = c.event_id
     where c.member_id is not null and e.event_type = 'charla'
     group by c.member_id
  ),
  -- La charla a la que más fue. Empate: la más reciente, que es la que
  -- recuerda.
  sede as (
    select distinct on (c.member_id) c.member_id, e.title
      from event_checkins c
      join events e on e.id = c.event_id
     where c.member_id is not null and e.event_type = 'charla'
     group by c.member_id, e.title
     order by c.member_id, count(*) desc, max(c.checked_in_at) desc
  ),
  -- El último estudio COMPLETADO, con su dirigente. Mismo criterio que la
  -- hoja del aplicante (SRV-14): se ordena por la fecha del GRUPO y no por
  -- la de la fila, porque el histórico de CCB se importó todo el mismo día.
  est as (
    select distinct on (en.member_id)
           en.member_id,
           coalesce(sp.name, g.name) as estudio,
           trim(l.first_name || ' ' || l.last_name) as dirigente
      from study_enrollments en
      join study_groups g on g.id = en.group_id
      left join study_plans sp on sp.id = g.plan_id
      left join members l on l.id = g.leader_id
     where en.status = 'completed'
     order by en.member_id, coalesce(g.ends_at, g.starts_at, en.enrolled_at::date) desc
  )
  select ci.member_id,
         trim(m.first_name || ' ' || m.last_name) as nombre,
         m.phone,
         m.email,
         sede.title,
         ci.total,
         ci.ultimo,
         ci.anios,
         (est.member_id is not null) as llevo_estudio,
         est.estudio,
         est.dirigente
    from ci
    join members m on m.id = ci.member_id
    left join sede on sede.member_id = ci.member_id
    left join est  on est.member_id  = ci.member_id
   where ci.total >= p_min_checkins
     and ci.ultimo < (select limite from corte)
     and m.is_active
     and not exists (select 1 from volunteers v
                      where v.member_id = ci.member_id and v.status = 'active')
   order by ci.ultimo desc, nombre;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4 · Cerrar las funciones (AGENTS.md / SEC-3)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Una función nueva en `public` nace con EXECUTE para PUBLIC, y PostgREST
-- publica todo el esquema en /rest/v1/rpc/. Sin esto, cualquiera con la llave
-- pública del bundle podría pedir la lista de gente que dejó de ir, CON
-- TELÉFONOS, sin sesión. Las dos son SECURITY DEFINER a propósito y la app
-- las llama desde el servidor con la llave de servicio.

revoke execute on function public.report_exalumnos_perdidos(uuid, int) from public, anon, authenticated;
grant  execute on function public.report_exalumnos_perdidos(uuid, int) to service_role;

revoke execute on function public.report_recurrentes_perdidos(int, int) from public, anon, authenticated;
grant  execute on function public.report_recurrentes_perdidos(int, int) to service_role;

-- La tabla de seguimiento también: se escribe y se lee solo desde el servidor,
-- que ya gatea por dirigente.
alter table public.contact_followups enable row level security;
revoke all on table public.contact_followups from anon, authenticated;
grant all on table public.contact_followups to service_role;
