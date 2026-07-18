-- Listas guardadas de miembros (segmentos). Antes vivían en un store en memoria.
CREATE TABLE IF NOT EXISTS member_lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  filters       JSONB,
  segment_label TEXT,
  member_ids    JSONB NOT NULL DEFAULT '[]',
  member_count  INT NOT NULL DEFAULT 0,
  is_dynamic    BOOLEAN NOT NULL DEFAULT FALSE,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  created_by    UUID REFERENCES members(id) ON DELETE SET NULL,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_lists_created_at ON member_lists(created_at DESC);

ALTER TABLE member_lists ENABLE ROW LEVEL SECURITY;
-- App corre con service role (RLS off para service key); políticas para futuro.
CREATE POLICY "member_lists_select" ON member_lists FOR SELECT TO authenticated USING (TRUE);
