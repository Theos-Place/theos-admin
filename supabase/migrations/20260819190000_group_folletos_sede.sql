-- Sede a la que se envían los folletos del grupo, elegida al crear/editar el
-- grupo (sedes activas, 'TBD' u 'Otro: <detalle>'). El tiquete automático de
-- folletos la usa primero; si es TBD cae a la sede del dirigente.
ALTER TABLE public.study_groups
  ADD COLUMN IF NOT EXISTS folletos_sede text DEFAULT 'TBD';
