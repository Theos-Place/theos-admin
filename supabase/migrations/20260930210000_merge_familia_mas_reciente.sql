-- La fusión ya no se traba cuando las dos fichas están en familias distintas.
--
-- `family_members` tiene índice único sobre `member_id` SOLO, pero la función
-- limpiaba el choque únicamente cuando las dos fichas compartían familia. Con
-- familias distintas la fusión moría con «duplicate key value violates unique
-- constraint "family_members_member_id_key"» — un error de base de datos en
-- bruto, en la cara de quien fusiona, sin pista de qué hacer.
--
-- Encontrado el 2026-09-30 con dos fichas de Liam Salazar Calderon (7 años),
-- que no se dejaban fusionar en ninguna de las dos direcciones.
--
-- Son 2 pares en todo el padrón, así que el problema es chico; lo que no era
-- chico es que no hubiera forma de saber por qué.
--
CREATE OR REPLACE FUNCTION public.merge_members(keep_id uuid, dup_id uuid, soft boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth uuid;
  v_cols text;
  v_dup  jsonb;
BEGIN
  IF keep_id = dup_id THEN RAISE EXCEPTION 'No se puede fusionar un miembro consigo mismo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM members WHERE id = keep_id) THEN RAISE EXCEPTION 'Miembro a conservar no existe'; END IF;
  IF NOT EXISTS (SELECT 1 FROM members WHERE id = dup_id) THEN RAISE EXCEPTION 'Miembro duplicado no existe'; END IF;

  -- Un prematrimonial con las dos fichas como pareja no se puede fusionar sin
  -- inventar algo: quedaría alguien casándose consigo mismo. Se corta y que lo
  -- mire una persona — borrar la solicitud en silencio sería peor.
  IF EXISTS (
    SELECT 1 FROM prematrimonial_requests
    WHERE (requester_member_id = keep_id AND spouse_member_id = dup_id)
       OR (requester_member_id = dup_id AND spouse_member_id = keep_id)
  ) THEN
    RAISE EXCEPTION 'Estas dos fichas son la pareja de una solicitud prematrimonial: resolvé esa solicitud antes de fusionarlas';
  END IF;

  -- ── EXCEPCIÓN: cuando las dos filas NO dicen lo mismo ─────────────────────
  -- El comentario de arriba vale para un check-in o una inscripción, donde la
  -- fila repetida es el mismo hecho dos veces. NO vale para un puesto ni para
  -- un rol: ahí las dos filas guardan ESTADOS distintos, y descartar la del
  -- duplicado a ciegas tira el estado vivo y deja el muerto.
  --
  -- CASO REAL (Silvia Chavarría, 2026-09-30): las dos fichas tenían los mismos
  -- dos puestos. La principal los tenía `inactive` desde el 12-set; la
  -- duplicada, `active` desde el 11-set. La fusión borró las vivas y conservó
  -- las terminadas, así que la persona salió de la fusión sin puesto de
  -- servicio — sirviendo en la realidad y dada de baja en el sistema. Y es
  -- silencioso: la fusión no falla, solo deja menos de lo que había.
  --
  -- Se rescata ANTES de borrar —y antes de TODO el bloque de borrados, no
  -- pegado al de su tabla—: `member_roles` se borra una línea antes que
  -- `volunteers`, así que un rescate puesto en el medio llega tarde para los
  -- roles y a tiempo para los puestos. Lo encontró la prueba de staging, que
  -- pasaba la mitad.
  --
  -- Sin esto el índice único (member_id, position_id) no deja mover la fila
  -- del duplicado, y no hay dónde guardar el dato.
  UPDATE volunteers k
     SET status     = a.status,
         start_date = a.start_date,
         end_date   = a.end_date,
         notes      = coalesce(k.notes, a.notes),
         updated_at = now()
    FROM volunteers a
   WHERE a.member_id = dup_id
     AND k.member_id = keep_id
     AND k.position_id = a.position_id
     AND a.status = 'active'
     AND k.status <> 'active';

  -- Mismo problema en los roles: si el duplicado tiene el rol ACTIVO y la
  -- principal lo tiene revocado, el borrado se lleva el acceso. Un rol que
  -- vino de un puesto lo repone la sincronización; uno dado a mano, no vuelve
  -- nunca y nadie se entera hasta que la persona no puede entrar.
  UPDATE member_roles k
     SET is_active     = true,
         granted_at    = a.granted_at,
         granted_by    = a.granted_by,
         revoked_at    = NULL,
         revoked_by    = NULL,
         status_detail = a.status_detail,
         origen        = a.origen
    FROM member_roles a
   WHERE a.member_id = dup_id
     AND k.member_id = keep_id
     AND k.role = a.role
     AND a.is_active
     AND NOT k.is_active;

  -- ── Choques de índice único: se descarta la fila del DUPLICADO ─────────────
  -- Cuando las dos fichas tienen la misma (persona, cosa) no hay nada que
  -- rescatar: es literalmente el mismo hecho registrado dos veces.
  DELETE FROM applications a WHERE a.applicant_id = dup_id AND EXISTS (SELECT 1 FROM applications k WHERE k.applicant_id = keep_id AND k.vacancy_id = a.vacancy_id);
  -- ── LA FAMILIA: gana el vínculo MÁS RECIENTE ──────────────────────────────
  -- El índice único de family_members es sobre `member_id` SOLO —cada persona
  -- va en una familia y nada más—, pero la línea que esto reemplaza limpiaba
  -- el choque solo cuando las dos fichas estaban en LA MISMA familia. En
  -- familias distintas no borraba nada, y el UPDATE de más abajo reventaba
  -- con un 23505 crudo que no le dice a nadie qué hacer.
  --
  -- Decisión de Floriana (2026-09-30): se queda el vínculo más nuevo, sin
  -- preguntar. Se mide por `family_members.created_at` —cuándo se registró el
  -- vínculo— y no por la fecha de la ficha: lo que importa es cuándo se supo
  -- de esa familia, no cuándo nació el registro de la persona.
  --
  -- Comprobado contra los dos únicos casos trabados del padrón: en Liam
  -- Salazar Calderon la regla elige Familia Avendano Calderon (vínculo del
  -- 15-set) sobre Calderon Cordero (8-jun), que es la misma familia que ella
  -- eligió a mano. En Patricia Zamora Vargas elige Familia Solís, y ESE caso
  -- la regla no lo resuelve bien —las dos familias contienen al mismo Jimmy
  -- Solís Campos, o sea que el hogar está cargado dos veces y lo que hay que
  -- arreglar son las familias, no la fusión—. Queda anotado porque la regla
  -- es cómoda, no infalible.
  DELETE FROM family_members a USING family_members k
   WHERE a.member_id = dup_id AND k.member_id = keep_id
     AND a.created_at <= k.created_at;   -- empate: se queda la principal
  DELETE FROM family_members k USING family_members a
   WHERE k.member_id = keep_id AND a.member_id = dup_id
     AND a.created_at > k.created_at;    -- el vínculo vivo lo trae el duplicado
  DELETE FROM member_roles a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM member_roles k WHERE k.member_id = keep_id AND k.role = a.role);
  DELETE FROM volunteers a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM volunteers k WHERE k.member_id = keep_id AND k.position_id = a.position_id);
  DELETE FROM event_volunteers a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM event_volunteers k WHERE k.member_id = keep_id AND k.event_id = a.event_id);
  DELETE FROM event_registrations a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM event_registrations k WHERE k.member_id = keep_id AND k.event_id = a.event_id);
  DELETE FROM event_checkins a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM event_checkins k WHERE k.member_id = keep_id AND k.event_id = a.event_id);
  DELETE FROM study_enrollments a WHERE a.member_id = dup_id AND a.group_id IS NOT NULL AND EXISTS (SELECT 1 FROM study_enrollments k WHERE k.member_id = keep_id AND k.group_id = a.group_id);
  DELETE FROM study_attendance a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM study_attendance k WHERE k.member_id = keep_id AND k.session_id = a.session_id);
  DELETE FROM study_leaders a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM study_leaders k WHERE k.member_id = keep_id);
  -- Nuevos (2026-09-08):
  DELETE FROM birthday_greetings a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM birthday_greetings k WHERE k.member_id = keep_id AND k.year = a.year);
  DELETE FROM cdeb_recommendations a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM cdeb_recommendations k WHERE k.member_id = keep_id AND k.group_id = a.group_id);
  DELETE FROM event_managers a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM event_managers k WHERE k.member_id = keep_id AND k.event_id = a.event_id);
  DELETE FROM form_access_grants a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM form_access_grants k WHERE k.member_id = keep_id AND k.form_id = a.form_id);
  DELETE FROM leader_evaluations a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM leader_evaluations k WHERE k.member_id = keep_id AND k.group_id = a.group_id);
  DELETE FROM member_role_position_grants a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM member_role_position_grants k WHERE k.member_id = keep_id AND k.role = a.role AND k.position_id = a.position_id);
  DELETE FROM notice_dismissals a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM notice_dismissals k WHERE k.member_id = keep_id AND k.notice_key = a.notice_key);
  DELETE FROM scholarship_redemptions a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM scholarship_redemptions k WHERE k.member_id = keep_id AND k.scholarship_id = a.scholarship_id);
  DELETE FROM study_invitations a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM study_invitations k WHERE k.member_id = keep_id AND k.plan_id = a.plan_id);
  DELETE FROM study_requirement_exceptions a WHERE a.member_id = dup_id AND EXISTS (SELECT 1 FROM study_requirement_exceptions k WHERE k.member_id = keep_id AND k.plan_id = a.plan_id);

  -- ── De quién ES cada fila (columnas de SUJETO) ─────────────────────────────
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
  -- Nuevos (2026-09-08):
  UPDATE birthday_greetings          SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE cdeb_recommendations        SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE event_managers              SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE finance_requests            SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE folleto_requests            SET target_leader_id = keep_id WHERE target_leader_id = dup_id;
  UPDATE form_access_grants          SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE internal_notifications      SET recipient_member_id = keep_id WHERE recipient_member_id = dup_id;
  UPDATE leader_evaluations          SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE leader_evaluations          SET co_leader_id = keep_id WHERE co_leader_id = dup_id;
  UPDATE leader_evaluations          SET co_leader_id = NULL WHERE co_leader_id = member_id;
  UPDATE member_recommendations      SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE member_role_position_grants SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE notice_dismissals           SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE payment_plans               SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE prematrimonial_requests     SET requester_member_id = keep_id WHERE requester_member_id = dup_id;
  UPDATE prematrimonial_requests     SET spouse_member_id = keep_id WHERE spouse_member_id = dup_id;
  UPDATE refund_comments             SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE scholarship_redemptions     SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE study_invitations           SET member_id = keep_id WHERE member_id = dup_id;
  UPDATE study_requirement_exceptions SET member_id = keep_id WHERE member_id = dup_id;

  -- Una fila por persona: se rellenan huecos en vez de perder la de alguna.
  PERFORM merge_one_to_one('member_admin_data', keep_id, dup_id);
  PERFORM merge_one_to_one('member_spiritual_data', keep_id, dup_id);
  PERFORM merge_one_to_one('member_notification_prefs', keep_id, dup_id);

  -- Descartes de duplicados: la pareja (a,b) se colapsa. Primero se reasigna,
  -- después se limpia lo que quedó apuntándose a sí mismo o repetido.
  UPDATE duplicate_dismissals SET member_a = keep_id WHERE member_a = dup_id;
  UPDATE duplicate_dismissals SET member_b = keep_id WHERE member_b = dup_id;
  DELETE FROM duplicate_dismissals WHERE member_a = member_b;
  DELETE FROM duplicate_dismissals a USING duplicate_dismissals k
    WHERE a.ctid > k.ctid AND a.member_a = k.member_a AND a.member_b = k.member_b;

  -- ── Quién HIZO cada cosa (columnas de ACTOR) ───────────────────────────────
  -- Es la misma persona: si no se reasignan, la firma queda en NULL y el
  -- historial pierde el autor.
  UPDATE areas                  SET leader_id = keep_id WHERE leader_id = dup_id;
  UPDATE study_groups           SET leader_id = keep_id WHERE leader_id = dup_id;
  UPDATE study_groups           SET co_leader_id = keep_id WHERE co_leader_id = dup_id;
  UPDATE study_groups           SET co_leader_id = NULL WHERE co_leader_id = leader_id;
  UPDATE study_groups           SET feedback_released_by = keep_id WHERE feedback_released_by = dup_id;
  UPDATE study_plans            SET mentor_id = keep_id WHERE mentor_id = dup_id;
  UPDATE member_lists           SET created_by = keep_id WHERE created_by = dup_id;
  UPDATE member_roles           SET granted_by = keep_id WHERE granted_by = dup_id;
  UPDATE family_members         SET linked_by = keep_id WHERE linked_by = dup_id;
  -- Nuevos (2026-09-08):
  UPDATE applications                    SET assigned_to = keep_id WHERE assigned_to = dup_id;
  UPDATE cdeb_recommendations            SET filled_by = keep_id WHERE filled_by = dup_id;
  UPDATE evaluation_ticket_status_history SET changed_by = keep_id WHERE changed_by = dup_id;
  UPDATE evaluation_tickets              SET reviewed_by = keep_id WHERE reviewed_by = dup_id;
  UPDATE evaluation_tickets              SET sent_by = keep_id WHERE sent_by = dup_id;
  UPDATE event_managers                  SET granted_by = keep_id WHERE granted_by = dup_id;
  UPDATE event_registrations             SET recorded_by = keep_id WHERE recorded_by = dup_id;
  UPDATE finance_request_status_history  SET changed_by = keep_id WHERE changed_by = dup_id;
  UPDATE finance_requests                SET recorded_by = keep_id WHERE recorded_by = dup_id;
  UPDATE finance_requests                SET reviewed_by = keep_id WHERE reviewed_by = dup_id;
  UPDATE folleto_requests                SET confirmed_by = keep_id WHERE confirmed_by = dup_id;
  UPDATE form_access_grants              SET granted_by = keep_id WHERE granted_by = dup_id;
  UPDATE form_response_reviews           SET reviewed_by = keep_id WHERE reviewed_by = dup_id;
  UPDATE form_responses                  SET recorded_by = keep_id WHERE recorded_by = dup_id;
  UPDATE leader_evaluations              SET hidden_by = keep_id WHERE hidden_by = dup_id;
  UPDATE member_admin_data               SET authorized_virtual_studies_by = keep_id WHERE authorized_virtual_studies_by = dup_id;
  UPDATE member_admin_data               SET not_recommended_to_lead_studies_by = keep_id WHERE not_recommended_to_lead_studies_by = dup_id;
  UPDATE member_admin_data               SET servers_onboarding_by = keep_id WHERE servers_onboarding_by = dup_id;
  UPDATE member_recommendations          SET recommended_by = keep_id WHERE recommended_by = dup_id;
  UPDATE payment_plans                   SET created_by = keep_id WHERE created_by = dup_id;
  UPDATE payments                        SET reviewed_by = keep_id WHERE reviewed_by = dup_id;
  UPDATE position_requests               SET requested_by = keep_id WHERE requested_by = dup_id;
  UPDATE position_requests               SET reviewed_by = keep_id WHERE reviewed_by = dup_id;
  UPDATE prematrimonial_evaluations      SET filled_by = keep_id WHERE filled_by = dup_id;
  UPDATE prematrimonial_request_status_history SET changed_by = keep_id WHERE changed_by = dup_id;
  UPDATE prematrimonial_requests         SET canceled_by = keep_id WHERE canceled_by = dup_id;
  UPDATE prematrimonial_requests         SET created_by = keep_id WHERE created_by = dup_id;
  UPDATE prematrimonial_requests         SET reviewed_by = keep_id WHERE reviewed_by = dup_id;
  UPDATE study_enrollments               SET recorded_by = keep_id WHERE recorded_by = dup_id;
  UPDATE study_invitations               SET invited_by = keep_id WHERE invited_by = dup_id;
  UPDATE study_request_status_history    SET changed_by = keep_id WHERE changed_by = dup_id;
  UPDATE study_requests                  SET recorded_by = keep_id WHERE recorded_by = dup_id;
  UPDATE study_requests                  SET reviewed_by = keep_id WHERE reviewed_by = dup_id;
  UPDATE study_requirement_exceptions    SET granted_by = keep_id WHERE granted_by = dup_id;

  -- ── LOS DATOS PERSONALES ──────────────────────────────────────────────────
  -- Se copian DESPUÉS de sacar del medio al duplicado, no antes. `members`
  -- tiene índices únicos —(document_type, cedula_normalized) y auth_user_id—
  -- y copiar la cédula mientras el duplicado todavía la tiene revienta con
  -- "already exists".
  SELECT to_jsonb(m) INTO v_dup FROM members m WHERE m.id = dup_id;
  v_auth := v_dup->>'auth_user_id';

  IF soft THEN
    UPDATE members SET is_active = false, deactivation_reason = 'merged', deactivated_at = now(),
                       auth_user_id = NULL, cedula = NULL
      WHERE id = dup_id;
  ELSE
    DELETE FROM members WHERE id = dup_id;
  END IF;

  -- Rellena lo VACÍO en la que queda. Nunca pisa un dato existente.
  SELECT string_agg(
           format('%I = coalesce(k.%I, ($2->>%L)::%s)', column_name, column_name, column_name, udt_name),
           ', ')
    INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'members'
    AND is_generated <> 'ALWAYS'
    -- La lista vive en merge_no_copia() para que la use también
    -- merge_members_resuelto y no se separen nunca. Agrega los ESPEJOS
    -- (last_sign_in_at, estado de correo, sede calculada): copiarlos del
    -- duplicado deja una ficha afirmando cosas de una cuenta que no es la suya.
    AND column_name <> ALL (merge_no_copia() || ARRAY['is_system','cedula_dup_legacy','field_updated_at']);
  IF v_cols IS NOT NULL THEN
    EXECUTE format('UPDATE members k SET %s, updated_at = now() WHERE k.id = $1', v_cols)
      USING keep_id, v_dup;
  END IF;

  IF v_auth IS NOT NULL THEN
    UPDATE members SET auth_user_id = v_auth WHERE id = keep_id AND auth_user_id IS NULL;
  END IF;
END;
$function$;
