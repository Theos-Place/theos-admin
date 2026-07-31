-- Solicitud de estudio (study_interest) v2: campos estructurados de día/horario,
-- razón ya no obligatoria (se quita del form de interés; reubicación la conserva),
-- y se persiste la elegibilidad del miembro al momento de solicitar (para que el
-- coordinador evalúe demanda). Zona sigue en proposed_location (nombre legible).
ALTER TABLE study_requests ALTER COLUMN reason DROP NOT NULL;
ALTER TABLE study_requests ADD COLUMN IF NOT EXISTS proposed_days text[] NOT NULL DEFAULT '{}';
ALTER TABLE study_requests ADD COLUMN IF NOT EXISTS proposed_time text
  CHECK (proposed_time IS NULL OR proposed_time = ANY (ARRAY['mañana','tarde','noche']));
-- Elegibilidad capturada al crear la solicitud (informativa para el coordinador).
ALTER TABLE study_requests ADD COLUMN IF NOT EXISTS was_eligible boolean;
ALTER TABLE study_requests ADD COLUMN IF NOT EXISTS eligibility_note text;
