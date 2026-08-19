-- Justificación obligatoria al marcar "No recomendado para dar estudios"
-- (exclusión de la invitación a CDEB). La fecha ya existe
-- (not_recommended_to_lead_studies_at); esto agrega el porqué.
ALTER TABLE public.member_admin_data
  ADD COLUMN IF NOT EXISTS not_recommended_reason text;
