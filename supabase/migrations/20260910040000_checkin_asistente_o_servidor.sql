-- En qué calidad hizo check-in la persona: como asistente o como servidora.
--
-- La pantalla ofrecía las dos opciones desde hacía tiempo, con su gate y todo,
-- pero la elección NO SALÍA DEL NAVEGADOR: el POST mandaba solo member_id,
-- sub_event_id y method. Alimentaba el estado optimista y se perdía al
-- refrescar. Verificado antes de escribir esto: `notes` está en NULL en las
-- 168.743 filas y event_volunteers existe con 0 filas — no había dónde
-- rescatarlo.
--
-- Por eso los 168.743 check-ins históricos quedan como 'asistente'. No es una
-- suposición: es que el dato nunca se guardó y no se puede reconstruir. Quien
-- lea números de servidores anteriores a hoy tiene que saber que son cero
-- porque no se medían, no porque nadie sirviera.

alter table event_checkins
  add column if not exists checked_in_as text not null default 'asistente';

alter table event_checkins
  drop constraint if exists event_checkins_checked_in_as_check;
alter table event_checkins
  add constraint event_checkins_checked_in_as_check
  check (checked_in_as in ('asistente', 'servidor'));

comment on column event_checkins.checked_in_as is
  'asistente | servidor. Default asistente. Los check-ins previos al 2026-09-10 son todos asistente porque la elección no se guardaba.';

-- Los reportes agrupan por evento y calidad; sin esto cada tarjeta de reporte
-- recorre los check-ins del evento entero para contar servidores.
create index if not exists event_checkins_event_calidad_idx
  on event_checkins (event_id, checked_in_as);
