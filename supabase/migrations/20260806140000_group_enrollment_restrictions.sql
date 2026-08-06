-- GRU-2 · Restricción opcional de audiencia POR GRUPO (2026-08-06)
--
-- Caso: a veces un grupo de capacitación es solo para dirigentes, o solo para
-- quienes ya llevaron cierto estudio. Hoy la elegibilidad se calcula por PLAN y
-- todos los grupos de un plan se le ofrecen a cualquiera que califique.
--
-- ALCANCE: esto es del GRUPO, nunca del plan ni de la etapa. Dos grupos del
-- mismo plan pueden tener restricciones distintas, o uno tenerla y el otro no.
-- Los compromisos de la etapa (donador, servidor, asistencia, prerequisitos,
-- invitación) siguen viviendo en study_plans y se evalúan APARTE: la restricción
-- se suma, no reemplaza.
--
-- FORMA: el MISMO shape del filtro avanzado del padrón (FilterState de
-- src/types/filters.ts) — { conditions: [...], groups: [...], ops: {...} } — para
-- que el constructor de condiciones, las etiquetas y el resolvedor server-side
-- sean los mismos y no se desincronicen. NULL = sin restricción (comportamiento
-- de siempre).
--
-- NO se hereda: ni del plan al grupo, ni del grupo al sucesor cuando se cierra
-- una cohorte (a diferencia de dirigente/horario/zona).

ALTER TABLE public.study_groups
  ADD COLUMN IF NOT EXISTS enrollment_restrictions JSONB;

COMMENT ON COLUMN public.study_groups.enrollment_restrictions IS
  'GRU-2 · Restricción de audiencia de ESTE grupo, con el shape del filtro avanzado del padrón ({conditions, groups, ops}). NULL = sin restricción. Se evalúa ADEMÁS de los requisitos del plan, nunca en su lugar. No se hereda al grupo sucesor.';
