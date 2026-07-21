-- Solicitud de folletos MANUAL (caso especial, no ligada a cierre de grupo).
-- Entra a la misma cola con tipo 'manual'. Agrega destinatario (dirigente) y nota.
ALTER TABLE folleto_requests DROP CONSTRAINT IF EXISTS folleto_requests_tipo_check;
ALTER TABLE folleto_requests ADD CONSTRAINT folleto_requests_tipo_check
  CHECK (tipo = ANY (ARRAY['cierre','preapertura_preliminar','preapertura_confirmacion','preapertura_final','reubicacion','manual']));
ALTER TABLE folleto_requests ADD COLUMN IF NOT EXISTS target_leader_id uuid REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE folleto_requests ADD COLUMN IF NOT EXISTS note text;
