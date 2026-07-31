-- EST-10: revisión/selección del comité sobre las respuestas de un formulario de
-- preinscripción (CDEB, Hermenéutica). Una fila por respuesta revisada.
--
-- SENSIBLE: las respuestas incluyen testimonio, luchas personales y posturas
-- doctrinales, y la decisión del comité es información interna. RLS habilitado
-- SIN policies (deny-by-default; solo service role); los endpoints gatean a
-- coordinador_dirigentes / coordinador_estudios / admin.
CREATE TABLE IF NOT EXISTS form_response_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  -- Decisión del comité. 'pendiente' es el estado inicial explícito: una fila
  -- puede existir solo con notas internas, antes de decidir.
  status text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'aprobado', 'lista_espera', 'rechazado')),
  -- Notas internas del comité (no las ve la persona).
  notes text,
  reviewed_by uuid REFERENCES members(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  -- Trazabilidad del envío de la invitación (para no invitar dos veces).
  invited_at timestamptz,
  invitation_id uuid REFERENCES study_invitations(id) ON DELETE SET NULL,
  broadcast_id uuid REFERENCES message_broadcasts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Una revisión por respuesta (el guardado hace upsert).
  CONSTRAINT form_response_reviews_response_uniq UNIQUE (response_id)
);

CREATE INDEX IF NOT EXISTS idx_form_response_reviews_form ON form_response_reviews(form_id);
-- Cola de invitaciones: aprobados de un formulario que todavía no se invitan.
CREATE INDEX IF NOT EXISTS idx_form_response_reviews_por_invitar
  ON form_response_reviews(form_id) WHERE status = 'aprobado' AND invited_at IS NULL;

CREATE TRIGGER set_updated_at_form_response_reviews BEFORE UPDATE ON form_response_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE form_response_reviews ENABLE ROW LEVEL SECURITY;
-- Sin policies: deny-by-default; solo service role vía los endpoints gateados.
