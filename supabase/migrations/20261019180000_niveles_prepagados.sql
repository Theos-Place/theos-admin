-- Paquetes de niveles en el esquema VIEJO (2026-10-19, grupo de Daniela Seas).
--
-- En legacy cada nivel cobra el suyo, pero hay gente que paga varios de una
-- vez (₡13.000 por N2+N3+N4). `niveles_prepagados` dice qué niveles SIGUIENTES
-- ya están pagados por esta persona: al cerrar el grupo, el sucesor no le
-- cobra si su nivel está en la lista, y la lista pasa a la matrícula nueva
-- con lo que quede. En bloques no se usa: ahí manda `cubre_bloque`.

alter table public.study_enrollments
  add column if not exists niveles_prepagados text[] not null default '{}';

alter table public.study_enrollments
  drop constraint if exists study_enrollments_niveles_prepagados_check,
  add constraint study_enrollments_niveles_prepagados_check
    check (coalesce(array_length(niveles_prepagados, 1), 0) <= 6);

comment on column public.study_enrollments.niveles_prepagados is
  'Legacy: niveles siguientes ya pagados en paquete (p. ej. {N3,N4}). El sucesor no los cobra.';
