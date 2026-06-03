-- 009: Crear las políticas RLS que existían en el repo (001) pero nunca se
-- aplicaron a la base (se desincronizó al correr 001 por dashboard). Resuelve
-- el lint 0008 (rls_enabled_no_policy) en members, family_* y member_roles.

-- ── Helper para chequeo de admin sin recursión ──────────────────────────────
-- La política de member_roles necesita consultar member_roles, lo que dispara
-- recursión infinita de RLS. Un helper SECURITY DEFINER lee la tabla saltando
-- RLS. Lo ponemos en el schema `private` (no expuesto por PostgREST) para no
-- reintroducir el lint de funciones SECURITY DEFINER ejecutables vía RPC.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role = 'admin'
      AND mr.is_active = TRUE
  );
$$;

-- ── members ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Autenticados ven miembros activos" ON members;
CREATE POLICY "Autenticados ven miembros activos"
  ON members FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins gestionan miembros" ON members;
CREATE POLICY "Admins gestionan miembros"
  ON members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'editor_profiles')
      AND mr.is_active = TRUE
  ));

-- ── family_units ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Autenticados ven familias" ON family_units;
CREATE POLICY "Autenticados ven familias"
  ON family_units FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── family_members ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Autenticados ven vínculos familiares" ON family_members;
CREATE POLICY "Autenticados ven vínculos familiares"
  ON family_members FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── family_unlink_requests ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins ven solicitudes de desvinculación" ON family_unlink_requests;
CREATE POLICY "Admins ven solicitudes de desvinculación"
  ON family_unlink_requests FOR SELECT
  USING (private.is_admin());

-- ── member_roles (usa helper para evitar recursión) ─────────────────────────
DROP POLICY IF EXISTS "Admins gestionan roles" ON member_roles;
CREATE POLICY "Admins gestionan roles"
  ON member_roles FOR ALL
  USING (private.is_admin());
