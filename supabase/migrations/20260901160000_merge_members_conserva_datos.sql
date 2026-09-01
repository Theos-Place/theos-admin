-- merge_members: rescatar los datos personales antes de borrar el duplicado.
--
-- EL PROBLEMA. La función movía matrículas, pagos, roles y familia, pero de la
-- FICHA duplicada no rescataba NADA: la borraba entera. Si el correo, la
-- cédula, la dirección o el contacto de emergencia solo estaban en esa, se
-- perdían — y la ficha que sobrevivía quedaba peor que antes de fusionar.
--
-- Reportado con Ariana Chaves Duarte (2026-09-01): perdió correo, cédula,
-- provincia/cantón/distrito, dirección exacta, contacto de emergencia y su
-- CUENTA DE ACCESO. Había entrado esa misma mañana; después de la fusión su
-- cuenta quedó ligada a cero fichas, así que entraba y no veía nada. Se
-- recuperó del audit_log, que sí guarda `old_data` al borrar.
--
-- LA REGLA: se rellena solo lo que está VACÍO en la ficha que queda. Nunca se
-- pisa un dato existente — si las dos tenían algo distinto, el que sobrevive es
-- el que la persona eligió conservar al elegir cuál fusionar.
--
-- POR QUÉ DINÁMICO Y NO UNA LISTA DE COLUMNAS: el modo de fallar de una lista
-- escrita a mano es que alguien agregue una columna a `members` y no se acuerde
-- de tocar esta función; el dato se pierde en silencio y se nota meses después.
-- Acá se recorre information_schema y se excluye lo que NO se debe copiar, que
-- es una lista corta, estable y explícita.
CREATE OR REPLACE FUNCTION "public"."merge_members"("keep_id" "uuid", "dup_id" "uuid", "soft" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth uuid;
  v_cols text;
  v_dup  jsonb;
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

  -- ── LOS DATOS PERSONALES ──────────────────────────────────────────────────
  -- Se copian DESPUÉS de sacar del medio al duplicado, no antes. `members`
  -- tiene índices únicos —(document_type, cedula_normalized) y auth_user_id—
  -- y copiar la cédula mientras el duplicado todavía la tiene revienta con
  -- "already exists". Lo agarró la prueba con fichas de mentira antes de que
  -- llegara a producción.
  --
  -- Por eso primero se toma una foto de la fila en jsonb, después se borra (o
  -- se retira, en modo soft) y recién ahí se rellena lo que falta.
  SELECT to_jsonb(m) INTO v_dup FROM members m WHERE m.id = dup_id;
  v_auth := v_dup->>'auth_user_id';

  IF soft THEN
    -- En modo soft la fila queda, así que hay que soltarle igual lo único:
    -- si no, la ficha retirada sigue reservando la cédula y la cuenta.
    UPDATE members SET is_active = false, deactivation_reason = 'merged', deactivated_at = now(),
                       auth_user_id = NULL, cedula = NULL
      WHERE id = dup_id;
  ELSE
    DELETE FROM members WHERE id = dup_id;
  END IF;

  -- Rellena lo VACÍO en la que queda. Nunca pisa un dato existente: si las dos
  -- tenían algo distinto, el que sobrevive es el que alguien eligió conservar.
  --
  -- Se excluyen: la identidad de la fila, los derivados que Postgres recalcula
  -- (GENERATED), las marcas de baja —que son del duplicado, no de la que
  -- queda—, los tokens propios de cada ficha, y auth_user_id, que va con su
  -- propia guarda abajo.
  SELECT string_agg(
           format('%I = coalesce(k.%I, ($2->>%L)::%s)', column_name, column_name, column_name, udt_name),
           ', ')
    INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'members'
    AND is_generated <> 'ALWAYS'
    AND column_name <> ALL (ARRAY[
      'id', 'created_at', 'updated_at', 'external_id', 'auth_user_id',
      'smart_link_token', 'unsubscribe_token', 'wallet_pass_id', 'is_system',
      'is_active', 'deactivated_at', 'deactivated_by', 'deactivation_reason',
      'cedula_dup_legacy', 'field_updated_at'
    ]);
  IF v_cols IS NOT NULL THEN
    EXECUTE format('UPDATE members k SET %s, updated_at = now() WHERE k.id = $1', v_cols)
      USING keep_id, v_dup;
  END IF;

  -- La cuenta: solo si la que queda no tiene ninguna. Si ya tiene la suya se
  -- respeta, y la del duplicado se pierde con él — ahí hay dos cuentas reales y
  -- elegir por la persona sería peor.
  IF v_auth IS NOT NULL THEN
    UPDATE members SET auth_user_id = v_auth WHERE id = keep_id AND auth_user_id IS NULL;
  END IF;
END;
$$;
