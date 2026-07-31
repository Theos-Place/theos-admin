


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."has_any_role"("roles" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM member_roles mr
    JOIN members m ON m.id = mr.member_id
    WHERE m.auth_user_id = (SELECT auth.uid())
      AND mr.role = ANY (roles)
      AND mr.is_active = TRUE
  );
$$;


ALTER FUNCTION "private"."has_any_role"("roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM member_roles mr
    JOIN members m ON m.id = mr.member_id
    WHERE m.auth_user_id = auth.uid()
      AND mr.role = 'admin'
      AND mr.is_active = TRUE
  );
$$;


ALTER FUNCTION "private"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_own_member"("target" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = target AND m.auth_user_id = (SELECT auth.uid())
  );
$$;


ALTER FUNCTION "private"."is_own_member"("target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."is_study_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM member_roles mr
    JOIN members m ON m.id = mr.member_id
    WHERE m.auth_user_id = (SELECT auth.uid())
      AND mr.is_active
      AND mr.role IN ('admin', 'coordinador_estudios', 'coordinador_dirigentes', 'direccion')
  );
$$;


ALTER FUNCTION "private"."is_study_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."active_attendance_member_ids"("p_oldest" timestamp with time zone, "p_min_count" integer, "p_recency_since" timestamp with time zone) RETURNS TABLE("member_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.member_id
  FROM event_checkins c
  JOIN events e ON e.id = c.event_id AND e.event_type = 'charla'
  WHERE c.member_id IS NOT NULL
    AND c.checked_in_at >= p_oldest
  GROUP BY c.member_id
  HAVING count(*) >= p_min_count
     AND max(c.checked_in_at) >= p_recency_since
  ORDER BY c.member_id
$$;


ALTER FUNCTION "public"."active_attendance_member_ids"("p_oldest" timestamp with time zone, "p_min_count" integer, "p_recency_since" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_applications"("app_ids" "uuid"[]) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  rec record;
  existing_status text;
  activated integer := 0;
BEGIN
  FOR rec IN
    SELECT a.id AS app_id, a.applicant_id, v.id AS vacancy_id,
           v.position_id, COALESCE(v.slots_filled, 0) AS slots_filled
    FROM applications a
    JOIN vacancies v ON v.id = a.vacancy_id
    WHERE a.id = ANY(app_ids) AND a.status IS DISTINCT FROM 'approved'
  LOOP
    UPDATE applications SET status = 'approved', updated_at = now() WHERE id = rec.app_id;

    IF rec.position_id IS NOT NULL THEN
      SELECT status INTO existing_status
      FROM volunteers
      WHERE member_id = rec.applicant_id AND position_id = rec.position_id;

      IF existing_status IS NULL THEN
        INSERT INTO volunteers (member_id, position_id, status, start_date)
        VALUES (rec.applicant_id, rec.position_id, 'active', current_date);
        activated := activated + 1;
        UPDATE vacancies SET slots_filled = rec.slots_filled + 1 WHERE id = rec.vacancy_id;
      ELSIF existing_status <> 'active' THEN
        UPDATE volunteers SET status = 'active', end_date = NULL
        WHERE member_id = rec.applicant_id AND position_id = rec.position_id;
        activated := activated + 1;
        UPDATE vacancies SET slots_filled = rec.slots_filled + 1 WHERE id = rec.vacancy_id;
      END IF;
    END IF;
  END LOOP;

  RETURN activated;
END;
$$;


ALTER FUNCTION "public"."approve_applications"("app_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_payment"("p_payment_id" "uuid", "p_reviewer" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_concept text;
  v_enrollment uuid;
  v_event_registration uuid;
BEGIN
  UPDATE payments
  SET review_status = 'aprobado', status = 'paid',
      reviewed_by = p_reviewer, reviewed_at = now(), paid_at = now()
  WHERE id = p_payment_id AND review_status = 'en_revision' AND status = 'pending'
  RETURNING concept, enrollment_id, event_registration_id
    INTO v_concept, v_enrollment, v_event_registration;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_concept IN ('matricula', 'folletos') AND v_enrollment IS NOT NULL THEN
    UPDATE study_enrollments SET status = 'enrolled'
    WHERE id = v_enrollment AND status = 'pendiente_de_pago';
  ELSIF v_concept = 'evento' AND v_event_registration IS NOT NULL THEN
    UPDATE event_registrations SET payment_status = 'paid'
    WHERE id = v_event_registration AND payment_status = 'pending';
  END IF;
  RETURN true;
END $$;


ALTER FUNCTION "public"."approve_payment"("p_payment_id" "uuid", "p_reviewer" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_folletos_by_sede"("p_apertura" "date") RETURNS TABLE("sede" "text", "cantidad" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(sd.name, 'Sin sede') AS sede, count(*)::bigint AS cantidad
  FROM study_enrollments e
  JOIN study_groups sg ON sg.id = e.group_id
  JOIN study_plans sp ON sp.id = sg.plan_id
  LEFT JOIN members lead ON lead.id = sg.leader_id
  LEFT JOIN sedes sd ON sd.id = lead.sede_id
  WHERE sp.code <> ALL (ARRAY['N1','N2','N3','N4','DIS2','DIS3'])
    AND sg.starts_at::date BETWEEN (p_apertura - interval '14 days') AND (p_apertura + interval '75 days')
    AND e.status IN ('enrolled','pendiente_de_pago')
  GROUP BY COALESCE(sd.name, 'Sin sede')
  ORDER BY cantidad DESC;
$$;


ALTER FUNCTION "public"."block_folletos_by_sede"("p_apertura" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."campaign_student_counts"() RETURNS TABLE("grupos" bigint, "inscripciones" bigint, "unicos" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with cp as (select id from study_plans where level = 'campanas'),
  enr as (
    select se.member_id, se.status, coalesce(se.plan_id, sg.plan_id) as plan_id,
      -- null-safe: solo excluye si el inscrito ES el líder/co-líder del grupo
      (se.member_id is not distinct from sg.leader_id
        or se.member_id is not distinct from sg.co_leader_id) as is_leader
    from study_enrollments se
    left join study_groups sg on sg.id = se.group_id
  )
  select
    (select count(*) from study_groups g where g.plan_id in (select id from cp) and g.status = 'finalizado'),
    (select count(*) from enr where plan_id in (select id from cp) and status = 'completed' and not is_leader),
    (select count(distinct member_id) from enr where plan_id in (select id from cp) and status = 'completed' and not is_leader);
$$;


ALTER FUNCTION "public"."campaign_student_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."charla_sede_code"("p_title" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN t LIKE '%pro oeste%' OR t LIKE '%meridiano%' OR t LIKE '%theos home%' THEN 'meridiano'
    WHEN t LIKE '%pro este%' OR t LIKE '%antares%' THEN 'antares'
    WHEN t LIKE '%life este%' THEN 'life-este'
    WHEN t LIKE '%alajuela%' THEN 'alajuela'
    WHEN t LIKE '%cartago%' THEN 'cartago'
    WHEN t LIKE '%guapiles%' OR t LIKE '%guápiles%' THEN 'guapiles'
    WHEN t LIKE '%liberia%' THEN 'liberia'
    WHEN t LIKE '%madrid%' THEN 'madrid'
    WHEN t LIKE '%pedregal%' THEN 'pedregal'
    WHEN t LIKE '%potrero%' THEN 'potrero'
    WHEN t LIKE '%perez zeledon%' OR t LIKE '%pérez zeledón%' THEN 'perez-zeledon'
    WHEN t LIKE '%heredia%' THEN 'heredia'
    WHEN t LIKE '%united%' THEN 'united'
    ELSE NULL
  END
  FROM (SELECT lower(p_title) AS t) sub;
$$;


ALTER FUNCTION "public"."charla_sede_code"("p_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_group"("p_group_id" "uuid", "p_results" "jsonb", "p_closed_by" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r jsonb;
  v_now timestamptz := now();
BEGIN
  UPDATE study_groups SET status = 'finalizado'
  WHERE id = p_group_id AND status <> 'finalizado';
  IF NOT FOUND THEN RETURN false; END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) LOOP
    IF r->>'status_result' = 'retirado' THEN
      UPDATE study_enrollments
      SET status = 'dropped', dropped_at = v_now, drop_reason = 'Retirado en cierre'
      WHERE group_id = p_group_id AND member_id = (r->>'member_id')::uuid
        AND status = 'enrolled';
    ELSE
      UPDATE study_enrollments
      SET status = 'completed', completed_at = v_now,
          grade = NULLIF(r->>'grade', '')::numeric,
          notes = CASE
            WHEN r->>'status_result' = 'reprobado' AND coalesce(trim(r->>'fail_reason'), '') <> ''
              THEN 'reprobado: ' || trim(r->>'fail_reason')
            ELSE r->>'status_result'
          END
      WHERE group_id = p_group_id AND member_id = (r->>'member_id')::uuid
        AND status = 'enrolled';
    END IF;
  END LOOP;

  BEGIN
    INSERT INTO member_recommendations (member_id, recommended_for, justification, recommended_by, study_group_id)
    SELECT (r2->>'member_id')::uuid, k.key,
           NULLIF(trim(r2->'recommendations'->>'justification'), ''),
           p_closed_by, p_group_id
    FROM jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) r2,
         LATERAL (VALUES ('oracion'), ('servicio'), ('dirigente')) AS k(key)
    WHERE (r2->'recommendations'->>k.key)::boolean IS TRUE;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'close_group recomendaciones: %', SQLERRM;
  END;

  RETURN true;
END $$;


ALTER FUNCTION "public"."close_group"("p_group_id" "uuid", "p_results" "jsonb", "p_closed_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_refund"("p_payment_id" "uuid", "p_member_id" "uuid", "p_amount" numeric, "p_method" "text", "p_reason" "text", "p_sinpe_pending" boolean, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_pay payments%ROWTYPE;
  v_refunded numeric;
  v_id uuid;
BEGIN
  SELECT * INTO v_pay FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'not_found'); END IF;
  IF v_pay.status NOT IN ('paid', 'partial_refund') THEN
    RETURN jsonb_build_object('code', 'not_refundable', 'status', v_pay.status);
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('code', 'invalid_amount');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_refunded
  FROM refunds
  WHERE payment_id = p_payment_id AND status IN ('pending', 'processing', 'completed');
  IF p_amount + v_refunded > v_pay.amount THEN
    RETURN jsonb_build_object('code', 'exceeds', 'max', v_pay.amount - v_refunded);
  END IF;

  INSERT INTO refunds (payment_id, member_id, amount, method, reason, sinpe_pending, notes)
  VALUES (p_payment_id, coalesce(p_member_id, v_pay.member_id), p_amount, p_method, p_reason, coalesce(p_sinpe_pending, false), p_notes)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('code', 'ok', 'id', v_id);
END $$;


ALTER FUNCTION "public"."create_refund"("p_payment_id" "uuid", "p_member_id" "uuid", "p_amount" numeric, "p_method" "text", "p_reason" "text", "p_sinpe_pending" boolean, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_sums"("p_month_start" timestamp with time zone, "p_month_start_date" "date") RETURNS TABLE("income_this_month" numeric, "total_recipients" bigint, "servers_unique" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    COALESCE((SELECT SUM(amount)
              FROM public.payments
              WHERE status = 'paid' AND payment_date >= p_month_start_date), 0),
    COALESCE((SELECT SUM(total_recipients)
              FROM public.message_broadcasts
              WHERE created_at >= p_month_start), 0),
    COALESCE((SELECT COUNT(DISTINCT member_id)
              FROM public.volunteers
              WHERE status = 'active'), 0)
$$;


ALTER FUNCTION "public"."dashboard_sums"("p_month_start" timestamp with time zone, "p_month_start_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."donation_stats"() RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'unique_donors',       (SELECT count(DISTINCT member_id) FROM donations WHERE is_identified AND member_id IS NOT NULL),
    'total_this_month',    (SELECT COALESCE(sum(amount), 0) FROM donations
                              WHERE date_trunc('month', donation_date) = date_trunc('month', CURRENT_DATE)),
    'unidentified_count',  (SELECT count(*) FROM donations WHERE NOT is_identified),
    'unidentified_total',  (SELECT COALESCE(sum(amount), 0) FROM donations WHERE NOT is_identified)
  );
$$;


ALTER FUNCTION "public"."donation_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_duplicate_pairs"() RETURNS TABLE("member_a" "uuid", "member_b" "uuid", "reasons" "text"[])
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."find_duplicate_pairs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forms_detach_on_parent_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_type text := TG_ARGV[0];
BEGIN
  UPDATE public.forms
     SET entity_type = 'general', entity_id = NULL
   WHERE entity_type = v_type AND entity_id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."forms_detach_on_parent_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forms_validate_entity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.entity_id IS NOT NULL AND NEW.entity_type = 'event' THEN
    IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = NEW.entity_id) THEN
      RAISE EXCEPTION 'forms.entity_id % no existe en events (entity_type=event)', NEW.entity_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  ELSIF NEW.entity_id IS NOT NULL AND NEW.entity_type = 'study_group' THEN
    IF NOT EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = NEW.entity_id) THEN
      RAISE EXCEPTION 'forms.entity_id % no existe en study_groups (entity_type=study_group)', NEW.entity_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."forms_validate_entity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_position_role"("p_member_id" "uuid", "p_role" "text", "p_position_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO member_role_position_grants (member_id, role, position_id)
  VALUES (p_member_id, p_role, p_position_id)
  ON CONFLICT (member_id, role, position_id) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM member_roles WHERE member_id = p_member_id AND role = p_role AND is_active
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM member_roles WHERE member_id = p_member_id AND role = p_role) THEN
    UPDATE member_roles
    SET is_active = true, origen = 'automatico', revoked_at = NULL, revoked_by = NULL, granted_at = now()
    WHERE member_id = p_member_id AND role = p_role;
  ELSE
    INSERT INTO member_roles (member_id, role, origen, is_active)
    VALUES (p_member_id, p_role, 'automatico', true);
  END IF;
END;
$$;


ALTER FUNCTION "public"."grant_position_role"("p_member_id" "uuid", "p_role" "text", "p_position_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."immutable_unaccent"("text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'extensions'
    AS $_$ select unaccent('unaccent', $1) $_$;


ALTER FUNCTION "public"."immutable_unaccent"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_vacation_days_used"("p_employee_id" "uuid", "p_delta" integer) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE employees
  SET vacation_days_used = GREATEST(0, COALESCE(vacation_days_used, 0) + p_delta)
  WHERE id = p_employee_id
$$;


ALTER FUNCTION "public"."increment_vacation_days_used"("p_employee_id" "uuid", "p_delta" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    auth.uid()::uuid,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE'              THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_members"("keep_id" "uuid", "dup_id" "uuid", "soft" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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

  IF soft THEN
    UPDATE members SET is_active = false, deactivation_reason = 'merged', deactivated_at = now() WHERE id = dup_id;
  ELSE
    DELETE FROM members WHERE id = dup_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."merge_members"("keep_id" "uuid", "dup_id" "uuid", "soft" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."payment_stats"() RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'total_paid',    (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'paid'),
    'total_card',    (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'paid' AND payment_method = 'card'),
    'total_sinpe',   (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'paid' AND payment_method = 'sinpe'),
    'total_pending', (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'pending')
  );
$$;


ALTER FUNCTION "public"."payment_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_refund"("p_refund_id" "uuid", "p_status" "text", "p_processed_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ref refunds%ROWTYPE;
  v_pay payments%ROWTYPE;
  v_completed numeric;
BEGIN
  SELECT * INTO v_ref FROM refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'not_found'); END IF;

  IF NOT (
    (v_ref.status = 'pending' AND p_status IN ('processing', 'completed', 'rejected')) OR
    (v_ref.status = 'processing' AND p_status IN ('completed', 'rejected'))
  ) THEN
    RETURN jsonb_build_object('code', 'invalid_transition', 'from', v_ref.status);
  END IF;

  UPDATE refunds SET
    status = p_status,
    processed_at = CASE WHEN p_status IN ('completed', 'rejected')
                        THEN coalesce(p_processed_at, now()) ELSE processed_at END,
    notes = CASE WHEN p_note IS NOT NULL AND trim(p_note) <> ''
                 THEN nullif(concat_ws(E'\n', notes, trim(p_note)), '') ELSE notes END
  WHERE id = p_refund_id;

  IF p_status = 'completed' THEN
    SELECT * INTO v_pay FROM payments WHERE id = v_ref.payment_id FOR UPDATE;
    SELECT coalesce(sum(amount), 0) INTO v_completed
    FROM refunds WHERE payment_id = v_ref.payment_id AND status = 'completed';
    UPDATE payments
    SET status = CASE WHEN v_completed >= v_pay.amount THEN 'refunded' ELSE 'partial_refund' END
    WHERE id = v_ref.payment_id;
  END IF;

  RETURN jsonb_build_object('code', 'ok');
END $$;


ALTER FUNCTION "public"."process_refund"("p_refund_id" "uuid", "p_status" "text", "p_processed_at" timestamp with time zone, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_audit_log"() RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  delete from audit_log where created_at < now() - interval '90 days';
$$;


ALTER FUNCTION "public"."prune_audit_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_member_sede"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sede_id UUID;
  v_member_id UUID;
BEGIN
  v_member_id := NEW.member_id;

  -- Sólo recalculamos para miembros (no para invitados)
  IF v_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sede más frecuente entre check-ins del miembro a CHARLAS con sede definida
  SELECT e.sede_id INTO v_sede_id
  FROM event_checkins ec
  JOIN events e ON e.id = ec.event_id
  WHERE ec.member_id = v_member_id
    AND e.sede_id IS NOT NULL
    AND e.event_type = 'charla'
  GROUP BY e.sede_id
  ORDER BY COUNT(*) DESC, MAX(ec.checked_in_at) DESC
  LIMIT 1;

  UPDATE members SET sede_id = v_sede_id WHERE id = v_member_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."recalc_member_sede"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_donor_flags"() RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  UPDATE members m
  SET is_donor = calc.flag
  FROM (
    SELECT m2.id,
           EXISTS (
             SELECT 1 FROM donations d
             WHERE d.member_id = m2.id
               -- inicio del trimestre que está 2 trimestres atrás del actual
               AND d.donation_date >= (date_trunc('quarter', CURRENT_DATE) - INTERVAL '6 months')::date
           ) AS flag
    FROM members m2
  ) calc
  WHERE calc.id = m.id
    AND m.is_donor IS DISTINCT FROM calc.flag;
$$;


ALTER FUNCTION "public"."refresh_donor_flags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_member_sedes"() RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  WITH events_coded AS MATERIALIZED (
    SELECT e.id, charla_sede_code(e.title) AS code
    FROM events e
    WHERE e.event_type = 'charla' AND charla_sede_code(e.title) IS NOT NULL
  ),
  charla_checkins AS MATERIALIZED (
    SELECT c.member_id, ec.code, c.checked_in_at
    FROM event_checkins c
    JOIN events_coded ec ON ec.id = c.event_id
    WHERE c.member_id IS NOT NULL
  ),
  last_activity AS MATERIALIZED (
    SELECT member_id, MAX(checked_in_at) AS last_at
    FROM charla_checkins
    GROUP BY member_id
  ),
  in_window AS (
    SELECT cc.member_id, cc.code, cc.checked_in_at,
      (la.last_at >= NOW() - INTERVAL '6 months') AS is_active
    FROM charla_checkins cc
    JOIN last_activity la USING (member_id)
    WHERE
      (la.last_at >= NOW() - INTERVAL '6 months' AND cc.checked_in_at >= NOW() - INTERVAL '6 months')
      OR
      (la.last_at < NOW() - INTERVAL '6 months'
        AND cc.checked_in_at >= la.last_at - INTERVAL '6 months'
        AND cc.checked_in_at <= la.last_at)
  ),
  tallied AS (
    SELECT member_id, code, is_active, COUNT(*) AS n, MAX(checked_in_at) AS last_of_code
    FROM in_window
    GROUP BY member_id, code, is_active
  ),
  chosen AS (
    SELECT DISTINCT ON (member_id) member_id, code, is_active
    FROM tallied
    ORDER BY member_id, n DESC, last_of_code DESC
  )
  UPDATE members m
  SET sede_id = s.id,
      sede_case = CASE WHEN ch.is_active THEN 'activo' ELSE 'inactivo' END,
      sede_last_checkin = la.last_at
  FROM chosen ch
  JOIN sedes s ON s.code = ch.code
  JOIN last_activity la ON la.member_id = ch.member_id
  WHERE m.id = ch.member_id
    AND (m.sede_id IS DISTINCT FROM s.id
      OR m.sede_case IS DISTINCT FROM (CASE WHEN ch.is_active THEN 'activo' ELSE 'inactivo' END)
      OR m.sede_last_checkin IS DISTINCT FROM la.last_at);

  UPDATE members m
  SET sede_id = NULL, sede_case = NULL, sede_last_checkin = NULL
  WHERE (m.sede_id IS NOT NULL OR m.sede_case IS NOT NULL OR m.sede_last_checkin IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM event_checkins c
      JOIN events e ON e.id = c.event_id
      WHERE e.event_type = 'charla' AND c.member_id = m.id AND charla_sede_code(e.title) IS NOT NULL
    );
$$;


ALTER FUNCTION "public"."refresh_member_sedes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_for_event"("p_event_id" "uuid", "p_member_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_max_capacity int;
  v_occupied int;
  v_registration_id uuid;
BEGIN
  SELECT max_capacity INTO v_max_capacity FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'event_not_found'); END IF;

  IF v_max_capacity IS NOT NULL AND v_max_capacity > 0 THEN
    SELECT count(*) INTO v_occupied FROM event_registrations
    WHERE event_id = p_event_id AND payment_status IN ('pending','paid','exempted');
    IF v_occupied >= v_max_capacity THEN RETURN jsonb_build_object('code', 'event_full'); END IF;
  END IF;

  INSERT INTO event_registrations (event_id, member_id, payment_status)
  VALUES (p_event_id, p_member_id, 'pending')
  ON CONFLICT (event_id, member_id) DO NOTHING
  RETURNING id INTO v_registration_id;
  IF v_registration_id IS NULL THEN RETURN jsonb_build_object('code', 'already_registered'); END IF;

  RETURN jsonb_build_object('code', 'ok', 'id', v_registration_id);
END $$;


ALTER FUNCTION "public"."register_for_event"("p_event_id" "uuid", "p_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_charla_attendance"() RETURNS TABLE("yr" integer, "title" "text", "wk" integer, "mo" integer, "checkins" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select extract(year  from e.starts_at)::int  as yr,
         coalesce(se.name, e.title)             as title,
         extract(week  from e.starts_at)::int  as wk,
         extract(month from e.starts_at)::int  as mo,
         count(ec.id)::bigint                    as checkins
  from events e
  join event_checkins ec on ec.event_id = e.id
  left join sub_events se on se.id = ec.sub_event_id
  where e.event_type = 'charla'
    and e.starts_at is not null
  group by 1, 2, 3, 4
$$;


ALTER FUNCTION "public"."report_charla_attendance"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."report_charla_attendance"() IS 'Agregado de check-ins de charla por (año, título, semana ISO, mes) para el reporte de Control de Asistencia. La sede se deriva del título en la app (sedes-canonical).';



CREATE OR REPLACE FUNCTION "public"."report_member_growth"() RETURNS TABLE("created_yr" integer, "created_mo" integer, "title" "text", "new_members" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with member_sede as (
    select ec.member_id,
           coalesce(se.name, e.title) as title,
           row_number() over (
             partition by ec.member_id
             order by count(*) desc, coalesce(se.name, e.title)
           ) as rn
    from event_checkins ec
    join events e on e.id = ec.event_id and e.event_type = 'charla'
    left join sub_events se on se.id = ec.sub_event_id
    where ec.member_id is not null
    group by ec.member_id, coalesce(se.name, e.title)
  )
  select extract(year  from m.created_at)::int as created_yr,
         extract(month from m.created_at)::int as created_mo,
         ms.title                               as title,
         count(*)::bigint                        as new_members
  from members m
  left join member_sede ms on ms.member_id = m.id and ms.rn = 1
  where m.created_at is not null
  group by 1, 2, 3
$$;


ALTER FUNCTION "public"."report_member_growth"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."report_member_growth"() IS 'Crecimiento bruto: personas nuevas por (año/mes de registro, sede dominante por asistencia) para el reporte de Crecimiento. "Nuevo"=members.created_at; sede=modo de su asistencia a charlas (NULL si no asistió). Sede canónica resuelta en la app.';



CREATE OR REPLACE FUNCTION "public"."revoke_position_role"("p_member_id" "uuid", "p_role" "text", "p_position_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  remaining int;
  current_origen text;
BEGIN
  DELETE FROM member_role_position_grants
  WHERE member_id = p_member_id AND role = p_role AND position_id = p_position_id;

  SELECT count(*) INTO remaining FROM member_role_position_grants
  WHERE member_id = p_member_id AND role = p_role;
  IF remaining > 0 THEN RETURN; END IF;

  SELECT origen INTO current_origen FROM member_roles
  WHERE member_id = p_member_id AND role = p_role AND is_active;
  IF current_origen IS DISTINCT FROM 'automatico' THEN
    RETURN;
  END IF;

  UPDATE member_roles SET is_active = false, revoked_at = now()
  WHERE member_id = p_member_id AND role = p_role AND is_active;
END;
$$;


ALTER FUNCTION "public"."revoke_position_role"("p_member_id" "uuid", "p_role" "text", "p_position_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_donor_on_donation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.member_id IS NOT NULL
     AND NEW.donation_date >= (date_trunc('quarter', CURRENT_DATE) - INTERVAL '6 months')::date THEN
    UPDATE members SET is_donor = TRUE
    WHERE id = NEW.member_id AND is_donor IS DISTINCT FROM TRUE;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_donor_on_donation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."study_dashboard_stats"() RETURNS TABLE("estado" "text", "categoria" "text", "grupos" bigint, "estudiantes" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    g.status::text AS estado,
    CASE
      WHEN p.level = 'niveles' THEN 'niveles'
      WHEN p.level IN ('etapa_inicial', 'etapa_intermedia') THEN 'capacitaciones'
      ELSE 'otros'
    END AS categoria,
    count(DISTINCT g.id) AS grupos,
    count(e.member_id) FILTER (
      WHERE (g.status = 'en_curso'   AND e.status = 'enrolled')
         OR (g.status = 'finalizado' AND e.status = 'completed')
    ) AS estudiantes
  FROM study_groups g
  JOIN study_plans p ON p.id = g.plan_id
  LEFT JOIN study_enrollments e ON e.group_id = g.id
  WHERE g.status IN ('en_curso', 'finalizado')
  GROUP BY 1, 2;
$$;


ALTER FUNCTION "public"."study_dashboard_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."study_dashboard_stats_v2"() RETURNS TABLE("estado" "text", "categoria" "text", "grupos" bigint, "inscripciones" bigint, "unicos" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with rows as (
    select
      g.status::text as estado,
      case
        when p.level = 'niveles' then 'niveles'
        when p.level in ('etapa_inicial','etapa_intermedia') then 'capacitaciones'
        else 'otros'
      end as categoria,
      g.id as group_id,
      e.member_id,
      (e.member_id = g.leader_id or e.member_id = g.co_leader_id) as is_leader
    from study_groups g
    join study_plans p on p.id = g.plan_id
    left join study_enrollments e on e.group_id = g.id
      and ((g.status = 'en_curso' and e.status = 'enrolled')
        or (g.status = 'finalizado' and e.status = 'completed'))
    where g.status in ('en_curso','finalizado')
  )
  select estado, categoria,
    count(distinct group_id) as grupos,
    count(member_id) filter (where not coalesce(is_leader, false)) as inscripciones,
    count(distinct member_id) filter (where not coalesce(is_leader, false)) as unicos
  from rows
  group by 1, 2;
$$;


ALTER FUNCTION "public"."study_dashboard_stats_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_form_response"("p_form_id" "uuid", "p_member_id" "uuid", "p_guest_name" "text", "p_guest_email" "text", "p_answers" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_response_id uuid;
  k text;
  v jsonb;
BEGIN
  INSERT INTO form_responses (form_id, member_id, guest_name, guest_email)
  VALUES (p_form_id, p_member_id, p_guest_name, p_guest_email)
  RETURNING id INTO v_response_id;

  FOR k, v IN SELECT key, value FROM jsonb_each(coalesce(p_answers, '{}'::jsonb)) LOOP
    INSERT INTO form_response_values (response_id, field_id, value_text, value_json)
    VALUES (
      v_response_id,
      k::uuid,
      CASE WHEN jsonb_typeof(v) = 'string' THEN v #>> '{}' ELSE NULL END,
      CASE WHEN jsonb_typeof(v) <> 'string' THEN v ELSE NULL END
    );
  END LOOP;

  RETURN v_response_id;
END $$;


ALTER FUNCTION "public"."submit_form_response"("p_form_id" "uuid", "p_member_id" "uuid", "p_guest_name" "text", "p_guest_email" "text", "p_answers" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_member_account_confirmed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  update public.members
  set account_confirmed_at = new.email_confirmed_at
  where auth_user_id = new.id
    and account_confirmed_at is distinct from new.email_confirmed_at;
  return new;
end $$;


ALTER FUNCTION "public"."sync_member_account_confirmed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_member_account_confirmed_on_link"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  if new.auth_user_id is not null and (old.auth_user_id is distinct from new.auth_user_id) then
    update public.members
    set account_confirmed_at = u.email_confirmed_at
    from auth.users u
    where u.id = new.auth_user_id and members.id = new.id
      and members.account_confirmed_at is distinct from u.email_confirmed_at;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."sync_member_account_confirmed_on_link"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "vacancy_id" "uuid" NOT NULL,
    "applicant_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "assigned_to" "uuid",
    CONSTRAINT "applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewing'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."areas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "area_type" "text" NOT NULL,
    "parent_id" "uuid",
    "leader_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ideal_capacity" integer,
    CONSTRAINT "areas_area_type_check" CHECK (("area_type" = ANY (ARRAY['area'::"text", 'committee'::"text"])))
);


ALTER TABLE "public"."areas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "ip_address" "inet",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "audit_log_action_check" CHECK (("action" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text", 'EXPORT'::"text", 'APPROVE'::"text", 'REJECT'::"text", 'MERGE'::"text", 'ROLE_CHANGE'::"text", 'DEACTIVATE'::"text"])))
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."capacitacion_bloques" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nombre" "text" NOT NULL,
    "anio" integer NOT NULL,
    "fecha_apertura" "date" NOT NULL,
    "fecha_cierre_matricula" "date" NOT NULL,
    "estado" "text" DEFAULT 'en_apertura'::"text" NOT NULL,
    "preliminar_sent_at" timestamp with time zone,
    "confirmacion_sent_at" timestamp with time zone,
    "final_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "capacitacion_bloques_estado_check" CHECK (("estado" = ANY (ARRAY['en_apertura'::"text", 'activo'::"text", 'archivado'::"text"])))
);


ALTER TABLE "public"."capacitacion_bloques" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_configs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "smtp_host" "text",
    "smtp_port" integer,
    "smtp_user" "text",
    "smtp_from_name" "text",
    "smtp_from_email" "text",
    "wa_account_id" "text",
    "wa_phone_number" "text",
    "is_active" boolean DEFAULT true,
    "is_verified" boolean DEFAULT false,
    "last_verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "channel_configs_type_check" CHECK (("type" = ANY (ARRAY['smtp'::"text", 'whatsapp'::"text"])))
);


ALTER TABLE "public"."channel_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."committee_goals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "committee_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "committee_goals_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."committee_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."donations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "member_id" "uuid",
    "family_unit_id" "uuid",
    "donation_date" "date" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "source_file" "text",
    "is_identified" boolean DEFAULT false,
    "imported_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "donations_amount_nonneg" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."donations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."duplicate_dismissals" (
    "member_a" "uuid" NOT NULL,
    "member_b" "uuid" NOT NULL,
    "dismissed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."duplicate_dismissals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "doc_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "file_url" "text",
    "expires_at" "date",
    "notes" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_documents_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['contrato'::"text", 'cedula'::"text", 'titulo'::"text", 'certificado'::"text", 'evaluacion'::"text", 'permiso'::"text", 'otro'::"text", 'identificacion'::"text", 'seguro_social'::"text"])))
);


ALTER TABLE "public"."employee_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "member_id" "uuid",
    "employee_code" "text",
    "position" "text" NOT NULL,
    "department" "text",
    "employment_type" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "salary" numeric(12,2),
    "salary_currency" "text" DEFAULT 'CRC'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "termination_reason" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "contract_type" "text",
    "position_id" "uuid",
    "vacation_days_total" integer DEFAULT 0,
    "vacation_days_used" integer DEFAULT 0,
    CONSTRAINT "employees_contract_type_check" CHECK (("contract_type" = ANY (ARRAY['planilla'::"text", 'servicios_profesionales'::"text"]))),
    CONSTRAINT "employees_employment_type_check" CHECK (("employment_type" = ANY (ARRAY['full_time'::"text", 'part_time'::"text", 'contractor'::"text", 'volunteer_paid'::"text"]))),
    CONSTRAINT "employees_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'on_leave'::"text", 'terminated'::"text"])))
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_checkins" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "member_id" "uuid",
    "guest_name" "text",
    "checked_in_at" timestamp with time zone DEFAULT "now"(),
    "checked_in_by" "uuid",
    "method" "text" DEFAULT 'manual'::"text",
    "notes" "text",
    "sub_event_id" "uuid",
    CONSTRAINT "checkin_member_or_guest" CHECK ((("member_id" IS NOT NULL) OR ("guest_name" IS NOT NULL))),
    CONSTRAINT "event_checkins_method_check" CHECK (("method" = ANY (ARRAY['manual'::"text", 'qr'::"text", 'smart_link'::"text"])))
);


ALTER TABLE "public"."event_checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_event_id" "uuid" NOT NULL,
    "exception_date" "date" NOT NULL,
    "override_event_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_exceptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."event_exceptions" IS 'Excepciones de series recurrentes (modelo iCalendar EXDATE/override). Una fila por ocurrencia exceptuada. override_event_id null = ocurrencia cancelada; con valor = evento puntual con cambios.';



CREATE TABLE IF NOT EXISTS "public"."event_organizing_committees" (
    "event_id" "uuid" NOT NULL,
    "committee_id" "uuid" NOT NULL
);


ALTER TABLE "public"."event_organizing_committees" OWNER TO "postgres";


COMMENT ON TABLE "public"."event_organizing_committees" IS 'Comités organizadores de un evento (m2m). Reemplaza events.committee_id único.';



CREATE TABLE IF NOT EXISTS "public"."event_registrations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "registered_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_registrations_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'exempted'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."event_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_types" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#161440'::"text" NOT NULL,
    "icon" "text" DEFAULT 'calendar'::"text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_volunteers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "role" "text",
    "status" "text" DEFAULT 'confirmed'::"text",
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_volunteers_status_check" CHECK (("status" = ANY (ARRAY['confirmed'::"text", 'pending'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."event_volunteers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "event_type" "text" NOT NULL,
    "location" "text",
    "location_url" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone,
    "is_recurring" boolean DEFAULT false,
    "recurrence_rule" "text",
    "parent_event_id" "uuid",
    "max_capacity" integer,
    "requires_checkin" boolean DEFAULT false,
    "flyer_url" "text",
    "is_public" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sede_id" "uuid",
    "is_virtual" boolean DEFAULT false,
    "requires_registration" boolean DEFAULT false,
    "requires_payment" boolean DEFAULT false,
    "payment_amount" numeric(12,2),
    "requires_survey" boolean DEFAULT false,
    "status" "text" DEFAULT 'upcoming'::"text",
    "recurrence_end" timestamp with time zone,
    "cancellation_reason" "text",
    "virtual_url" "text",
    "server_price" numeric,
    "servers_pay" boolean DEFAULT true NOT NULL,
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['upcoming'::"text", 'in_progress'::"text", 'finished'::"text", 'cancelled'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."virtual_url" IS 'Link opcional a la reunión virtual (Zoom/Meet) cuando is_virtual = true.';



COMMENT ON COLUMN "public"."events"."server_price" IS 'Precio para servidores activos de los comités organizadores. NULL = mismo que payment_amount.';



COMMENT ON COLUMN "public"."events"."servers_pay" IS 'FALSE = los servidores del comité organizador quedan exentos de pago.';



CREATE TABLE IF NOT EXISTS "public"."family_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_unit_id" "uuid",
    "member_id" "uuid",
    "relation" "text" NOT NULL,
    "linked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."family_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."family_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_request_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "changed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."finance_request_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "study_group_id" "uuid",
    "payment_id" "uuid",
    "amount" numeric(12,2),
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "entity_type" "text",
    "plan_id" "uuid",
    "event_id" "uuid",
    CONSTRAINT "finance_requests_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['study_plan'::"text", 'event'::"text"]))),
    CONSTRAINT "finance_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['scholarship'::"text", 'refund'::"text"]))),
    CONSTRAINT "finance_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_review'::"text", 'resolved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."finance_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."folleto_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "source_group_id" "uuid",
    "source_plan_code" "text",
    "target_level_code" "text",
    "quantity" integer DEFAULT 0 NOT NULL,
    "sede" "text",
    "close_date" "date" NOT NULL,
    "available_at" "date" NOT NULL,
    "status" "text" DEFAULT 'creada'::"text" NOT NULL,
    "confirmed_by" "uuid",
    "confirmed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo" "text" DEFAULT 'cierre'::"text" NOT NULL,
    "bloque_id" "uuid",
    CONSTRAINT "folleto_requests_status_check" CHECK (("status" = ANY (ARRAY['creada'::"text", 'en_impresion'::"text", 'enviado_entregado'::"text", 'cerrada'::"text"]))),
    CONSTRAINT "folleto_requests_tipo_check" CHECK (("tipo" = ANY (ARRAY['cierre'::"text", 'preapertura_preliminar'::"text", 'preapertura_confirmacion'::"text", 'preapertura_final'::"text", 'reubicacion'::"text"])))
);


ALTER TABLE "public"."folleto_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_fields" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "field_type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "placeholder" "text",
    "help_text" "text",
    "is_required" boolean DEFAULT false,
    "options" "jsonb",
    "conditions" "jsonb",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "scale_min" integer,
    "scale_max" integer,
    "scale_min_label" "text",
    "scale_max_label" "text",
    CONSTRAINT "form_fields_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'textarea'::"text", 'number'::"text", 'email'::"text", 'phone'::"text", 'date'::"text", 'select'::"text", 'multiselect'::"text", 'checkbox'::"text", 'radio'::"text", 'scale'::"text", 'file'::"text", 'personal_data'::"text", 'section_header'::"text", 'yes_no'::"text", 'section'::"text", 'page_break'::"text"])))
);


ALTER TABLE "public"."form_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_response_values" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "response_id" "uuid" NOT NULL,
    "field_id" "uuid" NOT NULL,
    "value_text" "text",
    "value_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."form_response_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_responses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "member_id" "uuid",
    "guest_email" "text",
    "guest_name" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "ip_address" "inet",
    CONSTRAINT "response_member_or_guest" CHECK ((("member_id" IS NOT NULL) OR ("guest_email" IS NOT NULL)))
);


ALTER TABLE "public"."form_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forms" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "slug" "text",
    "is_public" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "requires_auth" boolean DEFAULT true,
    "allow_multiple_responses" boolean DEFAULT false,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text",
    "entity_type" "text",
    "entity_id" "uuid",
    CONSTRAINT "forms_category_check" CHECK (("category" = ANY (ARRAY['event_registration'::"text", 'study_registration'::"text", 'survey'::"text", 'registration'::"text", 'other'::"text"]))),
    CONSTRAINT "forms_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['event'::"text", 'study_group'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."forms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_batches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "filename" "text" NOT NULL,
    "total_rows" integer DEFAULT 0,
    "identified" integer DEFAULT 0,
    "unidentified" integer DEFAULT 0,
    "duplicates" integer DEFAULT 0,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "imported_by" "uuid",
    "imported_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "import_batches_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'partial'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_member_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "link" "text",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."internal_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leader_evaluations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "leader_id" "uuid" NOT NULL,
    "group_id" "uuid",
    "score" numeric(4,2) NOT NULL,
    "evaluation_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "comments" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."leader_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_admin_data" (
    "member_id" "uuid" NOT NULL,
    "not_recommended_to_lead_studies" boolean DEFAULT false NOT NULL,
    "not_recommended_to_lead_studies_by" "uuid",
    "not_recommended_to_lead_studies_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "authorized_virtual_studies" boolean DEFAULT false NOT NULL,
    "authorized_virtual_studies_by" "uuid",
    "authorized_virtual_studies_at" timestamp with time zone
);


ALTER TABLE "public"."member_admin_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "filters" "jsonb",
    "segment_label" "text",
    "member_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "member_count" integer DEFAULT 0 NOT NULL,
    "is_dynamic" boolean DEFAULT false NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_by" "uuid",
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."member_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_notification_prefs" (
    "member_id" "uuid" NOT NULL,
    "recordatorios_eventos" boolean DEFAULT true NOT NULL,
    "grupo_estudio" boolean DEFAULT true NOT NULL,
    "mensajes_sistema" boolean DEFAULT true NOT NULL,
    "canal_preferido" "text" DEFAULT 'email'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "member_notification_prefs_canal_preferido_check" CHECK (("canal_preferido" = ANY (ARRAY['email'::"text", 'whatsapp'::"text", 'ambos'::"text"])))
);


ALTER TABLE "public"."member_notification_prefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_recommendations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "recommended_for" "text" NOT NULL,
    "justification" "text",
    "recommended_by" "uuid",
    "study_group_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "member_recommendations_recommended_for_check" CHECK (("recommended_for" = ANY (ARRAY['oracion'::"text", 'servicio'::"text", 'dirigente'::"text"])))
);


ALTER TABLE "public"."member_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_role_position_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "position_id" "uuid" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."member_role_position_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid",
    "role" "text" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "status_detail" "text",
    "origen" "text" DEFAULT 'manual'::"text" NOT NULL,
    CONSTRAINT "chk_dirigente_status_detail" CHECK ((("role" <> 'dirigente'::"text") OR ("status_detail" IS NULL) OR ("status_detail" = ANY (ARRAY['activo'::"text", 'en_descanso'::"text", 'disponible'::"text"])))),
    CONSTRAINT "member_roles_origen_check" CHECK (("origen" = ANY (ARRAY['manual'::"text", 'automatico'::"text"]))),
    CONSTRAINT "member_roles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'direccion'::"text", 'finanzas'::"text", 'encargado_staff'::"text", 'coordinador_servidores'::"text", 'coordinador_estudios'::"text", 'coordinador_dirigentes'::"text", 'encargado_eventos'::"text", 'lider_comite'::"text", 'comunicaciones'::"text", 'dirigente'::"text", 'editor_perfiles'::"text", 'miembro'::"text", 'solo_lectura'::"text", 'reportes'::"text"])))
);


ALTER TABLE "public"."member_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_spiritual_data" (
    "member_id" "uuid" NOT NULL,
    "baptism_date" "date",
    "baptism_place" "text",
    "spiritual_gifts" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."member_spiritual_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cedula" "text",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "birth_date" "date",
    "gender" "text",
    "marital_status" "text",
    "phone" "text",
    "email" "text",
    "province" "text",
    "canton" "text",
    "district" "text",
    "address" "text",
    "occupation" "text",
    "workplace" "text",
    "allergies" "text",
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "photo_url" "text",
    "smart_link_token" "text" DEFAULT ("gen_random_uuid"())::"text",
    "wallet_pass_id" "text",
    "is_donor" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "deactivation_reason" "text",
    "deactivated_at" timestamp with time zone,
    "deactivated_by" "uuid",
    "auth_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sede_id" "uuid",
    "medications" "text",
    "external_id" "text",
    "field_updated_at" "jsonb" DEFAULT '{}'::"jsonb",
    "cedula_normalized" "text" GENERATED ALWAYS AS ("regexp_replace"("cedula", '[-\s]'::"text", ''::"text", 'g'::"text")) STORED,
    "search_text" "text" GENERATED ALWAYS AS ("lower"("public"."immutable_unaccent"(((((((((COALESCE("first_name", ''::"text") || ' '::"text") || COALESCE("last_name", ''::"text")) || ' '::"text") || COALESCE("cedula", ''::"text")) || ' '::"text") || COALESCE("email", ''::"text")) || ' '::"text") || COALESCE("phone", ''::"text"))))) STORED,
    "email_bounced" boolean DEFAULT false,
    "email_bounced_at" timestamp with time zone,
    "email_complained" boolean DEFAULT false,
    "email_complained_at" timestamp with time zone,
    "newsletter_opt_out" boolean DEFAULT false,
    "newsletter_opt_out_at" timestamp with time zone,
    "unsubscribe_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_confirmed_at" timestamp with time zone,
    "cedula_dup_legacy" boolean DEFAULT false NOT NULL,
    "sede_case" "text",
    "sede_last_checkin" timestamp with time zone,
    CONSTRAINT "members_gender_check" CHECK (("gender" = ANY (ARRAY['M'::"text", 'F'::"text", 'otro'::"text"]))),
    CONSTRAINT "members_sede_case_check" CHECK (("sede_case" = ANY (ARRAY['activo'::"text", 'inactivo'::"text"])))
);


ALTER TABLE "public"."members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."members"."account_confirmed_at" IS 'Espejo de auth.users.email_confirmed_at (sincronizado por trigger). NULL = cuenta sin activar o sin cuenta.';



COMMENT ON COLUMN "public"."members"."cedula_dup_legacy" IS 'Duplicado histórico de cédula anterior a la migración 114: excluido del índice único. Fusionar y limpiar.';



CREATE TABLE IF NOT EXISTS "public"."message_broadcasts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "template_id" "uuid",
    "channel" "text" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    "recipient_filter" "jsonb",
    "total_recipients" integer DEFAULT 0,
    "sent_count" integer DEFAULT 0,
    "failed_count" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "scheduled_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "segment_label" "text",
    "smtp_config_id" "uuid",
    "whatsapp_config_id" "uuid",
    "kind" "text" DEFAULT 'marketing'::"text" NOT NULL,
    "skipped_count" integer DEFAULT 0,
    "body_format" "text" DEFAULT 'html'::"text" NOT NULL,
    CONSTRAINT "message_broadcasts_body_format_check" CHECK (("body_format" = ANY (ARRAY['text'::"text", 'html'::"text"]))),
    CONSTRAINT "message_broadcasts_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'both'::"text", 'interna'::"text"]))),
    CONSTRAINT "message_broadcasts_kind_check" CHECK (("kind" = ANY (ARRAY['marketing'::"text", 'transactional'::"text"]))),
    CONSTRAINT "message_broadcasts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sending'::"text", 'sent'::"text", 'failed'::"text", 'partial'::"text"])))
);


ALTER TABLE "public"."message_broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "broadcast_id" "uuid",
    "member_id" "uuid",
    "channel" "text" NOT NULL,
    "recipient" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "scheduled_date" "date" DEFAULT CURRENT_DATE,
    "attempts" integer DEFAULT 0,
    "last_error" "text",
    "claimed_at" timestamp with time zone,
    CONSTRAINT "message_logs_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'interna'::"text"]))),
    CONSTRAINT "message_logs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sending'::"text", 'sent'::"text", 'delivered'::"text", 'failed'::"text", 'bounced'::"text", 'complained'::"text"])))
);


ALTER TABLE "public"."message_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    "variables" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text",
    "body_format" "text" DEFAULT 'html'::"text" NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "system_key" "text",
    "available_variables" "jsonb",
    CONSTRAINT "message_templates_body_format_check" CHECK (("body_format" = ANY (ARRAY['text'::"text", 'html'::"text"]))),
    CONSTRAINT "message_templates_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."message_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."paid_positions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "committee_id" "uuid",
    "description" "text",
    "contract_type" "text",
    "salary_min" numeric(12,2),
    "salary_max" numeric(12,2),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "paid_positions_contract_type_check" CHECK (("contract_type" = ANY (ARRAY['planilla'::"text", 'servicios_profesionales'::"text"])))
);


ALTER TABLE "public"."paid_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "type" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_donation" boolean DEFAULT false,
    CONSTRAINT "payment_categories_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."payment_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "member_id" "uuid",
    "category_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'CRC'::"text",
    "payment_method" "text",
    "reference_code" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "description" "text",
    "study_group_id" "uuid",
    "event_id" "uuid",
    "scholarship" boolean DEFAULT false,
    "scholarship_reason" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "entity_type" "text",
    "gateway_ref" "text",
    "sinpe_confirmation" "text",
    "scholarship_id" "uuid",
    "paid_at" timestamp with time zone,
    "concept" "text",
    "enrollment_id" "uuid",
    "folleto_request_id" "uuid",
    "receipt_path" "text",
    "review_status" "text",
    "rejection_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "event_registration_id" "uuid",
    CONSTRAINT "payments_amount_nonneg" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payments_concept_check" CHECK ((("concept" IS NULL) OR ("concept" = ANY (ARRAY['matricula'::"text", 'folletos'::"text", 'evento'::"text"])))),
    CONSTRAINT "payments_currency_check" CHECK (("currency" = ANY (ARRAY['CRC'::"text", 'USD'::"text"]))),
    CONSTRAINT "payments_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['event'::"text", 'study_group'::"text"]))),
    CONSTRAINT "payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['card'::"text", 'sinpe'::"text", 'scholarship'::"text", 'cash'::"text", 'comprobante'::"text", 'tilopay'::"text"]))),
    CONSTRAINT "payments_review_status_check" CHECK ((("review_status" IS NULL) OR ("review_status" = ANY (ARRAY['en_revision'::"text", 'aprobado'::"text", 'rechazado'::"text"])))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['paid'::"text", 'pending'::"text", 'refunded'::"text", 'partial_refund'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."position_records" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "position_name" "text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "contract_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "position_records_contract_type_check" CHECK (("contract_type" = ANY (ARRAY['planilla'::"text", 'servicios_profesionales'::"text"])))
);


ALTER TABLE "public"."position_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."position_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "committee_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "functions" "text",
    "profile" "text",
    "study_requirement" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_by" "uuid",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_position_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "position_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."position_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refunds" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "member_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "method" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reason" "text",
    "sinpe_pending" boolean DEFAULT false,
    "notes" "text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "processed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "refunds_amount_nonneg" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "refunds_method_check" CHECK (("method" = ANY (ARRAY['card'::"text", 'sinpe'::"text", 'scholarship'::"text", 'cash'::"text", 'comprobante'::"text"]))),
    CONSTRAINT "refunds_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_changes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "change_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "previous_salary" numeric(12,2),
    "new_salary" numeric(12,2) NOT NULL,
    "reason" "text",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."salary_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scholarship_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scholarship_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "enrollment_id" "uuid",
    "event_registration_id" "uuid",
    "final_amount" numeric(12,2) NOT NULL,
    "redeemed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."scholarship_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scholarships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "member_id" "uuid",
    "amount" numeric(12,2),
    "reason" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "entity_type" "text",
    "event_id" "uuid",
    "discount_type" "text",
    "discount_value" numeric(12,2),
    "original_amount" numeric(12,2),
    "final_amount" numeric(12,2),
    "is_used" boolean DEFAULT false,
    "used_at" timestamp with time zone,
    "created_by" "uuid",
    "plan_id" "uuid",
    "kind" "text" DEFAULT 'asignada'::"text" NOT NULL,
    "code" "text",
    "expires_at" timestamp with time zone,
    "approval_type" "text",
    "request_id" "uuid",
    CONSTRAINT "scholarships_approval_type_check" CHECK (("approval_type" = ANY (ARRAY['total'::"text", 'parcial'::"text"]))),
    CONSTRAINT "scholarships_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"]))),
    CONSTRAINT "scholarships_entity_target_check" CHECK (((("entity_type" = 'study_plan'::"text") AND ("plan_id" IS NOT NULL) AND ("event_id" IS NULL)) OR (("entity_type" = 'event'::"text") AND ("event_id" IS NOT NULL) AND ("plan_id" IS NULL)))),
    CONSTRAINT "scholarships_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['study_plan'::"text", 'event'::"text"]))),
    CONSTRAINT "scholarships_final_nonneg" CHECK (("final_amount" >= (0)::numeric)),
    CONSTRAINT "scholarships_kind_check" CHECK (("kind" = ANY (ARRAY['asignada'::"text", 'generica'::"text"]))),
    CONSTRAINT "scholarships_kind_shape_check" CHECK (((("kind" = 'asignada'::"text") AND ("member_id" IS NOT NULL) AND ("code" IS NULL)) OR (("kind" = 'generica'::"text") AND ("member_id" IS NULL) AND ("code" IS NOT NULL)))),
    CONSTRAINT "scholarships_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'used'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."scholarships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sedes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "day" "text",
    "time" "text",
    "location" "text",
    "age_group" "text",
    "waze_url" "text",
    "is_historical" boolean DEFAULT false
);


ALTER TABLE "public"."sedes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_positions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "area_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "requirements" "text",
    "max_volunteers" integer DEFAULT 1,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "location" "text",
    "quantity" integer DEFAULT 1,
    "study_requirement" "text",
    "functions" "text",
    "profile" "text",
    "expires_at" "date",
    "is_featured" boolean DEFAULT false,
    "base_area_id" "uuid"
);


ALTER TABLE "public"."service_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_attendance" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "present" boolean DEFAULT true,
    "notes" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."study_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_enrollments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "group_id" "uuid",
    "member_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'enrolled'::"text",
    "enrolled_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "dropped_at" timestamp with time zone,
    "drop_reason" "text",
    "transferred_to" "uuid",
    "grade" numeric(4,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "plan_id" "uuid",
    CONSTRAINT "study_enrollments_status_check" CHECK (("status" = ANY (ARRAY['enrolled'::"text", 'waitlist'::"text", 'completed'::"text", 'dropped'::"text", 'transferred'::"text", 'pendiente_de_pago'::"text", 'expirada'::"text", 'reprobado'::"text"])))
);


ALTER TABLE "public"."study_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_groups" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "leader_id" "uuid",
    "sede" "text",
    "starts_at" "date",
    "ends_at" "date",
    "status" "text" DEFAULT 'en_matricula'::"text",
    "max_students" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "zone" "text",
    "schedule_days" "text"[],
    "schedule_time" "text",
    "location" "text",
    "current_week" integer DEFAULT 0,
    "whatsapp_group_url" "text",
    "co_leader_id" "uuid",
    "is_leader_training" boolean DEFAULT false,
    "training_modality" "text",
    "start_notified_at" timestamp with time zone,
    "age_min" integer,
    "age_max" integer,
    "is_virtual" boolean DEFAULT false NOT NULL,
    CONSTRAINT "study_groups_status_check" CHECK (("status" = ANY (ARRAY['en_matricula'::"text", 'en_curso'::"text", 'finalizado'::"text"])))
);


ALTER TABLE "public"."study_groups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."study_groups"."start_notified_at" IS 'Cuándo se envió el recordatorio inicio_capacitacion a los estudiantes (dedupe del cron de recordatorios).';



CREATE TABLE IF NOT EXISTS "public"."study_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "invited_by" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "study_invitations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'revoked'::"text", 'used'::"text"])))
);


ALTER TABLE "public"."study_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."study_invitations" IS 'Invitaciones a estudios invitation_only (study_plans.requires_invitation=true). status active|revoked|used. Una persona puede ser invitada a un plan; al matricularse pasa a used.';



CREATE TABLE IF NOT EXISTS "public"."study_leaders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "zone_preference" "text"[] DEFAULT '{}'::"text"[],
    "availability_status" "text" DEFAULT 'available'::"text",
    "is_active" boolean DEFAULT true,
    "qualified_study_codes" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "formation_study_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "study_leaders_availability_status_check" CHECK (("availability_status" = ANY (ARRAY['available'::"text", 'assigned'::"text", 'resting'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."study_leaders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "level" "text" NOT NULL,
    "cost" numeric(10,2) DEFAULT 0,
    "requires_donor" boolean DEFAULT false,
    "requires_attendance" boolean DEFAULT false,
    "min_attendance_pct" integer DEFAULT 0,
    "mentor_id" "uuid",
    "max_students" integer,
    "duration_weeks" integer,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "code" "text",
    "requires_payment" boolean DEFAULT false,
    "requires_grade" boolean DEFAULT false,
    "auto_promote" boolean DEFAULT false,
    "requires_server" boolean DEFAULT false,
    "prerequisite_code" "text",
    "next_study_code" "text",
    "difficulty" "text",
    "commitments" "text",
    "requires_invitation" boolean DEFAULT false NOT NULL,
    "is_curricular" boolean DEFAULT true NOT NULL,
    "requires_bus_talk" boolean DEFAULT false NOT NULL,
    CONSTRAINT "study_plans_cost_nonneg" CHECK (("cost" >= (0)::numeric)),
    CONSTRAINT "study_plans_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['Básico'::"text", 'Intermedio'::"text", 'Avanzado'::"text"]))),
    CONSTRAINT "study_plans_level_check" CHECK (("level" = ANY (ARRAY['niveles'::"text", 'etapa_inicial'::"text", 'etapa_intermedia'::"text", 'campanas'::"text", 'externa'::"text"])))
);


ALTER TABLE "public"."study_plans" OWNER TO "postgres";


COMMENT ON COLUMN "public"."study_plans"."requires_bus_talk" IS 'Compromiso: haber asistido a la charla del Bus (se muestra con ícono de bus + tooltip).';



CREATE TABLE IF NOT EXISTS "public"."study_request_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "changed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."study_request_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "plan_id" "uuid",
    "existing_group_id" "uuid",
    "current_group_id" "uuid",
    "proposed_location" "text",
    "proposed_schedule" "text",
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "needed_study_code" "text",
    "last_class_attended" "text",
    "last_leader_name" "text",
    "wants_folleto" boolean DEFAULT false NOT NULL,
    "resolved_group_id" "uuid",
    "resulting_enrollment_id" "uuid",
    "resulting_folleto_request_id" "uuid",
    CONSTRAINT "study_requests_last_class_attended_check" CHECK ((("last_class_attended" IS NULL) OR ("last_class_attended" = ANY (ARRAY['1'::"text", '2'::"text", '3'::"text", '4'::"text", '5'::"text", '6'::"text", '7'::"text", '8'::"text", '9'::"text", '10'::"text", '11'::"text", '12'::"text", 'no_recuerda'::"text"])))),
    CONSTRAINT "study_requests_needed_study_code_check" CHECK ((("needed_study_code" IS NULL) OR ("needed_study_code" = ANY (ARRAY['N2'::"text", 'N3'::"text", 'N4'::"text", 'DIS2'::"text", 'DIS3'::"text"])))),
    CONSTRAINT "study_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['relocation'::"text", 'study_interest'::"text"]))),
    CONSTRAINT "study_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_review'::"text", 'resolved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."study_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_requirement_exceptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "waived_requirements" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "reason" "text",
    "granted_by" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "revoked_at" timestamp with time zone,
    CONSTRAINT "study_requirement_exceptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'revoked'::"text", 'used'::"text"])))
);


ALTER TABLE "public"."study_requirement_exceptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."study_requirement_exceptions" IS 'Excepciones de requisitos de matrícula por (miembro, plan). waived_requirements: donor/attendance/server/prerequisite o all. Gestión: coordinadores de estudios/dirigentes + admin (guards de API).';



CREATE TABLE IF NOT EXISTS "public"."study_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "session_date" "date" NOT NULL,
    "topic" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."study_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sub_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "max_capacity" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sub_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vacancies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "committee_id" "uuid" NOT NULL,
    "position_id" "uuid",
    "title" "text" NOT NULL,
    "position" "text",
    "description" "text",
    "functions" "text"[] DEFAULT '{}'::"text"[],
    "schedule" "text",
    "commitment" "text",
    "slots_total" integer DEFAULT 1,
    "slots_filled" integer DEFAULT 0,
    "status" "text" DEFAULT 'creado'::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" "date",
    "location" "text",
    "notes" "text",
    "is_featured" boolean DEFAULT false NOT NULL,
    CONSTRAINT "vacancies_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'filled'::"text", 'closed'::"text", 'creado'::"text", 'enviado_lider'::"text", 'aprobado'::"text", 'denegado'::"text"])))
);


ALTER TABLE "public"."vacancies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vacation_records" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "days" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vacation_records_status_check" CHECK (("status" = ANY (ARRAY['aprobado'::"text", 'pendiente'::"text", 'rechazado'::"text"]))),
    CONSTRAINT "vacation_records_type_check" CHECK (("type" = ANY (ARRAY['vacaciones'::"text", 'permiso_con_goce'::"text", 'permiso_sin_goce'::"text", 'incapacidad'::"text"])))
);


ALTER TABLE "public"."vacation_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."volunteers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "position_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "volunteers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'on_leave'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."volunteers" OWNER TO "postgres";


ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_vacancy_id_applicant_id_key" UNIQUE ("vacancy_id", "applicant_id");



ALTER TABLE ONLY "public"."areas"
    ADD CONSTRAINT "areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capacitacion_bloques"
    ADD CONSTRAINT "capacitacion_bloques_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_configs"
    ADD CONSTRAINT "channel_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."committee_goals"
    ADD CONSTRAINT "committee_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."duplicate_dismissals"
    ADD CONSTRAINT "duplicate_dismissals_pkey" PRIMARY KEY ("member_a", "member_b");



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_employee_code_key" UNIQUE ("employee_code");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_checkins"
    ADD CONSTRAINT "event_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_exceptions"
    ADD CONSTRAINT "event_exceptions_parent_event_id_exception_date_key" UNIQUE ("parent_event_id", "exception_date");



ALTER TABLE ONLY "public"."event_exceptions"
    ADD CONSTRAINT "event_exceptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_organizing_committees"
    ADD CONSTRAINT "event_organizing_committees_pkey" PRIMARY KEY ("event_id", "committee_id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_member_id_key" UNIQUE ("event_id", "member_id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_types"
    ADD CONSTRAINT "event_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_volunteers"
    ADD CONSTRAINT "event_volunteers_event_id_member_id_key" UNIQUE ("event_id", "member_id");



ALTER TABLE ONLY "public"."event_volunteers"
    ADD CONSTRAINT "event_volunteers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_family_unit_id_member_id_key" UNIQUE ("family_unit_id", "member_id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_units"
    ADD CONSTRAINT "family_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_request_status_history"
    ADD CONSTRAINT "finance_request_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_requests"
    ADD CONSTRAINT "finance_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."folleto_requests"
    ADD CONSTRAINT "folleto_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_fields"
    ADD CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_response_values"
    ADD CONSTRAINT "form_response_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."import_batches"
    ADD CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."internal_notifications"
    ADD CONSTRAINT "internal_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leader_evaluations"
    ADD CONSTRAINT "leader_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_admin_data"
    ADD CONSTRAINT "member_admin_data_pkey" PRIMARY KEY ("member_id");



ALTER TABLE ONLY "public"."member_lists"
    ADD CONSTRAINT "member_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_notification_prefs"
    ADD CONSTRAINT "member_notification_prefs_pkey" PRIMARY KEY ("member_id");



ALTER TABLE ONLY "public"."member_recommendations"
    ADD CONSTRAINT "member_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_role_position_grants"
    ADD CONSTRAINT "member_role_position_grants_member_id_role_position_id_key" UNIQUE ("member_id", "role", "position_id");



ALTER TABLE ONLY "public"."member_role_position_grants"
    ADD CONSTRAINT "member_role_position_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_roles"
    ADD CONSTRAINT "member_roles_member_id_role_key" UNIQUE ("member_id", "role");



ALTER TABLE ONLY "public"."member_roles"
    ADD CONSTRAINT "member_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_spiritual_data"
    ADD CONSTRAINT "member_spiritual_data_pkey" PRIMARY KEY ("member_id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_smart_link_token_key" UNIQUE ("smart_link_token");



ALTER TABLE ONLY "public"."message_broadcasts"
    ADD CONSTRAINT "message_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_logs"
    ADD CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paid_positions"
    ADD CONSTRAINT "paid_positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_categories"
    ADD CONSTRAINT "payment_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."position_records"
    ADD CONSTRAINT "position_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."position_requests"
    ADD CONSTRAINT "position_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_changes"
    ADD CONSTRAINT "salary_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scholarship_redemptions"
    ADD CONSTRAINT "scholarship_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scholarship_redemptions"
    ADD CONSTRAINT "scholarship_redemptions_scholarship_id_member_id_key" UNIQUE ("scholarship_id", "member_id");



ALTER TABLE ONLY "public"."scholarships"
    ADD CONSTRAINT "scholarships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sedes"
    ADD CONSTRAINT "sedes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."sedes"
    ADD CONSTRAINT "sedes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_positions"
    ADD CONSTRAINT "service_positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_attendance"
    ADD CONSTRAINT "study_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_attendance"
    ADD CONSTRAINT "study_attendance_session_id_member_id_key" UNIQUE ("session_id", "member_id");



ALTER TABLE ONLY "public"."study_enrollments"
    ADD CONSTRAINT "study_enrollments_group_id_member_id_key" UNIQUE ("group_id", "member_id");



ALTER TABLE ONLY "public"."study_enrollments"
    ADD CONSTRAINT "study_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_groups"
    ADD CONSTRAINT "study_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_invitations"
    ADD CONSTRAINT "study_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_leaders"
    ADD CONSTRAINT "study_leaders_member_id_key" UNIQUE ("member_id");



ALTER TABLE ONLY "public"."study_leaders"
    ADD CONSTRAINT "study_leaders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_plans"
    ADD CONSTRAINT "study_plans_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."study_plans"
    ADD CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_request_status_history"
    ADD CONSTRAINT "study_request_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_requests"
    ADD CONSTRAINT "study_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_requirement_exceptions"
    ADD CONSTRAINT "study_requirement_exceptions_member_id_plan_id_key" UNIQUE ("member_id", "plan_id");



ALTER TABLE ONLY "public"."study_requirement_exceptions"
    ADD CONSTRAINT "study_requirement_exceptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sub_events"
    ADD CONSTRAINT "sub_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vacancies"
    ADD CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vacation_records"
    ADD CONSTRAINT "vacation_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."volunteers"
    ADD CONSTRAINT "volunteers_member_id_position_id_key" UNIQUE ("member_id", "position_id");



ALTER TABLE ONLY "public"."volunteers"
    ADD CONSTRAINT "volunteers_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "event_checkins_member_event_uniq" ON "public"."event_checkins" USING "btree" ("member_id", "event_id") WHERE ("member_id" IS NOT NULL);



CREATE INDEX "idx_applications_applicant" ON "public"."applications" USING "btree" ("applicant_id");



CREATE INDEX "idx_applications_status" ON "public"."applications" USING "btree" ("status");



CREATE INDEX "idx_areas_leader" ON "public"."areas" USING "btree" ("leader_id");



CREATE INDEX "idx_areas_parent" ON "public"."areas" USING "btree" ("parent_id");



CREATE INDEX "idx_areas_type" ON "public"."areas" USING "btree" ("area_type");



CREATE INDEX "idx_audit_actor" ON "public"."audit_log" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_created" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_entity" ON "public"."audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_broadcasts_created" ON "public"."message_broadcasts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_broadcasts_status" ON "public"."message_broadcasts" USING "btree" ("status");



CREATE INDEX "idx_capacitacion_bloques_estado" ON "public"."capacitacion_bloques" USING "btree" ("estado");



CREATE INDEX "idx_checkins_event" ON "public"."event_checkins" USING "btree" ("event_id");



CREATE INDEX "idx_checkins_member_time" ON "public"."event_checkins" USING "btree" ("member_id", "checked_in_at" DESC);



CREATE INDEX "idx_checkins_time" ON "public"."event_checkins" USING "btree" ("checked_in_at");



CREATE INDEX "idx_committee_goals_committee" ON "public"."committee_goals" USING "btree" ("committee_id");



CREATE INDEX "idx_donations_date" ON "public"."donations" USING "btree" ("donation_date");



CREATE INDEX "idx_donations_family_unit" ON "public"."donations" USING "btree" ("family_unit_id");



CREATE INDEX "idx_donations_member" ON "public"."donations" USING "btree" ("member_id");



CREATE INDEX "idx_emp_docs_employee" ON "public"."employee_documents" USING "btree" ("employee_id");



CREATE INDEX "idx_employee_documents_uploaded_by" ON "public"."employee_documents" USING "btree" ("uploaded_by");



CREATE INDEX "idx_employees_created_by" ON "public"."employees" USING "btree" ("created_by");



CREATE INDEX "idx_employees_member" ON "public"."employees" USING "btree" ("member_id");



CREATE INDEX "idx_employees_position" ON "public"."employees" USING "btree" ("position_id");



CREATE INDEX "idx_employees_status" ON "public"."employees" USING "btree" ("status");



CREATE INDEX "idx_enrollments_member" ON "public"."study_enrollments" USING "btree" ("member_id");



CREATE INDEX "idx_enrollments_plan_member_status" ON "public"."study_enrollments" USING "btree" ("plan_id", "member_id", "status");



CREATE INDEX "idx_enrollments_status" ON "public"."study_enrollments" USING "btree" ("status");



CREATE INDEX "idx_event_checkins_checked_in_by" ON "public"."event_checkins" USING "btree" ("checked_in_by");



CREATE INDEX "idx_event_checkins_sub_event" ON "public"."event_checkins" USING "btree" ("sub_event_id");



CREATE INDEX "idx_event_exceptions_override" ON "public"."event_exceptions" USING "btree" ("override_event_id") WHERE ("override_event_id" IS NOT NULL);



CREATE INDEX "idx_event_org_committees_committee" ON "public"."event_organizing_committees" USING "btree" ("committee_id");



CREATE INDEX "idx_event_registrations_member" ON "public"."event_registrations" USING "btree" ("member_id");



CREATE INDEX "idx_event_volunteers_assigned_by" ON "public"."event_volunteers" USING "btree" ("assigned_by");



CREATE INDEX "idx_event_volunteers_member" ON "public"."event_volunteers" USING "btree" ("member_id");



CREATE INDEX "idx_events_active" ON "public"."events" USING "btree" ("is_active");



CREATE INDEX "idx_events_created_by" ON "public"."events" USING "btree" ("created_by");



CREATE INDEX "idx_events_parent" ON "public"."events" USING "btree" ("parent_event_id");



CREATE INDEX "idx_events_sede" ON "public"."events" USING "btree" ("sede_id");



CREATE INDEX "idx_events_starts" ON "public"."events" USING "btree" ("starts_at");



CREATE INDEX "idx_events_type" ON "public"."events" USING "btree" ("event_type");



CREATE INDEX "idx_family_members_linked_by" ON "public"."family_members" USING "btree" ("linked_by");



CREATE INDEX "idx_family_members_member" ON "public"."family_members" USING "btree" ("member_id");



CREATE INDEX "idx_finance_request_history_request" ON "public"."finance_request_status_history" USING "btree" ("request_id");



CREATE INDEX "idx_finance_requests_group" ON "public"."finance_requests" USING "btree" ("study_group_id");



CREATE INDEX "idx_finance_requests_member" ON "public"."finance_requests" USING "btree" ("member_id");



CREATE INDEX "idx_finance_requests_payment" ON "public"."finance_requests" USING "btree" ("payment_id");



CREATE INDEX "idx_finance_requests_reviewer" ON "public"."finance_requests" USING "btree" ("reviewed_by");



CREATE INDEX "idx_finance_requests_status" ON "public"."finance_requests" USING "btree" ("status");



CREATE INDEX "idx_finance_requests_type" ON "public"."finance_requests" USING "btree" ("request_type");



CREATE INDEX "idx_folleto_requests_bloque" ON "public"."folleto_requests" USING "btree" ("bloque_id");



CREATE INDEX "idx_folleto_requests_created" ON "public"."folleto_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_folleto_requests_sede" ON "public"."folleto_requests" USING "btree" ("sede");



CREATE INDEX "idx_folleto_requests_source_group" ON "public"."folleto_requests" USING "btree" ("source_group_id") WHERE ("source_group_id" IS NOT NULL);



CREATE INDEX "idx_folleto_requests_status" ON "public"."folleto_requests" USING "btree" ("status");



CREATE INDEX "idx_folleto_requests_tipo" ON "public"."folleto_requests" USING "btree" ("tipo");



CREATE INDEX "idx_form_fields_order" ON "public"."form_fields" USING "btree" ("form_id", "sort_order");



CREATE INDEX "idx_forms_active" ON "public"."forms" USING "btree" ("is_active");



CREATE INDEX "idx_forms_created_by" ON "public"."forms" USING "btree" ("created_by");



CREATE INDEX "idx_forms_slug" ON "public"."forms" USING "btree" ("slug");



CREATE INDEX "idx_import_batches_imported_by" ON "public"."import_batches" USING "btree" ("imported_by");



CREATE INDEX "idx_internal_notifications_recipient" ON "public"."internal_notifications" USING "btree" ("recipient_member_id", "read");



CREATE INDEX "idx_leader_evaluations_group" ON "public"."leader_evaluations" USING "btree" ("group_id");



CREATE INDEX "idx_leader_evaluations_leader" ON "public"."leader_evaluations" USING "btree" ("leader_id");



CREATE INDEX "idx_member_lists_created_at" ON "public"."member_lists" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_member_recommendations_by" ON "public"."member_recommendations" USING "btree" ("recommended_by");



CREATE INDEX "idx_member_recommendations_group" ON "public"."member_recommendations" USING "btree" ("study_group_id");



CREATE INDEX "idx_member_recommendations_member" ON "public"."member_recommendations" USING "btree" ("member_id");



CREATE INDEX "idx_member_roles_active" ON "public"."member_roles" USING "btree" ("member_id", "is_active");



CREATE INDEX "idx_member_roles_granted_by" ON "public"."member_roles" USING "btree" ("granted_by");



CREATE INDEX "idx_member_roles_revoked_by" ON "public"."member_roles" USING "btree" ("revoked_by");



CREATE INDEX "idx_member_roles_status_detail" ON "public"."member_roles" USING "btree" ("role", "status_detail") WHERE ("status_detail" IS NOT NULL);



CREATE INDEX "idx_members_active" ON "public"."members" USING "btree" ("is_active");



CREATE INDEX "idx_members_auth_user" ON "public"."members" USING "btree" ("auth_user_id");



CREATE INDEX "idx_members_cedula" ON "public"."members" USING "btree" ("cedula");



CREATE INDEX "idx_members_cedula_normalized" ON "public"."members" USING "btree" ("cedula_normalized");



CREATE INDEX "idx_members_email" ON "public"."members" USING "btree" ("email");



CREATE INDEX "idx_members_email_blocked" ON "public"."members" USING "btree" ("email_bounced", "email_complained", "newsletter_opt_out");



CREATE UNIQUE INDEX "idx_members_external_id" ON "public"."members" USING "btree" ("external_id") WHERE ("external_id" IS NOT NULL);



CREATE INDEX "idx_members_province" ON "public"."members" USING "btree" ("province");



CREATE INDEX "idx_members_search_text" ON "public"."members" USING "gin" ("search_text" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_members_sede" ON "public"."members" USING "btree" ("sede_id");



CREATE UNIQUE INDEX "idx_members_unsubscribe_token" ON "public"."members" USING "btree" ("unsubscribe_token");



CREATE INDEX "idx_message_broadcasts_created_by" ON "public"."message_broadcasts" USING "btree" ("created_by");



CREATE INDEX "idx_message_broadcasts_smtp" ON "public"."message_broadcasts" USING "btree" ("smtp_config_id");



CREATE INDEX "idx_message_broadcasts_template" ON "public"."message_broadcasts" USING "btree" ("template_id");



CREATE INDEX "idx_message_broadcasts_whatsapp" ON "public"."message_broadcasts" USING "btree" ("whatsapp_config_id");



CREATE INDEX "idx_message_logs_broadcast_status" ON "public"."message_logs" USING "btree" ("broadcast_id", "status");



CREATE INDEX "idx_message_logs_member" ON "public"."message_logs" USING "btree" ("member_id");



CREATE INDEX "idx_message_logs_queue" ON "public"."message_logs" USING "btree" ("status", "scheduled_date", "channel") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_message_logs_sent_at" ON "public"."message_logs" USING "btree" ("channel", "sent_at") WHERE ("status" = ANY (ARRAY['sent'::"text", 'delivered'::"text"]));



CREATE INDEX "idx_message_templates_created_by" ON "public"."message_templates" USING "btree" ("created_by");



CREATE UNIQUE INDEX "idx_message_templates_system_key" ON "public"."message_templates" USING "btree" ("system_key") WHERE ("system_key" IS NOT NULL);



CREATE INDEX "idx_paid_positions_committee" ON "public"."paid_positions" USING "btree" ("committee_id");



CREATE INDEX "idx_payments_category" ON "public"."payments" USING "btree" ("category_id");



CREATE INDEX "idx_payments_date" ON "public"."payments" USING "btree" ("payment_date");



CREATE INDEX "idx_payments_en_revision" ON "public"."payments" USING "btree" ("created_at") WHERE ("review_status" = 'en_revision'::"text");



CREATE INDEX "idx_payments_enrollment" ON "public"."payments" USING "btree" ("enrollment_id");



CREATE INDEX "idx_payments_event" ON "public"."payments" USING "btree" ("event_id");



CREATE INDEX "idx_payments_event_registration" ON "public"."payments" USING "btree" ("event_registration_id");



CREATE INDEX "idx_payments_folleto_request" ON "public"."payments" USING "btree" ("folleto_request_id") WHERE ("folleto_request_id" IS NOT NULL);



CREATE INDEX "idx_payments_member" ON "public"."payments" USING "btree" ("member_id");



CREATE INDEX "idx_payments_recorded_by" ON "public"."payments" USING "btree" ("recorded_by");



CREATE INDEX "idx_payments_reference_code" ON "public"."payments" USING "btree" ("reference_code") WHERE ("reference_code" IS NOT NULL);



CREATE INDEX "idx_payments_review_status" ON "public"."payments" USING "btree" ("review_status");



CREATE INDEX "idx_payments_reviewed_by" ON "public"."payments" USING "btree" ("reviewed_by") WHERE ("reviewed_by" IS NOT NULL);



CREATE INDEX "idx_payments_scholarship" ON "public"."payments" USING "btree" ("scholarship_id");



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "idx_payments_study_group" ON "public"."payments" USING "btree" ("study_group_id");



CREATE INDEX "idx_position_records_employee" ON "public"."position_records" USING "btree" ("employee_id");



CREATE INDEX "idx_position_requests_committee" ON "public"."position_requests" USING "btree" ("committee_id");



CREATE INDEX "idx_position_requests_status" ON "public"."position_requests" USING "btree" ("status");



CREATE INDEX "idx_positions_area" ON "public"."service_positions" USING "btree" ("area_id");



CREATE INDEX "idx_refunds_member" ON "public"."refunds" USING "btree" ("member_id");



CREATE INDEX "idx_refunds_payment" ON "public"."refunds" USING "btree" ("payment_id");



CREATE INDEX "idx_refunds_processed_by" ON "public"."refunds" USING "btree" ("processed_by");



CREATE INDEX "idx_refunds_status" ON "public"."refunds" USING "btree" ("status");



CREATE INDEX "idx_request_history_request" ON "public"."study_request_status_history" USING "btree" ("request_id");



CREATE INDEX "idx_response_values_field" ON "public"."form_response_values" USING "btree" ("field_id");



CREATE INDEX "idx_response_values_response" ON "public"."form_response_values" USING "btree" ("response_id");



CREATE INDEX "idx_responses_form" ON "public"."form_responses" USING "btree" ("form_id");



CREATE INDEX "idx_responses_member" ON "public"."form_responses" USING "btree" ("member_id");



CREATE INDEX "idx_role_grants_position" ON "public"."member_role_position_grants" USING "btree" ("position_id");



CREATE INDEX "idx_salary_changes_approved_by" ON "public"."salary_changes" USING "btree" ("approved_by");



CREATE INDEX "idx_salary_changes_employee" ON "public"."salary_changes" USING "btree" ("employee_id");



CREATE INDEX "idx_scholarships_approved_by" ON "public"."scholarships" USING "btree" ("approved_by");



CREATE INDEX "idx_scholarships_created_by" ON "public"."scholarships" USING "btree" ("created_by");



CREATE INDEX "idx_scholarships_event" ON "public"."scholarships" USING "btree" ("event_id");



CREATE INDEX "idx_scholarships_member" ON "public"."scholarships" USING "btree" ("member_id");



CREATE INDEX "idx_scholarships_status" ON "public"."scholarships" USING "btree" ("status");



CREATE INDEX "idx_sedes_active" ON "public"."sedes" USING "btree" ("is_active");



CREATE INDEX "idx_sedes_code" ON "public"."sedes" USING "btree" ("code");



CREATE INDEX "idx_sessions_date" ON "public"."study_sessions" USING "btree" ("session_date");



CREATE INDEX "idx_sessions_group" ON "public"."study_sessions" USING "btree" ("group_id");



CREATE INDEX "idx_sre_member_active" ON "public"."study_requirement_exceptions" USING "btree" ("member_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_study_attendance_member" ON "public"."study_attendance" USING "btree" ("member_id");



CREATE INDEX "idx_study_attendance_recorded_by" ON "public"."study_attendance" USING "btree" ("recorded_by");



CREATE INDEX "idx_study_enrollments_transferred" ON "public"."study_enrollments" USING "btree" ("transferred_to");



CREATE INDEX "idx_study_groups_co_leader" ON "public"."study_groups" USING "btree" ("co_leader_id");



CREATE INDEX "idx_study_groups_leader" ON "public"."study_groups" USING "btree" ("leader_id");



CREATE INDEX "idx_study_groups_status" ON "public"."study_groups" USING "btree" ("status");



CREATE INDEX "idx_study_invitations_invited_by" ON "public"."study_invitations" USING "btree" ("invited_by");



CREATE INDEX "idx_study_leaders_member" ON "public"."study_leaders" USING "btree" ("member_id");



CREATE INDEX "idx_study_plans_mentor" ON "public"."study_plans" USING "btree" ("mentor_id");



CREATE INDEX "idx_study_req_exceptions_plan" ON "public"."study_requirement_exceptions" USING "btree" ("plan_id");



CREATE INDEX "idx_study_requests_current_group" ON "public"."study_requests" USING "btree" ("current_group_id");



CREATE INDEX "idx_study_requests_existing_group" ON "public"."study_requests" USING "btree" ("existing_group_id");



CREATE INDEX "idx_study_requests_member" ON "public"."study_requests" USING "btree" ("member_id");



CREATE INDEX "idx_study_requests_plan" ON "public"."study_requests" USING "btree" ("plan_id");



CREATE INDEX "idx_study_requests_reviewed_by" ON "public"."study_requests" USING "btree" ("reviewed_by");



CREATE INDEX "idx_study_requests_status" ON "public"."study_requests" USING "btree" ("status");



CREATE INDEX "idx_study_requests_type" ON "public"."study_requests" USING "btree" ("request_type");



CREATE INDEX "idx_study_sessions_created_by" ON "public"."study_sessions" USING "btree" ("created_by");



CREATE INDEX "idx_sub_events_event" ON "public"."sub_events" USING "btree" ("event_id");



CREATE INDEX "idx_vacancies_committee" ON "public"."vacancies" USING "btree" ("committee_id");



CREATE INDEX "idx_vacancies_position" ON "public"."vacancies" USING "btree" ("position_id");



CREATE INDEX "idx_vacancies_status" ON "public"."vacancies" USING "btree" ("status");



CREATE INDEX "idx_vacation_records_employee" ON "public"."vacation_records" USING "btree" ("employee_id");



CREATE INDEX "idx_volunteers_position" ON "public"."volunteers" USING "btree" ("position_id");



CREATE INDEX "idx_volunteers_status" ON "public"."volunteers" USING "btree" ("status");



CREATE UNIQUE INDEX "members_auth_user_id_uniq" ON "public"."members" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE UNIQUE INDEX "members_cedula_norm_uniq" ON "public"."members" USING "btree" ("cedula_normalized") WHERE (("cedula_normalized" IS NOT NULL) AND (NOT "cedula_dup_legacy"));



CREATE UNIQUE INDEX "payments_comprobante_en_revision_uniq" ON "public"."payments" USING "btree" ("enrollment_id") WHERE (("review_status" = 'en_revision'::"text") AND ("concept" = 'matricula'::"text") AND ("enrollment_id" IS NOT NULL));



CREATE UNIQUE INDEX "payments_comprobante_evento_en_revision_uniq" ON "public"."payments" USING "btree" ("event_registration_id") WHERE (("review_status" = 'en_revision'::"text") AND ("concept" = 'evento'::"text") AND ("event_registration_id" IS NOT NULL));



CREATE UNIQUE INDEX "scholarships_code_uniq" ON "public"."scholarships" USING "btree" ("code") WHERE ("code" IS NOT NULL);



CREATE UNIQUE INDEX "study_groups_sucesor_uniq" ON "public"."study_groups" USING "btree" ("plan_id", "leader_id", "schedule_time", "zone") WHERE ("status" = ANY (ARRAY['en_matricula'::"text", 'en_curso'::"text"]));



CREATE UNIQUE INDEX "study_invitations_active_uq" ON "public"."study_invitations" USING "btree" ("member_id", "plan_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "study_invitations_plan_idx" ON "public"."study_invitations" USING "btree" ("plan_id");



CREATE OR REPLACE TRIGGER "audit_areas" AFTER INSERT OR DELETE OR UPDATE ON "public"."areas" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "audit_broadcasts" AFTER INSERT OR DELETE OR UPDATE ON "public"."message_broadcasts" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "audit_employees" AFTER INSERT OR DELETE OR UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "audit_enrollments" AFTER INSERT OR DELETE OR UPDATE ON "public"."study_enrollments" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "audit_events" AFTER INSERT OR DELETE OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "audit_form_responses" AFTER INSERT OR DELETE OR UPDATE ON "public"."form_responses" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "audit_member_roles" AFTER INSERT OR DELETE OR UPDATE ON "public"."member_roles" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "audit_members" AFTER INSERT OR DELETE OR UPDATE ON "public"."members" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "audit_payments" AFTER INSERT OR DELETE OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "audit_scholarships" AFTER INSERT OR DELETE OR UPDATE ON "public"."scholarships" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "audit_volunteers" AFTER INSERT OR DELETE OR UPDATE ON "public"."volunteers" FOR EACH ROW EXECUTE FUNCTION "public"."log_changes"();



CREATE OR REPLACE TRIGGER "set_updated_at_applications" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_areas" BEFORE UPDATE ON "public"."areas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_broadcasts" BEFORE UPDATE ON "public"."message_broadcasts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_channel_configs" BEFORE UPDATE ON "public"."channel_configs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_employees" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_enrollments" BEFORE UPDATE ON "public"."study_enrollments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_event_types" BEFORE UPDATE ON "public"."event_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_events" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_forms" BEFORE UPDATE ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_members" BEFORE UPDATE ON "public"."members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_paid_positions" BEFORE UPDATE ON "public"."paid_positions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_payments" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_positions" BEFORE UPDATE ON "public"."service_positions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_refunds" BEFORE UPDATE ON "public"."refunds" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_scholarships" BEFORE UPDATE ON "public"."scholarships" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_sedes" BEFORE UPDATE ON "public"."sedes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_study_groups" BEFORE UPDATE ON "public"."study_groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_study_leaders" BEFORE UPDATE ON "public"."study_leaders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_study_plans" BEFORE UPDATE ON "public"."study_plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_templates" BEFORE UPDATE ON "public"."message_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_vacancies" BEFORE UPDATE ON "public"."vacancies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_volunteers" BEFORE UPDATE ON "public"."volunteers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_donations_donor" AFTER INSERT ON "public"."donations" FOR EACH ROW EXECUTE FUNCTION "public"."set_donor_on_donation"();



CREATE OR REPLACE TRIGGER "trg_forms_detach_on_event_delete" AFTER DELETE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."forms_detach_on_parent_delete"('event');



CREATE OR REPLACE TRIGGER "trg_forms_detach_on_group_delete" AFTER DELETE ON "public"."study_groups" FOR EACH ROW EXECUTE FUNCTION "public"."forms_detach_on_parent_delete"('study_group');



CREATE OR REPLACE TRIGGER "trg_forms_validate_entity" BEFORE INSERT OR UPDATE OF "entity_type", "entity_id" ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "public"."forms_validate_entity"();



CREATE OR REPLACE TRIGGER "trg_recalc_member_sede" AFTER INSERT ON "public"."event_checkins" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_member_sede"();



CREATE OR REPLACE TRIGGER "trg_sync_account_confirmed_on_link" AFTER INSERT OR UPDATE OF "auth_user_id" ON "public"."members" FOR EACH ROW EXECUTE FUNCTION "public"."sync_member_account_confirmed_on_link"();



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."areas"
    ADD CONSTRAINT "areas_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."areas"
    ADD CONSTRAINT "areas_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."areas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."committee_goals"
    ADD CONSTRAINT "committee_goals_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "public"."areas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_family_unit_id_fkey" FOREIGN KEY ("family_unit_id") REFERENCES "public"."family_units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."duplicate_dismissals"
    ADD CONSTRAINT "duplicate_dismissals_member_a_fkey" FOREIGN KEY ("member_a") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duplicate_dismissals"
    ADD CONSTRAINT "duplicate_dismissals_member_b_fkey" FOREIGN KEY ("member_b") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."paid_positions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_checkins"
    ADD CONSTRAINT "event_checkins_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_checkins"
    ADD CONSTRAINT "event_checkins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_checkins"
    ADD CONSTRAINT "event_checkins_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_checkins"
    ADD CONSTRAINT "event_checkins_sub_event_id_fkey" FOREIGN KEY ("sub_event_id") REFERENCES "public"."sub_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_exceptions"
    ADD CONSTRAINT "event_exceptions_override_event_id_fkey" FOREIGN KEY ("override_event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_exceptions"
    ADD CONSTRAINT "event_exceptions_parent_event_id_fkey" FOREIGN KEY ("parent_event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_organizing_committees"
    ADD CONSTRAINT "event_organizing_committees_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "public"."areas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_organizing_committees"
    ADD CONSTRAINT "event_organizing_committees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_volunteers"
    ADD CONSTRAINT "event_volunteers_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_volunteers"
    ADD CONSTRAINT "event_volunteers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_volunteers"
    ADD CONSTRAINT "event_volunteers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_event_type_fkey" FOREIGN KEY ("event_type") REFERENCES "public"."event_types"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_parent_event_id_fkey" FOREIGN KEY ("parent_event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_family_unit_id_fkey" FOREIGN KEY ("family_unit_id") REFERENCES "public"."family_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "public"."members"("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_request_status_history"
    ADD CONSTRAINT "finance_request_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_request_status_history"
    ADD CONSTRAINT "finance_request_status_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."finance_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_requests"
    ADD CONSTRAINT "finance_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."finance_requests"
    ADD CONSTRAINT "finance_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_requests"
    ADD CONSTRAINT "finance_requests_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_requests"
    ADD CONSTRAINT "finance_requests_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id");



ALTER TABLE ONLY "public"."finance_requests"
    ADD CONSTRAINT "finance_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_requests"
    ADD CONSTRAINT "finance_requests_study_group_id_fkey" FOREIGN KEY ("study_group_id") REFERENCES "public"."study_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."folleto_requests"
    ADD CONSTRAINT "folleto_requests_bloque_id_fkey" FOREIGN KEY ("bloque_id") REFERENCES "public"."capacitacion_bloques"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."folleto_requests"
    ADD CONSTRAINT "folleto_requests_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."folleto_requests"
    ADD CONSTRAINT "folleto_requests_source_group_id_fkey" FOREIGN KEY ("source_group_id") REFERENCES "public"."study_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."form_fields"
    ADD CONSTRAINT "form_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_response_values"
    ADD CONSTRAINT "form_response_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."form_fields"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_response_values"
    ADD CONSTRAINT "form_response_values_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."form_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_responses"
    ADD CONSTRAINT "form_responses_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."import_batches"
    ADD CONSTRAINT "import_batches_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."internal_notifications"
    ADD CONSTRAINT "internal_notifications_recipient_member_id_fkey" FOREIGN KEY ("recipient_member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leader_evaluations"
    ADD CONSTRAINT "leader_evaluations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leader_evaluations"
    ADD CONSTRAINT "leader_evaluations_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."study_leaders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_admin_data"
    ADD CONSTRAINT "member_admin_data_authorized_virtual_studies_by_fkey" FOREIGN KEY ("authorized_virtual_studies_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_admin_data"
    ADD CONSTRAINT "member_admin_data_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_admin_data"
    ADD CONSTRAINT "member_admin_data_not_recommended_to_lead_studies_by_fkey" FOREIGN KEY ("not_recommended_to_lead_studies_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_lists"
    ADD CONSTRAINT "member_lists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_notification_prefs"
    ADD CONSTRAINT "member_notification_prefs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_recommendations"
    ADD CONSTRAINT "member_recommendations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_recommendations"
    ADD CONSTRAINT "member_recommendations_recommended_by_fkey" FOREIGN KEY ("recommended_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_recommendations"
    ADD CONSTRAINT "member_recommendations_study_group_id_fkey" FOREIGN KEY ("study_group_id") REFERENCES "public"."study_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_role_position_grants"
    ADD CONSTRAINT "member_role_position_grants_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_role_position_grants"
    ADD CONSTRAINT "member_role_position_grants_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."service_positions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_roles"
    ADD CONSTRAINT "member_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."members"("id");



ALTER TABLE ONLY "public"."member_roles"
    ADD CONSTRAINT "member_roles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_roles"
    ADD CONSTRAINT "member_roles_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."member_spiritual_data"
    ADD CONSTRAINT "member_spiritual_data_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_broadcasts"
    ADD CONSTRAINT "message_broadcasts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."message_broadcasts"
    ADD CONSTRAINT "message_broadcasts_smtp_config_id_fkey" FOREIGN KEY ("smtp_config_id") REFERENCES "public"."channel_configs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_broadcasts"
    ADD CONSTRAINT "message_broadcasts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."message_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_broadcasts"
    ADD CONSTRAINT "message_broadcasts_whatsapp_config_id_fkey" FOREIGN KEY ("whatsapp_config_id") REFERENCES "public"."channel_configs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_logs"
    ADD CONSTRAINT "message_logs_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "public"."message_broadcasts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_logs"
    ADD CONSTRAINT "message_logs_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."paid_positions"
    ADD CONSTRAINT "paid_positions_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "public"."areas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."payment_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."study_enrollments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_event_registration_id_fkey" FOREIGN KEY ("event_registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_folleto_request_id_fkey" FOREIGN KEY ("folleto_request_id") REFERENCES "public"."folleto_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_scholarship_id_fkey" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_study_group_id_fkey" FOREIGN KEY ("study_group_id") REFERENCES "public"."study_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."position_records"
    ADD CONSTRAINT "position_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."position_requests"
    ADD CONSTRAINT "position_requests_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "public"."areas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."position_requests"
    ADD CONSTRAINT "position_requests_created_position_id_fkey" FOREIGN KEY ("created_position_id") REFERENCES "public"."service_positions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."position_requests"
    ADD CONSTRAINT "position_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."position_requests"
    ADD CONSTRAINT "position_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."salary_changes"
    ADD CONSTRAINT "salary_changes_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."salary_changes"
    ADD CONSTRAINT "salary_changes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scholarship_redemptions"
    ADD CONSTRAINT "scholarship_redemptions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."study_enrollments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scholarship_redemptions"
    ADD CONSTRAINT "scholarship_redemptions_event_registration_id_fkey" FOREIGN KEY ("event_registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scholarship_redemptions"
    ADD CONSTRAINT "scholarship_redemptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scholarship_redemptions"
    ADD CONSTRAINT "scholarship_redemptions_scholarship_id_fkey" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scholarships"
    ADD CONSTRAINT "scholarships_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."scholarships"
    ADD CONSTRAINT "scholarships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."scholarships"
    ADD CONSTRAINT "scholarships_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scholarships"
    ADD CONSTRAINT "scholarships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scholarships"
    ADD CONSTRAINT "scholarships_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id");



ALTER TABLE ONLY "public"."scholarships"
    ADD CONSTRAINT "scholarships_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."finance_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_positions"
    ADD CONSTRAINT "service_positions_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_positions"
    ADD CONSTRAINT "service_positions_base_area_id_fkey" FOREIGN KEY ("base_area_id") REFERENCES "public"."areas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_attendance"
    ADD CONSTRAINT "study_attendance_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_attendance"
    ADD CONSTRAINT "study_attendance_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."study_attendance"
    ADD CONSTRAINT "study_attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_enrollments"
    ADD CONSTRAINT "study_enrollments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_enrollments"
    ADD CONSTRAINT "study_enrollments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_enrollments"
    ADD CONSTRAINT "study_enrollments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id");



ALTER TABLE ONLY "public"."study_enrollments"
    ADD CONSTRAINT "study_enrollments_transferred_to_fkey" FOREIGN KEY ("transferred_to") REFERENCES "public"."study_groups"("id");



ALTER TABLE ONLY "public"."study_groups"
    ADD CONSTRAINT "study_groups_co_leader_id_fkey" FOREIGN KEY ("co_leader_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_groups"
    ADD CONSTRAINT "study_groups_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_groups"
    ADD CONSTRAINT "study_groups_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_invitations"
    ADD CONSTRAINT "study_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_invitations"
    ADD CONSTRAINT "study_invitations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_invitations"
    ADD CONSTRAINT "study_invitations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_leaders"
    ADD CONSTRAINT "study_leaders_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_plans"
    ADD CONSTRAINT "study_plans_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_request_status_history"
    ADD CONSTRAINT "study_request_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_request_status_history"
    ADD CONSTRAINT "study_request_status_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."study_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_requests"
    ADD CONSTRAINT "study_requests_current_group_id_fkey" FOREIGN KEY ("current_group_id") REFERENCES "public"."study_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_requests"
    ADD CONSTRAINT "study_requests_existing_group_id_fkey" FOREIGN KEY ("existing_group_id") REFERENCES "public"."study_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_requests"
    ADD CONSTRAINT "study_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_requests"
    ADD CONSTRAINT "study_requests_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_requests"
    ADD CONSTRAINT "study_requests_resolved_group_id_fkey" FOREIGN KEY ("resolved_group_id") REFERENCES "public"."study_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_requests"
    ADD CONSTRAINT "study_requests_resulting_enrollment_id_fkey" FOREIGN KEY ("resulting_enrollment_id") REFERENCES "public"."study_enrollments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_requests"
    ADD CONSTRAINT "study_requests_resulting_folleto_request_id_fkey" FOREIGN KEY ("resulting_folleto_request_id") REFERENCES "public"."folleto_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_requests"
    ADD CONSTRAINT "study_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_requirement_exceptions"
    ADD CONSTRAINT "study_requirement_exceptions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."study_requirement_exceptions"
    ADD CONSTRAINT "study_requirement_exceptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_requirement_exceptions"
    ADD CONSTRAINT "study_requirement_exceptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."study_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_events"
    ADD CONSTRAINT "sub_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vacancies"
    ADD CONSTRAINT "vacancies_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "public"."areas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vacancies"
    ADD CONSTRAINT "vacancies_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."service_positions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vacation_records"
    ADD CONSTRAINT "vacation_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteers"
    ADD CONSTRAINT "volunteers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."volunteers"
    ADD CONSTRAINT "volunteers_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."service_positions"("id") ON DELETE CASCADE;



ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "applications_delete" ON "public"."applications" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "applications_insert" ON "public"."applications" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "applications_select" ON "public"."applications" FOR SELECT TO "authenticated" USING ("private"."has_any_role"(ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"]));



CREATE POLICY "applications_update" ON "public"."applications" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."areas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "areas_delete" ON "public"."areas" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "areas_insert" ON "public"."areas" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "areas_select" ON "public"."areas" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "areas_update" ON "public"."areas" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_select" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."capacitacion_bloques" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channel_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channel_configs_delete" ON "public"."channel_configs" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "channel_configs_insert" ON "public"."channel_configs" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "channel_configs_select" ON "public"."channel_configs" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "channel_configs_update" ON "public"."channel_configs" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."committee_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "committee_goals_delete" ON "public"."committee_goals" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "committee_goals_insert" ON "public"."committee_goals" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "committee_goals_select" ON "public"."committee_goals" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "committee_goals_update" ON "public"."committee_goals" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."donations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "donations_delete" ON "public"."donations" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "donations_insert" ON "public"."donations" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "donations_select" ON "public"."donations" FOR SELECT TO "authenticated" USING ("private"."has_any_role"(ARRAY['admin'::"text", 'finanzas'::"text", 'direccion'::"text"]));



CREATE POLICY "donations_update" ON "public"."donations" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."duplicate_dismissals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_documents_delete" ON "public"."employee_documents" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "employee_documents_insert" ON "public"."employee_documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "employee_documents_select" ON "public"."employee_documents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "employee_documents_update" ON "public"."employee_documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employees_delete" ON "public"."employees" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "employees_insert" ON "public"."employees" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "employees_select" ON "public"."employees" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true))))));



CREATE POLICY "employees_update" ON "public"."employees" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."event_checkins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_checkins_delete" ON "public"."event_checkins" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "event_checkins_insert" ON "public"."event_checkins" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "event_checkins_select" ON "public"."event_checkins" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "event_checkins_update" ON "public"."event_checkins" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."event_exceptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_organizing_committees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_registrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_registrations_delete" ON "public"."event_registrations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "event_registrations_insert" ON "public"."event_registrations" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "event_registrations_select" ON "public"."event_registrations" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "event_registrations_update" ON "public"."event_registrations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."event_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_types_delete" ON "public"."event_types" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "event_types_insert" ON "public"."event_types" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "event_types_select" ON "public"."event_types" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "event_types_update" ON "public"."event_types" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."event_volunteers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_volunteers_delete" ON "public"."event_volunteers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "event_volunteers_insert" ON "public"."event_volunteers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "event_volunteers_select" ON "public"."event_volunteers" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "event_volunteers_update" ON "public"."event_volunteers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_delete" ON "public"."events" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "events_insert" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "events_select" ON "public"."events" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "events_update" ON "public"."events" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."family_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "family_members_select" ON "public"."family_members" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



ALTER TABLE "public"."family_units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "family_units_select" ON "public"."family_units" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "finance_request_history_insert" ON "public"."finance_request_status_history" FOR INSERT TO "authenticated" WITH CHECK ("private"."has_any_role"(ARRAY['admin'::"text", 'finanzas'::"text"]));



CREATE POLICY "finance_request_history_select" ON "public"."finance_request_status_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."member_roles" "mr"
     JOIN "public"."members" "m" ON (("m"."id" = "mr"."member_id")))
  WHERE (("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."finance_request_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_requests_insert" ON "public"."finance_requests" FOR INSERT TO "authenticated" WITH CHECK (("private"."is_own_member"("member_id") OR "private"."has_any_role"(ARRAY['admin'::"text", 'finanzas'::"text"])));



CREATE POLICY "finance_requests_select" ON "public"."finance_requests" FOR SELECT TO "authenticated" USING ((("member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR (EXISTS ( SELECT 1
   FROM ("public"."member_roles" "mr"
     JOIN "public"."members" "m" ON (("m"."id" = "mr"."member_id")))
  WHERE (("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true))))));



CREATE POLICY "finance_requests_update" ON "public"."finance_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."member_roles" "mr"
     JOIN "public"."members" "m" ON (("m"."id" = "mr"."member_id")))
  WHERE (("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."folleto_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_fields" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_fields_delete" ON "public"."form_fields" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "form_fields_insert" ON "public"."form_fields" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "form_fields_select" ON "public"."form_fields" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "form_fields_update" ON "public"."form_fields" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."form_response_values" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_response_values_insert" ON "public"."form_response_values" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "form_response_values_select" ON "public"."form_response_values" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."form_responses" "fr"
  WHERE (("fr"."id" = "form_response_values"."response_id") AND (("fr"."member_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
           FROM "public"."member_roles" "mr"
          WHERE (("mr"."member_id" IN ( SELECT "m"."id"
                   FROM "public"."members" "m"
                  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))))))));



ALTER TABLE "public"."form_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "form_responses_insert" ON "public"."form_responses" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "form_responses_select" ON "public"."form_responses" FOR SELECT TO "authenticated" USING ((("member_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true))))));



ALTER TABLE "public"."forms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forms_delete" ON "public"."forms" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "forms_insert" ON "public"."forms" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "forms_select" ON "public"."forms" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))) OR (("is_active" = true) AND (("is_public" = true) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")))));



CREATE POLICY "forms_update" ON "public"."forms" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."import_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_batches_delete" ON "public"."import_batches" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "import_batches_insert" ON "public"."import_batches" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "import_batches_select" ON "public"."import_batches" FOR SELECT TO "authenticated" USING ("private"."has_any_role"(ARRAY['admin'::"text", 'finanzas'::"text", 'direccion'::"text"]));



CREATE POLICY "import_batches_update" ON "public"."import_batches" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."internal_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_notifications_select" ON "public"."internal_notifications" FOR SELECT TO "authenticated" USING (("recipient_member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "internal_notifications_update" ON "public"."internal_notifications" FOR UPDATE TO "authenticated" USING (("recipient_member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."leader_evaluations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leader_evaluations_delete" ON "public"."leader_evaluations" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "leader_evaluations_insert" ON "public"."leader_evaluations" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "leader_evaluations_select" ON "public"."leader_evaluations" FOR SELECT TO "authenticated" USING ("private"."has_any_role"(ARRAY['admin'::"text", 'coordinador_estudios'::"text", 'coordinador_dirigentes'::"text", 'direccion'::"text"]));



CREATE POLICY "leader_evaluations_update" ON "public"."leader_evaluations" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



CREATE POLICY "mad_insert" ON "public"."member_admin_data" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_study_admin"());



CREATE POLICY "mad_select" ON "public"."member_admin_data" FOR SELECT TO "authenticated" USING ("private"."is_study_admin"());



CREATE POLICY "mad_update" ON "public"."member_admin_data" FOR UPDATE TO "authenticated" USING ("private"."is_study_admin"()) WITH CHECK ("private"."is_study_admin"());



ALTER TABLE "public"."member_admin_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_lists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_lists_select" ON "public"."member_lists" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."member_notification_prefs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_recommendations_insert" ON "public"."member_recommendations" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."member_roles" "mr"
     JOIN "public"."members" "m" ON (("m"."id" = "mr"."member_id")))
  WHERE (("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND "mr"."is_active" AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'direccion'::"text", 'coordinador_estudios'::"text", 'coordinador_dirigentes'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM ("public"."study_groups" "g"
     JOIN "public"."members" "m" ON (("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("g"."id" = "member_recommendations"."study_group_id") AND (("g"."leader_id" = "m"."id") OR ("g"."co_leader_id" = "m"."id")))))));



CREATE POLICY "member_recommendations_select" ON "public"."member_recommendations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."member_roles" "mr"
     JOIN "public"."members" "m" ON (("m"."id" = "mr"."member_id")))
  WHERE (("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND "mr"."is_active" AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'direccion'::"text", 'coordinador_estudios'::"text", 'coordinador_dirigentes'::"text", 'dirigente'::"text"]))))));



ALTER TABLE "public"."member_role_position_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_roles_delete" ON "public"."member_roles" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "member_roles_insert" ON "public"."member_roles" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "member_roles_select" ON "public"."member_roles" FOR SELECT TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "member_roles_update" ON "public"."member_roles" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."member_spiritual_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members_delete" ON "public"."members" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'editor_perfiles'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "members_insert" ON "public"."members" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'editor_perfiles'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "members_select" ON "public"."members" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'editor_perfiles'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "members_update" ON "public"."members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'editor_perfiles'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'editor_perfiles'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."message_broadcasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_broadcasts_delete" ON "public"."message_broadcasts" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "message_broadcasts_insert" ON "public"."message_broadcasts" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "message_broadcasts_select" ON "public"."message_broadcasts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "message_broadcasts_update" ON "public"."message_broadcasts" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."message_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_logs_select" ON "public"."message_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."message_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_templates_delete" ON "public"."message_templates" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "message_templates_insert" ON "public"."message_templates" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "message_templates_select" ON "public"."message_templates" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "message_templates_update" ON "public"."message_templates" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'comunicaciones'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "mnp_insert" ON "public"."member_notification_prefs" FOR INSERT TO "authenticated" WITH CHECK (("private"."is_admin"() OR ("member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "mnp_select" ON "public"."member_notification_prefs" FOR SELECT TO "authenticated" USING (("private"."is_admin"() OR ("member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "mnp_update" ON "public"."member_notification_prefs" FOR UPDATE TO "authenticated" USING (("private"."is_admin"() OR ("member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK (("private"."is_admin"() OR ("member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "msd_insert" ON "public"."member_spiritual_data" FOR INSERT TO "authenticated" WITH CHECK (("private"."is_study_admin"() OR ("member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "msd_select" ON "public"."member_spiritual_data" FOR SELECT TO "authenticated" USING (("private"."is_study_admin"() OR ("member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "msd_update" ON "public"."member_spiritual_data" FOR UPDATE TO "authenticated" USING (("private"."is_study_admin"() OR ("member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK (("private"."is_study_admin"() OR ("member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."paid_positions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "paid_positions_delete" ON "public"."paid_positions" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "paid_positions_insert" ON "public"."paid_positions" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "paid_positions_select" ON "public"."paid_positions" FOR SELECT TO "authenticated" USING ("private"."has_any_role"(ARRAY['admin'::"text", 'finanzas'::"text"]));



CREATE POLICY "paid_positions_update" ON "public"."paid_positions" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."payment_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_categories_delete" ON "public"."payment_categories" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "payment_categories_insert" ON "public"."payment_categories" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "payment_categories_select" ON "public"."payment_categories" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "payment_categories_update" ON "public"."payment_categories" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_insert" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "payments_select" ON "public"."payments" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))) OR ("member_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "payments_update" ON "public"."payments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."position_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "position_records_delete" ON "public"."position_records" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "position_records_insert" ON "public"."position_records" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "position_records_select" ON "public"."position_records" FOR SELECT TO "authenticated" USING ("private"."has_any_role"(ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text", 'finanzas'::"text"]));



CREATE POLICY "position_records_update" ON "public"."position_records" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."position_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refunds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refunds_delete" ON "public"."refunds" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "refunds_insert" ON "public"."refunds" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "refunds_select" ON "public"."refunds" FOR SELECT TO "authenticated" USING ("private"."has_any_role"(ARRAY['admin'::"text", 'finanzas'::"text", 'direccion'::"text"]));



CREATE POLICY "refunds_update" ON "public"."refunds" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



CREATE POLICY "request_history_insert" ON "public"."study_request_status_history" FOR INSERT TO "authenticated" WITH CHECK ("private"."has_any_role"(ARRAY['admin'::"text", 'coordinador_estudios'::"text", 'coordinador_dirigentes'::"text"]));



CREATE POLICY "request_history_select" ON "public"."study_request_status_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."member_roles" "mr"
     JOIN "public"."members" "m" ON (("m"."id" = "mr"."member_id")))
  WHERE (("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'coordinador_estudios'::"text", 'coordinador_dirigentes'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."salary_changes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salary_changes_delete" ON "public"."salary_changes" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "salary_changes_insert" ON "public"."salary_changes" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "salary_changes_select" ON "public"."salary_changes" FOR SELECT TO "authenticated" USING ("private"."has_any_role"(ARRAY['admin'::"text", 'finanzas'::"text"]));



CREATE POLICY "salary_changes_update" ON "public"."salary_changes" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."scholarship_redemptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scholarships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scholarships_delete" ON "public"."scholarships" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "scholarships_insert" ON "public"."scholarships" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "scholarships_select" ON "public"."scholarships" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true))))));



CREATE POLICY "scholarships_update" ON "public"."scholarships" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'finanzas'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."sedes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sedes_delete" ON "public"."sedes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "sedes_insert" ON "public"."sedes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "sedes_select" ON "public"."sedes" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "sedes_update" ON "public"."sedes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."service_positions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_positions_delete" ON "public"."service_positions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "service_positions_insert" ON "public"."service_positions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "service_positions_select" ON "public"."service_positions" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "service_positions_update" ON "public"."service_positions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."study_attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "study_attendance_delete" ON "public"."study_attendance" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "study_attendance_insert" ON "public"."study_attendance" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "study_attendance_select" ON "public"."study_attendance" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "study_attendance_update" ON "public"."study_attendance" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."study_enrollments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "study_enrollments_delete" ON "public"."study_enrollments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "study_enrollments_insert" ON "public"."study_enrollments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "study_enrollments_select" ON "public"."study_enrollments" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (("member_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))))));



CREATE POLICY "study_enrollments_update" ON "public"."study_enrollments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."study_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "study_groups_delete" ON "public"."study_groups" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "study_groups_insert" ON "public"."study_groups" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "study_groups_select" ON "public"."study_groups" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "study_groups_update" ON "public"."study_groups" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."study_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."study_leaders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "study_leaders_delete" ON "public"."study_leaders" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "study_leaders_insert" ON "public"."study_leaders" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "study_leaders_select" ON "public"."study_leaders" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "study_leaders_update" ON "public"."study_leaders" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."study_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "study_plans_delete" ON "public"."study_plans" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "study_plans_insert" ON "public"."study_plans" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "study_plans_select" ON "public"."study_plans" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "study_plans_update" ON "public"."study_plans" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."study_request_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."study_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "study_requests_insert" ON "public"."study_requests" FOR INSERT TO "authenticated" WITH CHECK (("private"."is_own_member"("member_id") OR "private"."has_any_role"(ARRAY['admin'::"text", 'coordinador_estudios'::"text", 'coordinador_dirigentes'::"text"])));



CREATE POLICY "study_requests_select" ON "public"."study_requests" FOR SELECT TO "authenticated" USING ((("member_id" IN ( SELECT "m"."id"
   FROM "public"."members" "m"
  WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR (EXISTS ( SELECT 1
   FROM ("public"."member_roles" "mr"
     JOIN "public"."members" "m" ON (("m"."id" = "mr"."member_id")))
  WHERE (("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'coordinador_estudios'::"text", 'coordinador_dirigentes'::"text"])) AND ("mr"."is_active" = true))))));



CREATE POLICY "study_requests_update" ON "public"."study_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."member_roles" "mr"
     JOIN "public"."members" "m" ON (("m"."id" = "mr"."member_id")))
  WHERE (("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'coordinador_estudios'::"text", 'coordinador_dirigentes'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."study_requirement_exceptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."study_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "study_sessions_delete" ON "public"."study_sessions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "study_sessions_insert" ON "public"."study_sessions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "study_sessions_select" ON "public"."study_sessions" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "study_sessions_update" ON "public"."study_sessions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."sub_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sub_events_delete" ON "public"."sub_events" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "sub_events_insert" ON "public"."sub_events" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "sub_events_select" ON "public"."sub_events" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "sub_events_update" ON "public"."sub_events" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text"])) AND ("mr"."is_active" = true)))));



ALTER TABLE "public"."vacancies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vacancies_delete" ON "public"."vacancies" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "vacancies_insert" ON "public"."vacancies" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "vacancies_select" ON "public"."vacancies" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "vacancies_update" ON "public"."vacancies" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."vacation_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vacation_records_delete" ON "public"."vacation_records" FOR DELETE TO "authenticated" USING ("private"."is_admin"());



CREATE POLICY "vacation_records_insert" ON "public"."vacation_records" FOR INSERT TO "authenticated" WITH CHECK ("private"."is_admin"());



CREATE POLICY "vacation_records_select" ON "public"."vacation_records" FOR SELECT TO "authenticated" USING ("private"."has_any_role"(ARRAY['admin'::"text", 'encargado_staff'::"text", 'direccion'::"text", 'finanzas'::"text"]));



CREATE POLICY "vacation_records_update" ON "public"."vacation_records" FOR UPDATE TO "authenticated" USING ("private"."is_admin"()) WITH CHECK ("private"."is_admin"());



ALTER TABLE "public"."volunteers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "volunteers_delete" ON "public"."volunteers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'lider_comite'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "volunteers_insert" ON "public"."volunteers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'lider_comite'::"text"])) AND ("mr"."is_active" = true)))));



CREATE POLICY "volunteers_select" ON "public"."volunteers" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'lider_comite'::"text"])) AND ("mr"."is_active" = true)))) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "volunteers_update" ON "public"."volunteers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'lider_comite'::"text"])) AND ("mr"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."member_roles" "mr"
  WHERE (("mr"."member_id" IN ( SELECT "m"."id"
           FROM "public"."members" "m"
          WHERE ("m"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("mr"."role" = ANY (ARRAY['admin'::"text", 'encargado_staff'::"text", 'lider_comite'::"text"])) AND ("mr"."is_active" = true)))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































































































































REVOKE ALL ON FUNCTION "public"."active_attendance_member_ids"("p_oldest" timestamp with time zone, "p_min_count" integer, "p_recency_since" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."active_attendance_member_ids"("p_oldest" timestamp with time zone, "p_min_count" integer, "p_recency_since" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_applications"("app_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_applications"("app_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_payment"("p_payment_id" "uuid", "p_reviewer" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_payment"("p_payment_id" "uuid", "p_reviewer" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."block_folletos_by_sede"("p_apertura" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."block_folletos_by_sede"("p_apertura" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."campaign_student_counts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."campaign_student_counts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."charla_sede_code"("p_title" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."charla_sede_code"("p_title" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."close_group"("p_group_id" "uuid", "p_results" "jsonb", "p_closed_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_group"("p_group_id" "uuid", "p_results" "jsonb", "p_closed_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_refund"("p_payment_id" "uuid", "p_member_id" "uuid", "p_amount" numeric, "p_method" "text", "p_reason" "text", "p_sinpe_pending" boolean, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_refund"("p_payment_id" "uuid", "p_member_id" "uuid", "p_amount" numeric, "p_method" "text", "p_reason" "text", "p_sinpe_pending" boolean, "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."dashboard_sums"("p_month_start" timestamp with time zone, "p_month_start_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_sums"("p_month_start" timestamp with time zone, "p_month_start_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."donation_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."donation_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."find_duplicate_pairs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_duplicate_pairs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."forms_detach_on_parent_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."forms_validate_entity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."grant_position_role"("p_member_id" "uuid", "p_role" "text", "p_position_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_position_role"("p_member_id" "uuid", "p_role" "text", "p_position_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."immutable_unaccent"("text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_vacation_days_used"("p_employee_id" "uuid", "p_delta" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_vacation_days_used"("p_employee_id" "uuid", "p_delta" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_changes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_changes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."merge_members"("keep_id" "uuid", "dup_id" "uuid", "soft" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."merge_members"("keep_id" "uuid", "dup_id" "uuid", "soft" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."payment_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."payment_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_refund"("p_refund_id" "uuid", "p_status" "text", "p_processed_at" timestamp with time zone, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_refund"("p_refund_id" "uuid", "p_status" "text", "p_processed_at" timestamp with time zone, "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."prune_audit_log"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prune_audit_log"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."recalc_member_sede"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalc_member_sede"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_donor_flags"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_donor_flags"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_member_sedes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_member_sedes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_for_event"("p_event_id" "uuid", "p_member_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_for_event"("p_event_id" "uuid", "p_member_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."report_charla_attendance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_charla_attendance"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."report_member_growth"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_member_growth"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_position_role"("p_member_id" "uuid", "p_role" "text", "p_position_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_position_role"("p_member_id" "uuid", "p_role" "text", "p_position_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_donor_on_donation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_donor_on_donation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."study_dashboard_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."study_dashboard_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."study_dashboard_stats_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."study_dashboard_stats_v2"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_form_response"("p_form_id" "uuid", "p_member_id" "uuid", "p_guest_name" "text", "p_guest_email" "text", "p_answers" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_form_response"("p_form_id" "uuid", "p_member_id" "uuid", "p_guest_name" "text", "p_guest_email" "text", "p_answers" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_member_account_confirmed"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_member_account_confirmed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_member_account_confirmed_on_link"() TO "service_role";
























GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."areas" TO "authenticated";
GRANT ALL ON TABLE "public"."areas" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."capacitacion_bloques" TO "authenticated";
GRANT ALL ON TABLE "public"."capacitacion_bloques" TO "service_role";



GRANT ALL ON TABLE "public"."channel_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_configs" TO "service_role";



GRANT ALL ON TABLE "public"."committee_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."committee_goals" TO "service_role";



GRANT ALL ON TABLE "public"."donations" TO "authenticated";
GRANT ALL ON TABLE "public"."donations" TO "service_role";



GRANT ALL ON TABLE "public"."duplicate_dismissals" TO "authenticated";
GRANT ALL ON TABLE "public"."duplicate_dismissals" TO "service_role";



GRANT ALL ON TABLE "public"."employee_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_documents" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."event_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."event_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."event_exceptions" TO "authenticated";
GRANT ALL ON TABLE "public"."event_exceptions" TO "service_role";



GRANT ALL ON TABLE "public"."event_organizing_committees" TO "authenticated";
GRANT ALL ON TABLE "public"."event_organizing_committees" TO "service_role";



GRANT ALL ON TABLE "public"."event_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."event_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."event_types" TO "authenticated";
GRANT ALL ON TABLE "public"."event_types" TO "service_role";



GRANT ALL ON TABLE "public"."event_volunteers" TO "authenticated";
GRANT ALL ON TABLE "public"."event_volunteers" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."family_members" TO "service_role";



GRANT ALL ON TABLE "public"."family_units" TO "authenticated";
GRANT ALL ON TABLE "public"."family_units" TO "service_role";



GRANT ALL ON TABLE "public"."finance_request_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_request_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."finance_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_requests" TO "service_role";



GRANT ALL ON TABLE "public"."folleto_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."folleto_requests" TO "service_role";



GRANT ALL ON TABLE "public"."form_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."form_fields" TO "service_role";



GRANT ALL ON TABLE "public"."form_response_values" TO "authenticated";
GRANT ALL ON TABLE "public"."form_response_values" TO "service_role";



GRANT ALL ON TABLE "public"."form_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."form_responses" TO "service_role";



GRANT ALL ON TABLE "public"."forms" TO "authenticated";
GRANT ALL ON TABLE "public"."forms" TO "service_role";



GRANT ALL ON TABLE "public"."import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."internal_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."leader_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."leader_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."member_admin_data" TO "authenticated";
GRANT ALL ON TABLE "public"."member_admin_data" TO "service_role";



GRANT ALL ON TABLE "public"."member_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."member_lists" TO "service_role";



GRANT ALL ON TABLE "public"."member_notification_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."member_notification_prefs" TO "service_role";



GRANT ALL ON TABLE "public"."member_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."member_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."member_role_position_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."member_role_position_grants" TO "service_role";



GRANT ALL ON TABLE "public"."member_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."member_roles" TO "service_role";



GRANT ALL ON TABLE "public"."member_spiritual_data" TO "authenticated";
GRANT ALL ON TABLE "public"."member_spiritual_data" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."message_broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."message_broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."message_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."message_logs" TO "service_role";



GRANT ALL ON TABLE "public"."message_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."message_templates" TO "service_role";



GRANT ALL ON TABLE "public"."paid_positions" TO "authenticated";
GRANT ALL ON TABLE "public"."paid_positions" TO "service_role";



GRANT ALL ON TABLE "public"."payment_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_categories" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."position_records" TO "authenticated";
GRANT ALL ON TABLE "public"."position_records" TO "service_role";



GRANT ALL ON TABLE "public"."position_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."position_requests" TO "service_role";



GRANT ALL ON TABLE "public"."refunds" TO "authenticated";
GRANT ALL ON TABLE "public"."refunds" TO "service_role";



GRANT ALL ON TABLE "public"."salary_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_changes" TO "service_role";



GRANT ALL ON TABLE "public"."scholarship_redemptions" TO "authenticated";
GRANT ALL ON TABLE "public"."scholarship_redemptions" TO "service_role";



GRANT ALL ON TABLE "public"."scholarships" TO "authenticated";
GRANT ALL ON TABLE "public"."scholarships" TO "service_role";



GRANT ALL ON TABLE "public"."sedes" TO "authenticated";
GRANT ALL ON TABLE "public"."sedes" TO "service_role";



GRANT ALL ON TABLE "public"."service_positions" TO "authenticated";
GRANT ALL ON TABLE "public"."service_positions" TO "service_role";



GRANT ALL ON TABLE "public"."study_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."study_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."study_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."study_enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."study_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."study_groups" TO "service_role";



GRANT ALL ON TABLE "public"."study_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."study_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."study_leaders" TO "authenticated";
GRANT ALL ON TABLE "public"."study_leaders" TO "service_role";



GRANT ALL ON TABLE "public"."study_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."study_plans" TO "service_role";



GRANT ALL ON TABLE "public"."study_request_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."study_request_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."study_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."study_requests" TO "service_role";



GRANT ALL ON TABLE "public"."study_requirement_exceptions" TO "authenticated";
GRANT ALL ON TABLE "public"."study_requirement_exceptions" TO "service_role";



GRANT ALL ON TABLE "public"."study_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."study_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."sub_events" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_events" TO "service_role";



GRANT ALL ON TABLE "public"."vacancies" TO "authenticated";
GRANT ALL ON TABLE "public"."vacancies" TO "service_role";



GRANT ALL ON TABLE "public"."vacation_records" TO "authenticated";
GRANT ALL ON TABLE "public"."vacation_records" TO "service_role";



GRANT ALL ON TABLE "public"."volunteers" TO "authenticated";
GRANT ALL ON TABLE "public"."volunteers" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































-- ============================================================
-- Hardening de privilegios de anon (migración 077 original).
-- El dump de esquema no captura estos REVOKE; se re-agregan para
-- que la baseline reproduzca fielmente el estado de producción.
-- ============================================================
revoke references on table "public"."applications" from "anon";

revoke trigger on table "public"."applications" from "anon";

revoke truncate on table "public"."applications" from "anon";

revoke references on table "public"."areas" from "anon";

revoke trigger on table "public"."areas" from "anon";

revoke truncate on table "public"."areas" from "anon";

revoke references on table "public"."audit_log" from "anon";

revoke trigger on table "public"."audit_log" from "anon";

revoke truncate on table "public"."audit_log" from "anon";

revoke references on table "public"."capacitacion_bloques" from "anon";

revoke trigger on table "public"."capacitacion_bloques" from "anon";

revoke truncate on table "public"."capacitacion_bloques" from "anon";

revoke references on table "public"."channel_configs" from "anon";

revoke trigger on table "public"."channel_configs" from "anon";

revoke truncate on table "public"."channel_configs" from "anon";

revoke references on table "public"."committee_goals" from "anon";

revoke trigger on table "public"."committee_goals" from "anon";

revoke truncate on table "public"."committee_goals" from "anon";

revoke references on table "public"."donations" from "anon";

revoke trigger on table "public"."donations" from "anon";

revoke truncate on table "public"."donations" from "anon";

revoke references on table "public"."duplicate_dismissals" from "anon";

revoke trigger on table "public"."duplicate_dismissals" from "anon";

revoke truncate on table "public"."duplicate_dismissals" from "anon";

revoke references on table "public"."employee_documents" from "anon";

revoke trigger on table "public"."employee_documents" from "anon";

revoke truncate on table "public"."employee_documents" from "anon";

revoke references on table "public"."employees" from "anon";

revoke trigger on table "public"."employees" from "anon";

revoke truncate on table "public"."employees" from "anon";

revoke references on table "public"."event_checkins" from "anon";

revoke trigger on table "public"."event_checkins" from "anon";

revoke truncate on table "public"."event_checkins" from "anon";

revoke references on table "public"."event_exceptions" from "anon";

revoke trigger on table "public"."event_exceptions" from "anon";

revoke truncate on table "public"."event_exceptions" from "anon";

revoke references on table "public"."event_organizing_committees" from "anon";

revoke trigger on table "public"."event_organizing_committees" from "anon";

revoke truncate on table "public"."event_organizing_committees" from "anon";

revoke references on table "public"."event_registrations" from "anon";

revoke trigger on table "public"."event_registrations" from "anon";

revoke truncate on table "public"."event_registrations" from "anon";

revoke references on table "public"."event_types" from "anon";

revoke trigger on table "public"."event_types" from "anon";

revoke truncate on table "public"."event_types" from "anon";

revoke references on table "public"."event_volunteers" from "anon";

revoke trigger on table "public"."event_volunteers" from "anon";

revoke truncate on table "public"."event_volunteers" from "anon";

revoke references on table "public"."events" from "anon";

revoke trigger on table "public"."events" from "anon";

revoke truncate on table "public"."events" from "anon";

revoke references on table "public"."family_members" from "anon";

revoke trigger on table "public"."family_members" from "anon";

revoke truncate on table "public"."family_members" from "anon";

revoke references on table "public"."family_units" from "anon";

revoke trigger on table "public"."family_units" from "anon";

revoke truncate on table "public"."family_units" from "anon";

revoke references on table "public"."finance_request_status_history" from "anon";

revoke trigger on table "public"."finance_request_status_history" from "anon";

revoke truncate on table "public"."finance_request_status_history" from "anon";

revoke references on table "public"."finance_requests" from "anon";

revoke trigger on table "public"."finance_requests" from "anon";

revoke truncate on table "public"."finance_requests" from "anon";

revoke references on table "public"."folleto_requests" from "anon";

revoke trigger on table "public"."folleto_requests" from "anon";

revoke truncate on table "public"."folleto_requests" from "anon";

revoke references on table "public"."form_fields" from "anon";

revoke trigger on table "public"."form_fields" from "anon";

revoke truncate on table "public"."form_fields" from "anon";

revoke references on table "public"."form_response_values" from "anon";

revoke trigger on table "public"."form_response_values" from "anon";

revoke truncate on table "public"."form_response_values" from "anon";

revoke references on table "public"."form_responses" from "anon";

revoke trigger on table "public"."form_responses" from "anon";

revoke truncate on table "public"."form_responses" from "anon";

revoke references on table "public"."forms" from "anon";

revoke trigger on table "public"."forms" from "anon";

revoke truncate on table "public"."forms" from "anon";

revoke references on table "public"."import_batches" from "anon";

revoke trigger on table "public"."import_batches" from "anon";

revoke truncate on table "public"."import_batches" from "anon";

revoke references on table "public"."internal_notifications" from "anon";

revoke trigger on table "public"."internal_notifications" from "anon";

revoke truncate on table "public"."internal_notifications" from "anon";

revoke references on table "public"."leader_evaluations" from "anon";

revoke trigger on table "public"."leader_evaluations" from "anon";

revoke truncate on table "public"."leader_evaluations" from "anon";

revoke references on table "public"."member_admin_data" from "anon";

revoke trigger on table "public"."member_admin_data" from "anon";

revoke truncate on table "public"."member_admin_data" from "anon";

revoke references on table "public"."member_lists" from "anon";

revoke trigger on table "public"."member_lists" from "anon";

revoke truncate on table "public"."member_lists" from "anon";

revoke references on table "public"."member_notification_prefs" from "anon";

revoke trigger on table "public"."member_notification_prefs" from "anon";

revoke truncate on table "public"."member_notification_prefs" from "anon";

revoke references on table "public"."member_recommendations" from "anon";

revoke trigger on table "public"."member_recommendations" from "anon";

revoke truncate on table "public"."member_recommendations" from "anon";

revoke references on table "public"."member_role_position_grants" from "anon";

revoke trigger on table "public"."member_role_position_grants" from "anon";

revoke truncate on table "public"."member_role_position_grants" from "anon";

revoke references on table "public"."member_roles" from "anon";

revoke trigger on table "public"."member_roles" from "anon";

revoke truncate on table "public"."member_roles" from "anon";

revoke references on table "public"."member_spiritual_data" from "anon";

revoke trigger on table "public"."member_spiritual_data" from "anon";

revoke truncate on table "public"."member_spiritual_data" from "anon";

revoke references on table "public"."members" from "anon";

revoke trigger on table "public"."members" from "anon";

revoke truncate on table "public"."members" from "anon";

revoke references on table "public"."message_broadcasts" from "anon";

revoke trigger on table "public"."message_broadcasts" from "anon";

revoke truncate on table "public"."message_broadcasts" from "anon";

revoke references on table "public"."message_logs" from "anon";

revoke trigger on table "public"."message_logs" from "anon";

revoke truncate on table "public"."message_logs" from "anon";

revoke references on table "public"."message_templates" from "anon";

revoke trigger on table "public"."message_templates" from "anon";

revoke truncate on table "public"."message_templates" from "anon";

revoke references on table "public"."paid_positions" from "anon";

revoke trigger on table "public"."paid_positions" from "anon";

revoke truncate on table "public"."paid_positions" from "anon";

revoke references on table "public"."payment_categories" from "anon";

revoke trigger on table "public"."payment_categories" from "anon";

revoke truncate on table "public"."payment_categories" from "anon";

revoke references on table "public"."payments" from "anon";

revoke trigger on table "public"."payments" from "anon";

revoke truncate on table "public"."payments" from "anon";

revoke references on table "public"."position_records" from "anon";

revoke trigger on table "public"."position_records" from "anon";

revoke truncate on table "public"."position_records" from "anon";

revoke references on table "public"."position_requests" from "anon";

revoke trigger on table "public"."position_requests" from "anon";

revoke truncate on table "public"."position_requests" from "anon";

revoke references on table "public"."refunds" from "anon";

revoke trigger on table "public"."refunds" from "anon";

revoke truncate on table "public"."refunds" from "anon";

revoke references on table "public"."salary_changes" from "anon";

revoke trigger on table "public"."salary_changes" from "anon";

revoke truncate on table "public"."salary_changes" from "anon";

revoke references on table "public"."scholarship_redemptions" from "anon";

revoke trigger on table "public"."scholarship_redemptions" from "anon";

revoke truncate on table "public"."scholarship_redemptions" from "anon";

revoke references on table "public"."scholarships" from "anon";

revoke trigger on table "public"."scholarships" from "anon";

revoke truncate on table "public"."scholarships" from "anon";

revoke references on table "public"."sedes" from "anon";

revoke trigger on table "public"."sedes" from "anon";

revoke truncate on table "public"."sedes" from "anon";

revoke references on table "public"."service_positions" from "anon";

revoke trigger on table "public"."service_positions" from "anon";

revoke truncate on table "public"."service_positions" from "anon";

revoke references on table "public"."study_attendance" from "anon";

revoke trigger on table "public"."study_attendance" from "anon";

revoke truncate on table "public"."study_attendance" from "anon";

revoke references on table "public"."study_enrollments" from "anon";

revoke trigger on table "public"."study_enrollments" from "anon";

revoke truncate on table "public"."study_enrollments" from "anon";

revoke references on table "public"."study_groups" from "anon";

revoke trigger on table "public"."study_groups" from "anon";

revoke truncate on table "public"."study_groups" from "anon";

revoke references on table "public"."study_invitations" from "anon";

revoke trigger on table "public"."study_invitations" from "anon";

revoke truncate on table "public"."study_invitations" from "anon";

revoke references on table "public"."study_leaders" from "anon";

revoke trigger on table "public"."study_leaders" from "anon";

revoke truncate on table "public"."study_leaders" from "anon";

revoke references on table "public"."study_plans" from "anon";

revoke trigger on table "public"."study_plans" from "anon";

revoke truncate on table "public"."study_plans" from "anon";

revoke references on table "public"."study_request_status_history" from "anon";

revoke trigger on table "public"."study_request_status_history" from "anon";

revoke truncate on table "public"."study_request_status_history" from "anon";

revoke references on table "public"."study_requests" from "anon";

revoke trigger on table "public"."study_requests" from "anon";

revoke truncate on table "public"."study_requests" from "anon";

revoke references on table "public"."study_requirement_exceptions" from "anon";

revoke trigger on table "public"."study_requirement_exceptions" from "anon";

revoke truncate on table "public"."study_requirement_exceptions" from "anon";

revoke references on table "public"."study_sessions" from "anon";

revoke trigger on table "public"."study_sessions" from "anon";

revoke truncate on table "public"."study_sessions" from "anon";

revoke references on table "public"."sub_events" from "anon";

revoke trigger on table "public"."sub_events" from "anon";

revoke truncate on table "public"."sub_events" from "anon";

revoke references on table "public"."vacancies" from "anon";

revoke trigger on table "public"."vacancies" from "anon";

revoke truncate on table "public"."vacancies" from "anon";

revoke references on table "public"."vacation_records" from "anon";

revoke trigger on table "public"."vacation_records" from "anon";

revoke truncate on table "public"."vacation_records" from "anon";

revoke references on table "public"."volunteers" from "anon";

revoke trigger on table "public"."volunteers" from "anon";

revoke truncate on table "public"."volunteers" from "anon";


