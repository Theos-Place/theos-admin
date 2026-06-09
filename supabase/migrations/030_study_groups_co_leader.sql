-- Co-dirigente del grupo de estudio.
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS co_leader_id UUID REFERENCES members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_study_groups_co_leader ON study_groups(co_leader_id);
