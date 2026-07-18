-- Planes históricos/descontinuados archivados (is_active=false) detectados en el
-- reseed de estudios: Lecturas con Propósito, Grupo Parejas, ¿Quién es Jesús?.
insert into study_plans (name, code, level, is_active, is_curricular, requires_invitation, duration_weeks, description)
values
  ('Lecturas con Propósito', 'LECTPROP', 'etapa_inicial', false, false, false, null,
   'Estudio de prueba que no continuó (archivado).'),
  ('Grupo Parejas', 'PAREJAS', 'etapa_inicial', false, false, false, null,
   'Estudio de matrimonios/parejas descontinuado (archivado).'),
  ('¿Quién es Jesús?', 'QEJ', 'etapa_inicial', false, false, false, null,
   'Estudio inicial descontinuado (archivado).')
on conflict do nothing;
