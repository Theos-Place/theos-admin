-- Reimport de estudios (scripts/reimport-studies.ts): categoría nueva 'externa'
-- y planes históricos/externos archivados (is_active=false) para poder mapearlos.

-- Categoría 'externa' (capacitaciones externas, p.ej. Esepa)
alter table study_plans drop constraint if exists study_plans_level_check;
alter table study_plans add constraint study_plans_level_check
  check (level = any (array['niveles','etapa_inicial','etapa_intermedia','campanas','externa']));

-- Planes archivados (no curriculares, sin invitación, sin duración)
insert into study_plans (name, code, level, is_active, is_curricular, requires_invitation, duration_weeks, description)
values
  ('Plan Daniel', 'PLANDANIEL', 'etapa_inicial', false, false, false, null,
   'Capacitación inicial histórica (archivada).'),
  ('Teología del Antiguo Testamento (Esepa)', 'TEOAT', 'externa', false, false, false, null,
   'Curso externo (Esepa) — capacitación externa archivada.'),
  ('Lecturas con Propósito', 'LECTPROP', 'etapa_inicial', false, false, false, null,
   'Estudio de prueba que no continuó (archivado).'),
  ('Grupo Parejas', 'PAREJAS', 'etapa_inicial', false, false, false, null,
   'Estudio de matrimonios/parejas descontinuado (archivado).'),
  ('¿Quién es Jesús?', 'QEJ', 'etapa_inicial', false, false, false, null,
   'Estudio inicial descontinuado (archivado).')
on conflict do nothing;
