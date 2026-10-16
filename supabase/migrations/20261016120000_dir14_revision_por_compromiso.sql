-- DIR-14 · La banderita «por compromiso» pasa a ser AUTOMÁTICA.
--
-- Va en columnas PROPIAS y no dentro de `revision`, que es la lista manual.
-- Si compartieran columna, guardar la ficha desde la pantalla (que manda la
-- lista entera) podría borrar la que puso el cron, y el cron, al quitar la
-- suya, podría llevarse una que alguien puso a mano. Separadas, ninguno de
-- los dos caminos puede pisar al otro.
--
-- La banderita automática está puesta si y solo si `revision_auto_faltan` no
-- está vacía; `revision_auto_desde` dice desde cuándo.

alter table public.study_leaders
  add column if not exists revision_auto_faltan text[] not null default '{}',
  add column if not exists revision_auto_desde timestamptz;

alter table public.study_leaders
  drop constraint if exists study_leaders_revision_auto_faltan_check,
  add constraint study_leaders_revision_auto_faltan_check
    check (revision_auto_faltan <@ array['donacion', 'asistencia']::text[]),
  drop constraint if exists study_leaders_revision_auto_coherente,
  add constraint study_leaders_revision_auto_coherente
    check ((cardinality(revision_auto_faltan) = 0) = (revision_auto_desde is null));

comment on column public.study_leaders.revision_auto_faltan is
  'DIR-14 · Compromisos que no cumple, según el cron semanal: donacion, asistencia. Vacío = sin banderita automática.';
comment on column public.study_leaders.revision_auto_desde is
  'DIR-14 · Desde cuándo tiene la banderita automática. Null si no la tiene.';
