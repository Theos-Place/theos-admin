-- 041: solicitudes de estudios (reubicación, unirse a grupo, grupo nuevo en zona),
-- destinatarios de notificaciones y notificaciones internas.
--
-- RLS: el enlace correcto usuario→miembro es members.auth_user_id = auth.uid()
-- (NO member_id = auth.uid(); ese bug se arregló en 033). La app opera vía
-- rutas API con service role (salta RLS); las políticas son defensa en
-- profundidad por si algún día se consulta directo desde el cliente.

-- ── Solicitudes ──────────────────────────────────────────────────────────────
CREATE TABLE study_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  request_type      TEXT NOT NULL CHECK (request_type IN ('new_group', 'join_group', 'relocation')),
  -- new_group y join_group:
  plan_id           UUID REFERENCES study_plans(id) ON DELETE SET NULL,
  -- join_group y relocation:
  existing_group_id UUID REFERENCES study_groups(id) ON DELETE SET NULL,
  -- relocation:
  current_group_id  UUID REFERENCES study_groups(id) ON DELETE SET NULL,
  -- new_group (propuesta del miembro):
  proposed_location TEXT,
  proposed_schedule TEXT,
  reason            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'in_review', 'resolved', 'rejected')),
  reviewed_by       UUID REFERENCES members(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_requests_member ON study_requests(member_id);
CREATE INDEX idx_study_requests_status ON study_requests(status);
CREATE INDEX idx_study_requests_type   ON study_requests(request_type);
CREATE INDEX idx_study_requests_plan   ON study_requests(plan_id);
CREATE INDEX idx_study_requests_existing_group ON study_requests(existing_group_id);
CREATE INDEX idx_study_requests_current_group  ON study_requests(current_group_id);
CREATE INDEX idx_study_requests_reviewed_by    ON study_requests(reviewed_by);

ALTER TABLE study_requests ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede crear.
CREATE POLICY "study_requests_insert" ON study_requests FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- El miembro ve las suyas; coordinadores y admin ven todas.
CREATE POLICY "study_requests_select" ON study_requests FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM member_roles mr
      JOIN members m ON m.id = mr.member_id
      WHERE m.auth_user_id = (SELECT auth.uid())
        AND mr.role IN ('admin', 'coordinador_estudios', 'coordinador_dirigentes')
        AND mr.is_active = TRUE
    )
  );

-- Solo coordinadores/admin actualizan.
CREATE POLICY "study_requests_update" ON study_requests FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    JOIN members m ON m.id = mr.member_id
    WHERE m.auth_user_id = (SELECT auth.uid())
      AND mr.role IN ('admin', 'coordinador_estudios', 'coordinador_dirigentes')
      AND mr.is_active = TRUE
  ));

-- ── Destinatarios de notificaciones de solicitudes ──────────────────────────
CREATE TABLE study_notification_recipients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id)
);

ALTER TABLE study_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_notification_recipients_all" ON study_notification_recipients
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    JOIN members m ON m.id = mr.member_id
    WHERE m.auth_user_id = (SELECT auth.uid())
      AND mr.role IN ('admin', 'coordinador_estudios')
      AND mr.is_active = TRUE
  ));

-- ── Notificaciones internas ──────────────────────────────────────────────────
CREATE TABLE internal_notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  title               TEXT NOT NULL,
  body                TEXT,
  link                TEXT,
  read                BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_internal_notifications_recipient
  ON internal_notifications(recipient_member_id, read);

ALTER TABLE internal_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_notifications_select" ON internal_notifications FOR SELECT TO authenticated
  USING (recipient_member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid())));

CREATE POLICY "internal_notifications_insert" ON internal_notifications FOR INSERT TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "internal_notifications_update" ON internal_notifications FOR UPDATE TO authenticated
  USING (recipient_member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid())));
