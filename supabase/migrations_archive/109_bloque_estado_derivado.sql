-- Estado de bloques derivado de fechas (no manual). Vigencia:
--   inicio = primer hito = fecha_apertura − 3 semanas (inicio del reporte preliminar)
--   fin    = fecha_cierre_matricula (último hito, conteo definitivo)
-- Estados: en_apertura (hoy < inicio) · activo (inicio ≤ hoy ≤ fin) · archivado (hoy > fin).
-- El estado se recalcula en lecturas y a diario (cron); esta migración migra los existentes.

ALTER TABLE capacitacion_bloques DROP CONSTRAINT IF EXISTS capacitacion_bloques_estado_check;
ALTER TABLE capacitacion_bloques ADD CONSTRAINT capacitacion_bloques_estado_check
  CHECK (estado = ANY (ARRAY['en_apertura','activo','archivado']::text[]));
ALTER TABLE capacitacion_bloques ALTER COLUMN estado SET DEFAULT 'en_apertura';

UPDATE capacitacion_bloques SET estado = CASE
  WHEN (timezone('America/Costa_Rica', now())::date) < (fecha_apertura - INTERVAL '21 days')::date THEN 'en_apertura'
  WHEN (timezone('America/Costa_Rica', now())::date) > fecha_cierre_matricula THEN 'archivado'
  ELSE 'activo'
END;
