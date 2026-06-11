-- 055: Endurecimiento de RLS (auditoría 2026-06-11, S5 + medios).
-- Hoy la app accede vía service role (RLS inerte), pero estas políticas son la
-- base de la Fase 3 (acceso directo): sin esto, cualquier usuario autenticado
-- vería salarios y donaciones, y podría insertar a nombre de otro.

-- Helper: ¿el usuario actual tiene alguno de estos roles activos?
CREATE OR REPLACE FUNCTION private.has_any_role(roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM member_roles mr
    JOIN members m ON m.id = mr.member_id
    WHERE m.auth_user_id = (SELECT auth.uid())
      AND mr.role = ANY (roles)
      AND mr.is_active = TRUE
  );
$$;

-- Helper: ¿el member_id pertenece al usuario actual?
CREATE OR REPLACE FUNCTION private.is_own_member(target uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = target AND m.auth_user_id = (SELECT auth.uid())
  );
$$;

-- ── Finanzas (014): montos solo finanzas/admin; dirección ve filas ──────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['donations','refunds','import_batches']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON %1$I', t);
    EXECUTE format(
      $f$CREATE POLICY "%1$s_select" ON %1$I FOR SELECT TO authenticated
         USING (private.has_any_role(ARRAY['admin','finanzas','direccion']))$f$, t);
  END LOOP;
END $$;

-- ── Empleados (017): salarios solo finanzas/admin; resto roles de empleados ─
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['paid_positions','salary_changes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON %1$I', t);
    EXECUTE format(
      $f$CREATE POLICY "%1$s_select" ON %1$I FOR SELECT TO authenticated
         USING (private.has_any_role(ARRAY['admin','finanzas']))$f$, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['position_records','vacation_records']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON %1$I', t);
    EXECUTE format(
      $f$CREATE POLICY "%1$s_select" ON %1$I FOR SELECT TO authenticated
         USING (private.has_any_role(ARRAY['admin','encargado_staff','direccion','finanzas']))$f$, t);
  END LOOP;
END $$;

-- ── Solicitudes: INSERT solo a nombre propio (o rol gestor) ─────────────────
DROP POLICY IF EXISTS "study_requests_insert" ON study_requests;
CREATE POLICY "study_requests_insert" ON study_requests FOR INSERT TO authenticated
  WITH CHECK (
    private.is_own_member(member_id)
    OR private.has_any_role(ARRAY['admin','coordinador_estudios','coordinador_dirigentes'])
  );

DROP POLICY IF EXISTS "finance_requests_insert" ON finance_requests;
CREATE POLICY "finance_requests_insert" ON finance_requests FOR INSERT TO authenticated
  WITH CHECK (
    private.is_own_member(member_id)
    OR private.has_any_role(ARRAY['admin','finanzas'])
  );

-- Historial de estados: solo los roles que gestionan las solicitudes.
DROP POLICY IF EXISTS "request_history_insert" ON study_request_status_history;
CREATE POLICY "request_history_insert" ON study_request_status_history FOR INSERT TO authenticated
  WITH CHECK (private.has_any_role(ARRAY['admin','coordinador_estudios','coordinador_dirigentes']));

DROP POLICY IF EXISTS "finance_request_history_insert" ON finance_request_status_history;
CREATE POLICY "finance_request_history_insert" ON finance_request_status_history FOR INSERT TO authenticated
  WITH CHECK (private.has_any_role(ARRAY['admin','finanzas']));

-- Notificaciones internas: las crea el servidor (service role); ningún
-- usuario inserta directo (evita phishing interno en Fase 3).
DROP POLICY IF EXISTS "internal_notifications_insert" ON internal_notifications;

-- ── duplicate_dismissals: única tabla sin RLS (036) ─────────────────────────
ALTER TABLE duplicate_dismissals ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo service role (la gestión de duplicados es de la app).
