-- 056: Cierra los bajos de RLS de la auditoría 2026-06-11: leader_evaluations
-- (evaluaciones de dirigentes) y applications (aplicaciones a vacantes) tenían
-- SELECT abierto a cualquier authenticated. Usa private.has_any_role (055).

DROP POLICY IF EXISTS "leader_evaluations_select" ON leader_evaluations;
CREATE POLICY "leader_evaluations_select" ON leader_evaluations FOR SELECT TO authenticated
  USING (private.has_any_role(ARRAY['admin','coordinador_estudios','coordinador_dirigentes','direccion']));

DROP POLICY IF EXISTS "applications_select" ON applications;
CREATE POLICY "applications_select" ON applications FOR SELECT TO authenticated
  USING (private.has_any_role(ARRAY['admin','encargado_staff','direccion']));
