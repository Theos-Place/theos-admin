-- 038: merge campo-por-campo en duplicados.
-- 1) columna field_updated_at (última edición por campo)
ALTER TABLE members ADD COLUMN IF NOT EXISTS field_updated_at JSONB DEFAULT '{}';

-- 2) find_duplicate_pairs: solo entre miembros ACTIVOS (los fusionados quedan inactivos)
CREATE OR REPLACE FUNCTION find_duplicate_pairs()
RETURNS TABLE(member_a uuid, member_b uuid, reasons text[])
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH act AS (SELECT * FROM members WHERE is_active),
  pairs AS (
    SELECT least(a.id,b.id) ma, greatest(a.id,b.id) mb, 'email'::text reason
      FROM act a JOIN act b ON a.id < b.id AND lower(a.email) = lower(b.email)
      WHERE a.email IS NOT NULL AND a.email <> ''
    UNION ALL
    SELECT least(a.id,b.id), greatest(a.id,b.id), 'cedula'
      FROM act a JOIN act b ON a.id < b.id AND a.cedula = b.cedula
      WHERE a.cedula IS NOT NULL AND a.cedula <> ''
    UNION ALL
    SELECT least(a.id,b.id), greatest(a.id,b.id), 'telefono'
      FROM act a JOIN act b ON a.id < b.id
        AND regexp_replace(a.phone,'[^0-9]','','g') = regexp_replace(b.phone,'[^0-9]','','g')
      WHERE a.phone IS NOT NULL AND length(regexp_replace(a.phone,'[^0-9]','','g')) >= 8
    UNION ALL
    SELECT least(a.id,b.id), greatest(a.id,b.id), 'nombre'
      FROM act a JOIN act b ON a.id < b.id
        AND lower(trim(a.first_name||' '||a.last_name)) = lower(trim(b.first_name||' '||b.last_name))
      WHERE a.first_name <> '' AND a.last_name <> ''
  )
  SELECT p.ma, p.mb, array_agg(distinct p.reason)
  FROM pairs p
  WHERE NOT EXISTS (SELECT 1 FROM duplicate_dismissals d WHERE d.member_a = p.ma AND d.member_b = p.mb)
  GROUP BY p.ma, p.mb
  LIMIT 200;
$$;
REVOKE EXECUTE ON FUNCTION find_duplicate_pairs() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_duplicate_pairs() TO service_role;

-- 3) merge_members con modo soft (marcar inactivo en vez de borrar)
DROP FUNCTION IF EXISTS public.merge_members(uuid, uuid);
CREATE OR REPLACE FUNCTION public.merge_members(keep_id uuid, dup_id uuid, soft boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $fn$
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
  DELETE FROM study_enrollments a WHERE a.member_id = dup_id AND a.group_id IS NOT NULL AND EXISTS (SELECT 1 FROM study_enrollments k WHERE k.member_id = keep_id AND k.group_id = a.group_id);
  DELETE FROM study_attendance a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM study_attendance k WHERE k.member_id = keep_id AND k.session_id = a.session_id);
  DELETE FROM study_leaders a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM study_leaders k WHERE k.member_id = keep_id);

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

  UPDATE areas                  SET leader_id = keep_id WHERE leader_id = dup_id;
  UPDATE study_groups           SET leader_id = keep_id WHERE leader_id = dup_id;
  UPDATE study_groups           SET co_leader_id = keep_id WHERE co_leader_id = dup_id;
  UPDATE study_groups           SET co_leader_id = NULL WHERE co_leader_id = leader_id;
  UPDATE study_plans            SET mentor_id = keep_id WHERE mentor_id = dup_id;
  UPDATE member_lists           SET created_by = keep_id WHERE created_by = dup_id;
  UPDATE member_roles           SET granted_by = keep_id WHERE granted_by = dup_id;
  UPDATE family_members         SET linked_by = keep_id WHERE linked_by = dup_id;
  UPDATE family_unlink_requests SET requester_id = keep_id WHERE requester_id = dup_id;
  UPDATE family_unlink_requests SET processed_by = keep_id WHERE processed_by = dup_id;

  IF soft THEN
    UPDATE members SET is_active = false, deactivation_reason = 'merged', deactivated_at = now() WHERE id = dup_id;
  ELSE
    DELETE FROM members WHERE id = dup_id;
  END IF;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.merge_members(uuid, uuid, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_members(uuid, uuid, boolean) TO service_role;
