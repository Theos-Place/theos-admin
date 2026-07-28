-- FOL-1: nuevas reglas de creación de folleto_requests (REEMPLAZAN la
-- generación por cierre de grupo y por hitos de bloque):
--   · cupo_lleno:    el grupo llegó a su cupo máximo durante la matrícula;
--   · fin_matricula: terminó el período de matrícula (GRU-1) con >= 5 matriculados;
--   · manual:        se mantiene tal cual.
-- Los tipos viejos (cierre, preapertura_*) quedan en el CHECK por los datos
-- históricos; ya no se generan.

ALTER TABLE folleto_requests DROP CONSTRAINT IF EXISTS folleto_requests_tipo_check;
ALTER TABLE folleto_requests ADD CONSTRAINT folleto_requests_tipo_check
  CHECK (tipo = ANY (ARRAY['cierre','preapertura_preliminar','preapertura_confirmacion','preapertura_final','reubicacion','manual','cupo_lleno','fin_matricula']));

-- Idempotencia race-safe: UN tiquete automático por grupo (si el cupo se llenó
-- ya no se genera otro al cerrar la matrícula, y re-matricular no duplica).
CREATE UNIQUE INDEX IF NOT EXISTS folleto_requests_auto_por_grupo
  ON folleto_requests (source_group_id)
  WHERE tipo IN ('cupo_lleno', 'fin_matricula');
