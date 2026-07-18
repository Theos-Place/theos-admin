-- Recomendaciones de estudiantes al cierre de estudio: el dirigente (o
-- coordinador) puede recomendar a un estudiante para oración, servicio o
-- formación como dirigente, con justificación opcional.

CREATE TABLE member_recommendations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  recommended_for TEXT NOT NULL CHECK (recommended_for IN ('oracion', 'servicio', 'dirigente')),
  justification   TEXT,
  recommended_by  UUID REFERENCES members(id) ON DELETE SET NULL,
  study_group_id  UUID REFERENCES study_groups(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_member_recommendations_member ON member_recommendations(member_id);

ALTER TABLE member_recommendations ENABLE ROW LEVEL SECURITY;

-- Crear: coordinadores de estudios/dirigentes y admin, o el dirigente /
-- co-dirigente del grupo del cierre. (Hoy las escrituras van por service role
-- con requireRoles en la ruta; estas políticas preparan la Fase 3 de RLS.)
CREATE POLICY "member_recommendations_insert" ON member_recommendations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM member_roles mr
      JOIN members m ON m.id = mr.member_id
      WHERE m.auth_user_id = (SELECT auth.uid()) AND mr.is_active
        AND mr.role IN ('admin', 'direccion', 'coordinador_estudios', 'coordinador_dirigentes')
    )
    OR EXISTS (
      SELECT 1 FROM study_groups g
      JOIN members m ON m.auth_user_id = (SELECT auth.uid())
      WHERE g.id = study_group_id AND (g.leader_id = m.id OR g.co_leader_id = m.id)
    )
  );

-- Leer: roles de estudios y admin (NO el rol miembro).
CREATE POLICY "member_recommendations_select" ON member_recommendations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM member_roles mr
      JOIN members m ON m.id = mr.member_id
      WHERE m.auth_user_id = (SELECT auth.uid()) AND mr.is_active
        AND mr.role IN ('admin', 'direccion', 'coordinador_estudios', 'coordinador_dirigentes', 'dirigente')
    )
  );
