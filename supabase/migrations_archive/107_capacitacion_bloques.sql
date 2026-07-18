-- Bloques de capacitación + reportes de folletos previos a la apertura.
-- Una capacitación es cualquier estudio que NO sea Nivel 1-4 ni Discípulos 2-3.

CREATE TABLE IF NOT EXISTS capacitacion_bloques (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre text NOT NULL,                    -- ej. "Capacitaciones I-2026"
  anio integer NOT NULL,
  fecha_apertura date NOT NULL,            -- de acá se derivan los hitos
  fecha_cierre_matricula date NOT NULL,    -- hito final (conteo definitivo)
  estado text NOT NULL DEFAULT 'activo' CHECK (estado = ANY (ARRAY['activo','archivado']::text[])),
  -- Control anti-duplicado del cron: marca cuándo se envió cada hito.
  preliminar_sent_at timestamptz,
  confirmacion_sent_at timestamptz,
  final_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capacitacion_bloques_estado ON capacitacion_bloques(estado);

-- folleto_requests: distinguir tipo (cierre = Prompt A; preapertura_* = bloques) y
-- enlazar al bloque. Las de cierre mantienen su comportamiento (default 'cierre').
ALTER TABLE folleto_requests ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'cierre'
  CHECK (tipo = ANY (ARRAY['cierre','preapertura_preliminar','preapertura_confirmacion','preapertura_final']::text[]));
ALTER TABLE folleto_requests ADD COLUMN IF NOT EXISTS bloque_id uuid REFERENCES capacitacion_bloques(id) ON DELETE SET NULL;
-- Las de preapertura no tienen nivel destino (el bloque agrupa varios estudios).
ALTER TABLE folleto_requests ALTER COLUMN target_level_code DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folleto_requests_tipo ON folleto_requests(tipo);
CREATE INDEX IF NOT EXISTS idx_folleto_requests_bloque ON folleto_requests(bloque_id);
