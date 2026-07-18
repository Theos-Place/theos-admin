-- B10 + B16 (revisión best practices 2026-07-13): índices para las queries
-- calientes y CHECKs de montos.

-- ── Índices de alto valor ──────────────────────────────────────────────────
-- FK de la 032 sin índice; lo golpean el dedup de la matrícula automática,
-- el guard de pendiente_de_pago de enrollMember y los embeds plan_direct
-- (14,763 inscripciones).
CREATE INDEX IF NOT EXISTS idx_enrollments_plan_member_status
  ON study_enrollments (plan_id, member_id, status);

-- La cola de revisión detecta comprobantes reusados con IN sobre
-- reference_code: hoy es un seq scan de payments completa en cada carga.
CREATE INDEX IF NOT EXISTS idx_payments_reference_code
  ON payments (reference_code) WHERE reference_code IS NOT NULL;

-- refreshBroadcastCounters/getBroadcastQueueStats hacen 3 counts por
-- broadcast filtrando por status.
CREATE INDEX IF NOT EXISTS idx_message_logs_broadcast_status
  ON message_logs (broadcast_id, status);

-- La cola de revisión filtra en_revision + ordena por created_at; el parcial
-- queda diminuto (la mayoría de pagos tiene review_status NULL o terminal).
CREATE INDEX IF NOT EXISTS idx_payments_en_revision
  ON payments (created_at) WHERE review_status = 'en_revision';

-- Perfil/asistencia por miembro (elegibilidad de matrícula: charlas de los
-- últimos 6 meses por member_id).
CREATE INDEX IF NOT EXISTS idx_checkins_member_time
  ON event_checkins (member_id, checked_in_at DESC);

-- ── FKs sin índice (advisor 2026-07-13) — las que el código sí recorre ─────
CREATE INDEX IF NOT EXISTS idx_payments_folleto_request ON payments (folleto_request_id) WHERE folleto_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_reviewed_by ON payments (reviewed_by) WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folleto_requests_source_group ON folleto_requests (source_group_id) WHERE source_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folleto_requests_bloque ON folleto_requests (bloque_id) WHERE bloque_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_member_recommendations_group ON member_recommendations (study_group_id);
CREATE INDEX IF NOT EXISTS idx_member_recommendations_by ON member_recommendations (recommended_by);
CREATE INDEX IF NOT EXISTS idx_event_exceptions_override ON event_exceptions (override_event_id) WHERE override_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_org_committees_committee ON event_organizing_committees (committee_id);
CREATE INDEX IF NOT EXISTS idx_study_invitations_invited_by ON study_invitations (invited_by);
CREATE INDEX IF NOT EXISTS idx_study_req_exceptions_plan ON study_requirement_exceptions (plan_id);

-- ── CHECKs de montos (B16) ─────────────────────────────────────────────────
-- NOT VALID: no bloquea escrituras ni exige limpiar histórico de una; el
-- VALIDATE posterior escanea sin lock exclusivo.
ALTER TABLE payments     DROP CONSTRAINT IF EXISTS payments_amount_nonneg;
ALTER TABLE payments     ADD CONSTRAINT payments_amount_nonneg     CHECK (amount >= 0) NOT VALID;
ALTER TABLE donations    DROP CONSTRAINT IF EXISTS donations_amount_nonneg;
ALTER TABLE donations    ADD CONSTRAINT donations_amount_nonneg    CHECK (amount >= 0) NOT VALID;
ALTER TABLE refunds      DROP CONSTRAINT IF EXISTS refunds_amount_nonneg;
ALTER TABLE refunds      ADD CONSTRAINT refunds_amount_nonneg      CHECK (amount >= 0) NOT VALID;
ALTER TABLE scholarships DROP CONSTRAINT IF EXISTS scholarships_final_nonneg;
ALTER TABLE scholarships ADD CONSTRAINT scholarships_final_nonneg  CHECK (final_amount >= 0) NOT VALID;
ALTER TABLE study_plans  DROP CONSTRAINT IF EXISTS study_plans_cost_nonneg;
ALTER TABLE study_plans  ADD CONSTRAINT study_plans_cost_nonneg    CHECK (cost >= 0) NOT VALID;

ALTER TABLE payments     VALIDATE CONSTRAINT payments_amount_nonneg;
ALTER TABLE donations    VALIDATE CONSTRAINT donations_amount_nonneg;
ALTER TABLE refunds      VALIDATE CONSTRAINT refunds_amount_nonneg;
ALTER TABLE scholarships VALIDATE CONSTRAINT scholarships_final_nonneg;
ALTER TABLE study_plans  VALIDATE CONSTRAINT study_plans_cost_nonneg;
