-- EVE-14 (2026-10-30) · Personas por inscripción.
--
-- En el evento de Matrimonios UNA inscripción cubre a la pareja: 13
-- inscripciones son ~26 personas en la sala. El total real no se podía
-- mostrar porque el evento no sabía cuántas personas trae cada inscripción.
-- Es configurable por evento (1 = individual, 2 = pareja, …), no un «pareja»
-- escrito a mano; el resumen del evento dice «X inscripciones · ~N·X asistentes»
-- y la ocupación se mide en personas.

begin;

alter table public.events
  add column if not exists personas_por_inscripcion smallint not null default 1
    check (personas_por_inscripcion between 1 and 10);

comment on column public.events.personas_por_inscripcion is
  'EVE-14 · Cuántas personas cubre una inscripción (1 individual, 2 pareja…). Multiplica el total estimado de asistentes y la ocupación.';

-- El evento que lo pidió: Matrimonios (2026-10-31) se inscribe por pareja.
update public.events set personas_por_inscripcion = 2
  where id = 'cc4a64b9-843d-4dc9-9232-2574b18c477b' and personas_por_inscripcion = 1;

commit;
