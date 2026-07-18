-- 048: solicitudes financieras (becas y devoluciones) + historial de estados.
-- Mismo patrón que study_requests/047. RLS con el enlace correcto
-- members.auth_user_id (no auth.uid() directo).

CREATE TABLE finance_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  request_type    TEXT NOT NULL CHECK (request_type IN ('scholarship', 'refund')),
  -- Becas:
  study_group_id  UUID REFERENCES study_groups(id) ON DELETE SET NULL,
  -- Devoluciones:
  payment_id      UUID REFERENCES payments(id) ON DELETE SET NULL,
  amount          NUMERIC(12,2),
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_review', 'resolved', 'rejected')),
  reviewed_by     UUID REFERENCES members(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_finance_requests_member  ON finance_requests(member_id);
CREATE INDEX idx_finance_requests_status  ON finance_requests(status);
CREATE INDEX idx_finance_requests_type    ON finance_requests(request_type);
CREATE INDEX idx_finance_requests_group   ON finance_requests(study_group_id);
CREATE INDEX idx_finance_requests_payment ON finance_requests(payment_id);
CREATE INDEX idx_finance_requests_reviewer ON finance_requests(reviewed_by);

ALTER TABLE finance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_requests_insert" ON finance_requests FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "finance_requests_select" ON finance_requests FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM member_roles mr
      JOIN members m ON m.id = mr.member_id
      WHERE m.auth_user_id = (SELECT auth.uid())
        AND mr.role IN ('admin', 'finanzas')
        AND mr.is_active = TRUE
    )
  );

CREATE POLICY "finance_requests_update" ON finance_requests FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    JOIN members m ON m.id = mr.member_id
    WHERE m.auth_user_id = (SELECT auth.uid())
      AND mr.role IN ('admin', 'finanzas')
      AND mr.is_active = TRUE
  ));

-- Historial de cambios de estado
CREATE TABLE finance_request_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES finance_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  changed_by  UUID REFERENCES members(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_finance_request_history_request ON finance_request_status_history(request_id);

ALTER TABLE finance_request_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_request_history_select" ON finance_request_status_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    JOIN members m ON m.id = mr.member_id
    WHERE m.auth_user_id = (SELECT auth.uid())
      AND mr.role IN ('admin', 'finanzas')
      AND mr.is_active = TRUE
  ));

CREATE POLICY "finance_request_history_insert" ON finance_request_status_history FOR INSERT TO authenticated
  WITH CHECK (TRUE);
