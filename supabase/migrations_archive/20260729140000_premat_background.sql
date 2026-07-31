-- PRE-9: antecedentes de la pareja + diagnóstico en la solicitud prematrimonial.
-- Las solicitudes viejas quedan con estos campos NULL (la cola los muestra "—").
-- venue_defined / venue_outside_gam NO se borran (datos históricos); solo se
-- deja de preguntar por el lugar en el wizard.
ALTER TABLE prematrimonial_requests
  -- "¿Cuánto tiempo tienen de estar de novios?"
  ADD COLUMN IF NOT EXISTS dating_time text
    CHECK (dating_time IS NULL OR dating_time IN ('menos_1', '1_2', '3_4', 'mas_4')),
  -- "¿Es el primer matrimonio para ambos?" (+ detalle si no)
  ADD COLUMN IF NOT EXISTS first_marriage boolean,
  ADD COLUMN IF NOT EXISTS previous_marriage_notes text,
  -- "¿Tienen hijos de relaciones anteriores o en común?" (+ edades si sí)
  ADD COLUMN IF NOT EXISTS has_children boolean,
  ADD COLUMN IF NOT EXISTS children_ages text,
  -- "¿Viven en casas separadas o ya conviven juntos?"
  ADD COLUMN IF NOT EXISTS living_arrangement text
    CHECK (living_arrangement IS NULL OR living_arrangement IN ('separadas', 'convivimos')),
  -- Diagnóstico: conversación difícil / situación particular a abordar
  ADD COLUMN IF NOT EXISTS diagnostic_notes text;

COMMENT ON COLUMN prematrimonial_requests.previous_marriage_notes IS
  'PRE-9 SENSIBLE (pastoral): solo coordinador_estudios/direccion/admin — el API recorta este campo para otros roles.';
COMMENT ON COLUMN prematrimonial_requests.diagnostic_notes IS
  'PRE-9 SENSIBLE (pastoral): solo coordinador_estudios/direccion/admin — el API recorta este campo para otros roles.';
