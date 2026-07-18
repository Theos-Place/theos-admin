-- B9 (revisión best practices 2026-07-13): dos cierres CONCURRENTES de grupos
-- con el mismo dirigente/horario/zona podían crear dos grupos sucesores
-- duplicados (findOrCreateSuccessorGroup hace find-then-create sin lock).
-- Este índice único parcial convierte la carrera en un error de BD que el
-- segundo insert recibe (y el find previo ya resuelve el caso normal).
--
-- NULLS DISTINCT (default): grupos sin dirigente/horario/zona no chocan entre
-- sí — hay pares históricos legítimos con NULL y un grupo "por definir" no
-- debe bloquear otro. La protección aplica al caso real: sucesores que heredan
-- dirigente + horario + zona del grupo que cierra.
CREATE UNIQUE INDEX IF NOT EXISTS study_groups_sucesor_uniq
  ON study_groups (plan_id, leader_id, schedule_time, zone)
  WHERE status IN ('en_matricula', 'en_curso');
