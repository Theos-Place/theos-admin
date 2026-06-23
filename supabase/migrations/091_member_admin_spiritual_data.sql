-- Datos administrativos y espirituales del miembro en tablas SEPARADAS, porque
-- tienen permisos distintos:
--   · member_admin_data    → el miembro NUNCA accede (solo roles administrativos).
--   · member_spiritual_data→ el propio miembro accede a SU fila; admins a todas.
-- Separarlas evita la complicación de permisos por columna.

-- Helper: ¿la sesión tiene rol activo administrativo de estudios?
-- (admin / coordinador_estudios / coordinador_dirigentes / direccion).
CREATE OR REPLACE FUNCTION private.is_study_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM member_roles mr
    JOIN members m ON m.id = mr.member_id
    WHERE m.auth_user_id = (SELECT auth.uid())
      AND mr.is_active
      AND mr.role IN ('admin', 'coordinador_estudios', 'coordinador_dirigentes', 'direccion')
  );
$$;

-- ── Datos administrativos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_admin_data (
  member_id                    UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  approved_to_lead_studies     BOOLEAN NOT NULL DEFAULT false,
  approved_to_lead_studies_by  UUID REFERENCES members(id) ON DELETE SET NULL,
  approved_to_lead_studies_at  TIMESTAMPTZ,
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE member_admin_data ENABLE ROW LEVEL SECURITY;

-- Solo roles administrativos (lectura y escritura). El miembro NUNCA accede.
-- La restricción "aprobar solo coord_estudios/admin" se enforce en la API.
CREATE POLICY "mad_select" ON member_admin_data FOR SELECT TO authenticated
  USING (private.is_study_admin());
CREATE POLICY "mad_insert" ON member_admin_data FOR INSERT TO authenticated
  WITH CHECK (private.is_study_admin());
CREATE POLICY "mad_update" ON member_admin_data FOR UPDATE TO authenticated
  USING (private.is_study_admin()) WITH CHECK (private.is_study_admin());

-- ── Datos espirituales ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_spiritual_data (
  member_id        UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  baptism_date     DATE,
  baptism_place    TEXT,
  spiritual_gifts  TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE member_spiritual_data ENABLE ROW LEVEL SECURITY;

-- El propio miembro (su fila) o cualquier rol administrativo (todas las filas).
CREATE POLICY "msd_select" ON member_spiritual_data FOR SELECT TO authenticated
  USING (private.is_study_admin() OR member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid())));
CREATE POLICY "msd_insert" ON member_spiritual_data FOR INSERT TO authenticated
  WITH CHECK (private.is_study_admin() OR member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid())));
CREATE POLICY "msd_update" ON member_spiritual_data FOR UPDATE TO authenticated
  USING (private.is_study_admin() OR member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid())))
  WITH CHECK (private.is_study_admin() OR member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid())));
