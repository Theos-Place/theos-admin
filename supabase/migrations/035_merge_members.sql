-- 035: Fusión de miembros duplicados. Reasigna todas las referencias del
-- miembro duplicado (dup_id) al que se conserva (keep_id) y borra el duplicado.
-- Transaccional (es una función). Pre-borra filas que chocarían con los UNIQUE
-- que incluyen al miembro. El perfil que gana es el de keep_id (no se tocan sus
-- columnas).

CREATE OR REPLACE FUNCTION public.merge_members(keep_id uuid, dup_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF keep_id = dup_id THEN
    RAISE EXCEPTION 'No se puede fusionar un miembro consigo mismo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM members WHERE id = keep_id) THEN
    RAISE EXCEPTION 'Miembro a conservar no existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM members WHERE id = dup_id) THEN
    RAISE EXCEPTION 'Miembro duplicado no existe';
  END IF;

  -- ── Pre-borrar colisiones de UNIQUE(member, X) ──────────────────────────────
  DELETE FROM applications a WHERE a.applicant_id = dup_id
    AND EXISTS (SELECT 1 FROM applications k WHERE k.applicant_id = keep_id AND k.vacancy_id = a.vacancy_id);
  DELETE FROM family_members a WHERE a.member_id = dup_id
    AND EXISTS (SELECT 1 FROM family_members k WHERE k.member_id = keep_id AND k.family_unit_id = a.family_unit_id);
  DELETE FROM member_roles a WHERE a.member_id = dup_id
    AND EXISTS (SELECT 1 FROM member_roles k WHERE k.member_id = keep_id AND k.role = a.role);
  DELETE FROM volunteers a WHERE a.member_id = dup_id
    AND EXISTS (SELECT 1 FROM volunteers k WHERE k.member_id = keep_id AND k.position_id = a.position_id);
  DELETE FROM event_volunteers a WHERE a.member_id = dup_id
    AND EXISTS (SELECT 1 FROM event_volunteers k WHERE k.member_id = keep_id AND k.event_id = a.event_id);
  DELETE FROM event_registrations a WHERE a.member_id = dup_id
    AND EXISTS (SELECT 1 FROM event_registrations k WHERE k.member_id = keep_id AND k.event_id = a.event_id);
  DELETE FROM study_enrollments a WHERE a.member_id = dup_id AND a.group_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM study_enrollments k WHERE k.member_id = keep_id AND k.group_id = a.group_id);
  DELETE FROM study_attendance a WHERE a.member_id = dup_id
    AND EXISTS (SELECT 1 FROM study_attendance k WHERE k.member_id = keep_id AND k.session_id = a.session_id);
  DELETE FROM study_leaders a WHERE a.member_id = dup_id
    AND EXISTS (SELECT 1 FROM study_leaders k WHERE k.member_id = keep_id);

  -- ── Reasignar columnas "propias" del miembro ────────────────────────────────
  UPDATE applications        SET applicant_id = keep_id WHERE applicant_id = dup_id;
  UPDATE donations           SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE employees           SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE event_checkins      SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE event_registrations SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE event_volunteers    SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE family_members      SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE form_responses      SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE member_roles        SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE message_logs        SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE payments            SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE refunds             SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE relocation_requests SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE scholarships        SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE study_attendance    SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE study_enrollments   SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE study_leaders       SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE study_waitlist      SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE volunteers          SET member_id = keep_id WHERE member_id = dup_id;

  -- ── Reasignar columnas "de referencia" (líder / mentor / creado_por) ────────
  UPDATE areas                  SET leader_id = keep_id WHERE leader_id = dup_id;
  UPDATE study_groups           SET leader_id = keep_id WHERE leader_id = dup_id;
  UPDATE study_groups           SET co_leader_id = keep_id WHERE co_leader_id = dup_id;
  UPDATE study_groups           SET co_leader_id = NULL WHERE co_leader_id = leader_id; -- evita líder = co-líder
  UPDATE study_plans            SET mentor_id = keep_id WHERE mentor_id = dup_id;
  UPDATE member_lists           SET created_by = keep_id WHERE created_by = dup_id;
  UPDATE member_roles           SET granted_by = keep_id WHERE granted_by = dup_id;
  UPDATE family_members         SET linked_by = keep_id WHERE linked_by = dup_id;
  UPDATE family_unlink_requests SET requester_id = keep_id WHERE requester_id = dup_id;
  UPDATE family_unlink_requests SET processed_by = keep_id WHERE processed_by = dup_id;

  -- ── Borrar el duplicado ─────────────────────────────────────────────────────
  DELETE FROM members WHERE id = dup_id;
END;
$fn$;

-- Solo el service-role (servidor) puede ejecutarla; no exponer a usuarios.
REVOKE EXECUTE ON FUNCTION public.merge_members(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_members(uuid, uuid) TO service_role;
