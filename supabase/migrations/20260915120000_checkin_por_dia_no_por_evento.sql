-- URGENTE · En un evento RECURRENTE, el check-in es por DÍA, no por evento.
--
-- Un evento recurrente es UNA fila con una regla (WEEKLY:TUE), no una fila por
-- semana. El índice único era (member_id, event_id), así que quien marcó
-- asistencia a la Charla Meridiano Martes el 8 de setiembre NO PODÍA VOLVER A
-- MARCARLA NUNCA MÁS: la segunda vez chocaba contra el único.
--
-- Y al revés, la pantalla de check-in mostraba los 189 acumulados de todas las
-- semanas como si fueran los de hoy.
--
-- El índice pasa a incluir el DÍA en hora de Costa Rica. Un mismo evento
-- recurrente admite un check-in por persona POR DÍA, que es lo que la gente
-- hace: va todas las semanas. Y sigue impidiendo el duplicado real —dos
-- check-ins el mismo día—, que es para lo que el único existía.
--
-- La fecha va en hora CR y no en UTC: una charla que arranca a las 7 p.m. cae
-- en el día siguiente en UTC, así que con la fecha UTC dos personas de la misma
-- noche quedarían en días distintos.

drop index if exists public.event_checkins_member_event_uniq;

create unique index event_checkins_member_evento_dia_uniq
  on public.event_checkins (
    member_id,
    event_id,
    ((checked_in_at at time zone 'America/Costa_Rica')::date)
  )
  where member_id is not null;

comment on index public.event_checkins_member_evento_dia_uniq is
  'Un check-in por persona, por evento y por DÍA (hora CR). Antes era por evento a secas y en un recurrente semanal la gente no podía volver a marcar asistencia después de la primera vez.';
