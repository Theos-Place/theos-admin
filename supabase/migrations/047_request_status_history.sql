-- 047: historial de cambios de estado de solicitudes de estudios.
-- RLS con el enlace correcto members.auth_user_id (no auth.uid() directo).

CREATE TABLE study_request_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES study_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  changed_by  UUID REFERENCES members(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_request_history_request ON study_request_status_history(request_id);

ALTER TABLE study_request_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "request_history_select" ON study_request_status_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    JOIN members m ON m.id = mr.member_id
    WHERE m.auth_user_id = (SELECT auth.uid())
      AND mr.role IN ('admin', 'coordinador_estudios', 'coordinador_dirigentes')
      AND mr.is_active = TRUE
  ));

CREATE POLICY "request_history_insert" ON study_request_status_history FOR INSERT TO authenticated
  WITH CHECK (TRUE);
