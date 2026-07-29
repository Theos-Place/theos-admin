-- EST-9: recomendación a CDEB por estudiante, al cerrar grupos DIS3 / Panorama.
--
-- SENSIBLE: la recomendación es información de evaluación personal. RLS
-- habilitado SIN policies (deny-by-default para clientes con sesión, solo
-- service role); los endpoints gatean a coordinador_dirigentes /
-- coordinador_estudios / admin — ni el propio miembro, ni el dirigente que la
-- escribió una vez enviada, ni direccion.
CREATE TABLE IF NOT EXISTS cdeb_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES study_enrollments(id) ON DELETE SET NULL,
  -- Quién la llenó (el dirigente) y cuándo.
  filled_by uuid REFERENCES members(id) ON DELETE SET NULL,
  -- 'borrador' = guardado parcial (el cierre NO se bloquea por borradores);
  -- 'enviada' = completa, visible para el comité de dirigentes.
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviada')),
  -- Fecha de finalización del estudio (prellenada con la del cierre; editable:
  -- si aún no terminó, la prevista).
  completion_date date,
  -- Convicciones POR EXCEPCIÓN: solo se guardan los temas marcados con dudas o
  -- postura contraria, con su explicación. Forma:
  -- [{ topic: 'sexualidad', stance: 'dudas'|'contraria', notes: '...' }]
  convictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Escalas 1-5 ('x' = sin información suficiente, solo en Panorama).
  testimony_score text CHECK (testimony_score IS NULL OR testimony_score IN ('1','2','3','4','5','x')),
  testimony_notes text,
  passion_score text CHECK (passion_score IS NULL OR passion_score IN ('1','2','3','4','5','x')),
  passion_notes text,
  bible_knowledge_score text CHECK (bible_knowledge_score IS NULL OR bible_knowledge_score IN ('1','2','3','4','5')),
  speech_score text CHECK (speech_score IS NULL OR speech_score IN ('1','2','3','4','5')),
  speech_notes text,
  commitment_notes text,
  committee_notes text,
  -- Recomendación final.
  recommendation text CHECK (recommendation IS NULL OR recommendation IN ('si_sin_reservas', 'si_otro_estudio', 'si_con_reservas', 'no')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Una recomendación por estudiante y grupo (el guardado parcial hace upsert).
  CONSTRAINT cdeb_rec_member_group_uniq UNIQUE (member_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_cdeb_rec_member ON cdeb_recommendations(member_id);
CREATE INDEX IF NOT EXISTS idx_cdeb_rec_group ON cdeb_recommendations(group_id);
-- Cola del comité de dirigentes: las enviadas, más recientes primero.
CREATE INDEX IF NOT EXISTS idx_cdeb_rec_enviadas ON cdeb_recommendations(created_at DESC) WHERE status = 'enviada';

CREATE TRIGGER set_updated_at_cdeb_rec BEFORE UPDATE ON cdeb_recommendations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE cdeb_recommendations ENABLE ROW LEVEL SECURITY;
-- Sin policies: deny-by-default; solo service role vía los endpoints gateados.
