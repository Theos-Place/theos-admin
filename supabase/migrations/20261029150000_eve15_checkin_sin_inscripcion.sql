-- EVE-15 (2026-10-29) · La puerta de un evento con inscripción.
--
-- Dos cosas que el check-in no sabía decir:
--  1. que la persona llegó SIN inscripción (hoy en un evento pago eso solo se
--     resolvía cobrando en sitio, y en uno gratis ni se avisaba);
--  2. que un invitado que se inscribió por el link público, sin ficha, sí
--     llegó. Esas 29 personas de Matrimonios (2026-10-31) no existen en
--     `members`, pero su inscripción sí existe: es su fila en form_responses.
--
-- `form_response_id` liga el check-in a esa inscripción. Cuando después se le
-- asocie la ficha (EVE-14), el disparador le pasa el member_id al check-in: la
-- asistencia viaja con la persona y no se queda huérfana en un invitado.

begin;

alter table public.event_checkins
  add column if not exists form_response_id uuid references public.form_responses(id) on delete set null,
  add column if not exists sin_inscripcion boolean not null default false;

comment on column public.event_checkins.form_response_id is
  'EVE-15 · La inscripción por el link público (sin ficha) contra la que se hizo el check-in.';
comment on column public.event_checkins.sin_inscripcion is
  'EVE-15 · Llegó a un evento con inscripción sin estar inscrito/a. La puerta lo dejó pasar y el equipo lo maneja aparte.';

create index if not exists idx_event_checkins_form_response on public.event_checkins (form_response_id)
  where form_response_id is not null;
-- Un invitado, un check-in por evento: el mismo criterio que el índice por
-- miembro y día, pero las inscripciones por link son de eventos de una fecha.
create unique index if not exists event_checkins_form_response_evento_uniq
  on public.event_checkins (event_id, form_response_id) where form_response_id is not null;

-- Al vincular la ficha a la respuesta, el check-in del invitado pasa a ser de
-- la persona. Si ese día ya tenía uno propio en el evento, se deja el del
-- invitado como está: el índice único no permitiría los dos y perder el
-- vínculo sería peor que tener una fila de invitado de más.
create or replace function public.eve15_checkin_sigue_a_la_ficha()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if old.member_id is null and new.member_id is not null then
    update public.event_checkins c
       set member_id = new.member_id
     where c.form_response_id = new.id
       and c.member_id is null
       and not exists (
         select 1 from public.event_checkins o
          where o.event_id = c.event_id
            and o.member_id = new.member_id
            and (o.checked_in_at at time zone 'America/Costa_Rica')::date
              = (c.checked_in_at at time zone 'America/Costa_Rica')::date
       );
  end if;
  return new;
end;
$$;

revoke execute on function public.eve15_checkin_sigue_a_la_ficha() from public, anon, authenticated;
grant  execute on function public.eve15_checkin_sigue_a_la_ficha() to service_role;

drop trigger if exists trg_eve15_checkin_sigue_a_la_ficha on public.form_responses;
create trigger trg_eve15_checkin_sigue_a_la_ficha
  after update of member_id on public.form_responses
  for each row execute function public.eve15_checkin_sigue_a_la_ficha();

commit;
