-- CHK-4 · Un subevento puede declarar qué comité lo opera.
--
-- EL PROBLEMA (reportado 2026-09-21): la bienvenida de Youth no podía hacer
-- check-in. El permiso de EVE-12 se evalúa sobre `event_organizing_committees`,
-- que cuelga del EVENTO; el subevento de Youth vive dentro de la charla de la
-- sede, cuyo comité organizador es la sede. Youth no aparecía por ningún lado.
--
-- POR QUÉ NO ALCANZABA con sumar Comité Youth a los comités de la charla: esa
-- misma lista decide quién cuenta como SERVIDOR del evento para el precio y la
-- exención (ver `eventPricingFor` en queries/events.ts). Meter a Youth ahí
-- convertiría a todo el comité en servidor de esa charla para efectos de cobro,
-- que no es lo que se pidió. El comité del subevento vive aparte y solo se une
-- a la cuenta para el alcance de PUERTA.
--
-- Es una sola columna y no una tabla de unión como en el evento: un subevento
-- es UNA estación con UN equipo. Si dos comités la operaran, son dos subeventos.
alter table sub_events
  add column if not exists committee_id uuid references areas(id) on delete set null;

comment on column sub_events.committee_id is
  'Comité que opera este subevento. Se suma a los comités del evento SOLO para el alcance de check-in (CHK-4).';

create index if not exists sub_events_committee_id_idx on sub_events (committee_id) where committee_id is not null;
