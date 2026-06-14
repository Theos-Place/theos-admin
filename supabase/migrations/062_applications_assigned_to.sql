-- 062: Responsable de aplicaciones de servicio (igual que reviewed_by en
-- study_requests) + historial de cambios. La notificación al asignado usa
-- internal_notifications (tabla existente).

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES members(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS application_status_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status    TEXT,
  to_status      TEXT,
  assigned_to    UUID REFERENCES members(id) ON DELETE SET NULL,
  changed_by     UUID REFERENCES members(id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_status_history_app ON application_status_history(application_id);
