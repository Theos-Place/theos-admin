-- merge_members: arrastrar también los permisos por recurso (2026-08-06)
--
-- Hueco encontrado al fusionar duplicados: la función movía estudios, pagos,
-- asistencias y servicio, pero no `event_managers` ni `form_access_grants`.
-- Ambas tienen FK con ON DELETE CASCADE, así que el DELETE final del duplicado
-- se llevaba sus permisos EN SILENCIO: la encargada de un evento perdía el
-- evento por haber sido fusionada. Se mueven como todo lo demás, pre-borrando
-- las colisiones del UNIQUE (si las dos fichas eran encargadas del mismo
-- evento, queda una).

CREATE OR REPLACE FUNCTION public.merge_members(keep_id uuid, dup_id uuid, soft boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF keep_id = dup_id THEN RAISE EXCEPTION 'No se puede fusionar un miembro consigo mismo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM members WHERE id = keep_id) THEN RAISE EXCEPTION 'Miembro a conservar no existe'; END IF;
  IF NOT EXISTS (SELECT 1 FROM members WHERE id = dup_id) THEN RAISE EXCEPTION 'Miembro duplicado no existe'; END IF;

  DELETE FROM applications a WHERE a.applicant_id = dup_id AND EXISTS (SELECT 1 FROM applications k WHERE k.applicant_id = keep_id AND k.vacancy_id = a.vacancy_id);
  DELETE FROM family_members a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM family_members k WHERE k.member_id = keep_id AND k.family_unit_id = a.family_unit_id);
  DELETE FROM member_roles a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM member_roles k WHERE k.member_id = keep_id AND k.role = a.role);
  DELETE FROM volunteers a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM volunteers k WHERE k.member_id = keep_id AND k.position_id = a.position_id);
  DELETE FROM event_volunteers a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM event_volunteers k WHERE k.member_id = keep_id AND k.event_id = a.event_id);
  DELETE FROM event_registrations a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM event_registrations k WHERE k.member_id = keep_id AND k.event_id = a.event_id);
  -- (2) event_checkins: pre-borrar colisiones de UNIQUE(member_id, event_id).
  DELETE FROM event_checkins a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM event_checkins k WHERE k.member_id = keep_id AND k.event_id = a.event_id);
  DELETE FROM study_enrollments a WHERE a.member_id = dup_id AND a.group_id IS NOT NULL AND EXISTS (SELECT 1 FROM study_enrollments k WHERE k.member_id = keep_id AND k.group_id = a.group_id);
  DELETE FROM study_attendance a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM study_attendance k WHERE k.member_id = keep_id AND k.session_id = a.session_id);
  DELETE FROM study_leaders a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM study_leaders k WHERE k.member_id = keep_id);
  -- (3) Permisos por recurso: mismo pre-borrado por su UNIQUE.
  DELETE FROM event_managers a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM event_managers k WHERE k.member_id = keep_id AND k.event_id = a.event_id);
  DELETE FROM form_access_grants a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM form_access_grants k WHERE k.member_id = keep_id AND k.form_id = a.form_id);

  UPDATE applications        SET applicant_id = keep_id WHERE applicant_id = dup_id;
  UPDATE donations           SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE employees           SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE event_checkins      SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE event_managers      SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE event_registrations SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE event_volunteers    SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE family_members      SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE form_access_grants  SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE form_responses      SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE member_roles        SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE message_logs        SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE payments            SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE refunds             SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE study_requests      SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE scholarships        SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE study_attendance    SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE study_enrollments   SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE study_leaders       SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE volunteers          SET member_id = keep_id WHERE member_id = dup_id;

  UPDATE areas                  SET leader_id = keep_id WHERE leader_id = dup_id;
  UPDATE study_groups           SET leader_id = keep_id WHERE leader_id = dup_id;
  UPDATE study_groups           SET co_leader_id = keep_id WHERE co_leader_id = dup_id;
  UPDATE study_groups           SET co_leader_id = NULL WHERE co_leader_id = leader_id;
  UPDATE study_plans            SET mentor_id = keep_id WHERE mentor_id = dup_id;
  UPDATE member_lists           SET created_by = keep_id WHERE created_by = dup_id;
  UPDATE member_roles           SET granted_by = keep_id WHERE granted_by = dup_id;
  UPDATE family_members         SET linked_by = keep_id WHERE linked_by = dup_id;
  UPDATE event_managers         SET granted_by = keep_id WHERE granted_by = dup_id;
  UPDATE form_access_grants     SET granted_by = keep_id WHERE granted_by = dup_id;

  IF soft THEN
    UPDATE members SET is_active = false, deactivation_reason = 'merged', deactivated_at = now() WHERE id = dup_id;
  ELSE
    DELETE FROM members WHERE id = dup_id;
  END IF;
END;
$$;
