-- 010: Normalizar politicas RLS para performance (lints 0003 y 0006).
-- 0003: auth.uid()/auth.role() envueltos en (select ...) -> se evaluan una vez.
-- 0006: una sola politica permisiva por accion y tabla (OR de las previas),
--       preservando el acceso exacto (Postgres ya las combinaba con OR).
-- Generado automaticamente desde pg_policies.

-- areas
DROP POLICY IF EXISTS "Admins gestionan areas" ON areas;
DROP POLICY IF EXISTS "Autenticados ven areas" ON areas;
CREATE POLICY "areas_select" ON areas FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "areas_insert" ON areas FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));
CREATE POLICY "areas_update" ON areas FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));
CREATE POLICY "areas_delete" ON areas FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));

-- audit_log
DROP POLICY IF EXISTS "Solo admins ven audit_log" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));

-- employee_documents
DROP POLICY IF EXISTS "Admins gestionan documentos empleados" ON employee_documents;
DROP POLICY IF EXISTS "Admins ven documentos empleados" ON employee_documents;
CREATE POLICY "employee_documents_select" ON employee_documents FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));
CREATE POLICY "employee_documents_insert" ON employee_documents FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));
CREATE POLICY "employee_documents_update" ON employee_documents FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));
CREATE POLICY "employee_documents_delete" ON employee_documents FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));

-- employees
DROP POLICY IF EXISTS "Admins gestionan empleados" ON employees;
DROP POLICY IF EXISTS "Admins ven empleados" ON employees;
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true))))) OR ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'finance'::text])) AND (mr.is_active = true))))));
CREATE POLICY "employees_insert" ON employees FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));
CREATE POLICY "employees_update" ON employees FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));
CREATE POLICY "employees_delete" ON employees FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));

-- event_checkins
DROP POLICY IF EXISTS "Admins gestionan checkins" ON event_checkins;
DROP POLICY IF EXISTS "Autenticados registran checkins" ON event_checkins;
DROP POLICY IF EXISTS "Autenticados ven checkins" ON event_checkins;
CREATE POLICY "event_checkins_select" ON event_checkins FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "event_checkins_insert" ON event_checkins FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "event_checkins_update" ON event_checkins FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "event_checkins_delete" ON event_checkins FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));

-- event_registrations
DROP POLICY IF EXISTS "Admins gestionan inscripciones" ON event_registrations;
DROP POLICY IF EXISTS "Autenticados se inscriben" ON event_registrations;
DROP POLICY IF EXISTS "Autenticados ven inscripciones" ON event_registrations;
CREATE POLICY "event_registrations_select" ON event_registrations FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "event_registrations_insert" ON event_registrations FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "event_registrations_update" ON event_registrations FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "event_registrations_delete" ON event_registrations FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));

-- event_types
DROP POLICY IF EXISTS "Admins gestionan tipos de evento" ON event_types;
DROP POLICY IF EXISTS "Autenticados ven tipos de evento" ON event_types;
CREATE POLICY "event_types_select" ON event_types FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "event_types_insert" ON event_types FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "event_types_update" ON event_types FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "event_types_delete" ON event_types FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));

-- event_volunteers
DROP POLICY IF EXISTS "Admins gestionan voluntarios de eventos" ON event_volunteers;
DROP POLICY IF EXISTS "Autenticados ven voluntarios de eventos" ON event_volunteers;
CREATE POLICY "event_volunteers_select" ON event_volunteers FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "event_volunteers_insert" ON event_volunteers FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "event_volunteers_update" ON event_volunteers FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "event_volunteers_delete" ON event_volunteers FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));

-- events
DROP POLICY IF EXISTS "Admins gestionan eventos" ON events;
DROP POLICY IF EXISTS "Autenticados ven eventos" ON events;
CREATE POLICY "events_select" ON events FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "events_insert" ON events FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "events_update" ON events FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "events_delete" ON events FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));

-- family_members
DROP POLICY IF EXISTS "Autenticados ven vínculos familiares" ON family_members;
CREATE POLICY "family_members_select" ON family_members FOR SELECT TO authenticated
  USING (((select auth.role()) = 'authenticated'::text));

-- family_units
DROP POLICY IF EXISTS "Autenticados ven familias" ON family_units;
CREATE POLICY "family_units_select" ON family_units FOR SELECT TO authenticated
  USING (((select auth.role()) = 'authenticated'::text));

-- family_unlink_requests
DROP POLICY IF EXISTS "Admins ven solicitudes de desvinculación" ON family_unlink_requests;
CREATE POLICY "family_unlink_requests_select" ON family_unlink_requests FOR SELECT TO authenticated
  USING (private.is_admin());

-- form_fields
DROP POLICY IF EXISTS "Admins gestionan campos" ON form_fields;
DROP POLICY IF EXISTS "Autenticados ven campos" ON form_fields;
CREATE POLICY "form_fields_select" ON form_fields FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "form_fields_insert" ON form_fields FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));
CREATE POLICY "form_fields_update" ON form_fields FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));
CREATE POLICY "form_fields_delete" ON form_fields FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));

-- form_response_values
DROP POLICY IF EXISTS "Autenticados insertan valores" ON form_response_values;
DROP POLICY IF EXISTS "Mismo acceso que form_responses" ON form_response_values;
CREATE POLICY "form_response_values_select" ON form_response_values FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM form_responses fr
  WHERE ((fr.id = form_response_values.response_id) AND ((fr.member_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM member_roles mr
          WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))))))));
CREATE POLICY "form_response_values_insert" ON form_response_values FOR INSERT TO authenticated
  WITH CHECK (((select auth.role()) = 'authenticated'::text));

-- form_responses
DROP POLICY IF EXISTS "Autenticados envían respuestas" ON form_responses;
DROP POLICY IF EXISTS "Miembros ven sus respuestas" ON form_responses;
CREATE POLICY "form_responses_select" ON form_responses FOR SELECT TO authenticated
  USING (((member_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true))))));
CREATE POLICY "form_responses_insert" ON form_responses FOR INSERT TO authenticated
  WITH CHECK (((select auth.role()) = 'authenticated'::text));

-- forms
DROP POLICY IF EXISTS "Admins gestionan formularios" ON forms;
DROP POLICY IF EXISTS "Autenticados ven formularios activos" ON forms;
CREATE POLICY "forms_select" ON forms FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true))))) OR (((is_active = true) AND ((is_public = true) OR ((select auth.role()) = 'authenticated'::text)))));
CREATE POLICY "forms_insert" ON forms FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));
CREATE POLICY "forms_update" ON forms FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));
CREATE POLICY "forms_delete" ON forms FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));

-- member_roles
DROP POLICY IF EXISTS "Admins gestionan roles" ON member_roles;
CREATE POLICY "member_roles_select" ON member_roles FOR SELECT TO authenticated
  USING (private.is_admin());
CREATE POLICY "member_roles_insert" ON member_roles FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "member_roles_update" ON member_roles FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());
CREATE POLICY "member_roles_delete" ON member_roles FOR DELETE TO authenticated
  USING (private.is_admin());

-- members
DROP POLICY IF EXISTS "Admins gestionan miembros" ON members;
DROP POLICY IF EXISTS "Autenticados ven miembros activos" ON members;
CREATE POLICY "members_select" ON members FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'editor_profiles'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "members_insert" ON members FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'editor_profiles'::text])) AND (mr.is_active = true)))));
CREATE POLICY "members_update" ON members FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'editor_profiles'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'editor_profiles'::text])) AND (mr.is_active = true)))));
CREATE POLICY "members_delete" ON members FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'editor_profiles'::text])) AND (mr.is_active = true)))));

-- message_broadcasts
DROP POLICY IF EXISTS "Comms gestiona broadcasts" ON message_broadcasts;
DROP POLICY IF EXISTS "Comms ve broadcasts" ON message_broadcasts;
CREATE POLICY "message_broadcasts_select" ON message_broadcasts FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));
CREATE POLICY "message_broadcasts_insert" ON message_broadcasts FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));
CREATE POLICY "message_broadcasts_update" ON message_broadcasts FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));
CREATE POLICY "message_broadcasts_delete" ON message_broadcasts FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));

-- message_logs
DROP POLICY IF EXISTS "Comms ve logs" ON message_logs;
CREATE POLICY "message_logs_select" ON message_logs FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));

-- message_templates
DROP POLICY IF EXISTS "Admins gestionan plantillas" ON message_templates;
DROP POLICY IF EXISTS "Autenticados ven plantillas" ON message_templates;
CREATE POLICY "message_templates_select" ON message_templates FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "message_templates_insert" ON message_templates FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));
CREATE POLICY "message_templates_update" ON message_templates FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));
CREATE POLICY "message_templates_delete" ON message_templates FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'comms'::text])) AND (mr.is_active = true)))));

-- payment_categories
DROP POLICY IF EXISTS "Admins gestionan categorías" ON payment_categories;
DROP POLICY IF EXISTS "Autenticados ven categorías" ON payment_categories;
CREATE POLICY "payment_categories_select" ON payment_categories FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "payment_categories_insert" ON payment_categories FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true)))));
CREATE POLICY "payment_categories_update" ON payment_categories FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true)))));
CREATE POLICY "payment_categories_delete" ON payment_categories FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true)))));

-- payments
DROP POLICY IF EXISTS "Finance registra pagos" ON payments;
DROP POLICY IF EXISTS "Finance ve todos los pagos" ON payments;
DROP POLICY IF EXISTS "Miembros ven sus pagos" ON payments;
DROP POLICY IF EXISTS "Finance actualiza pagos" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text, 'staff_leader'::text])) AND (mr.is_active = true))))) OR ((member_id = (select auth.uid()))));
CREATE POLICY "payments_insert" ON payments FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true)))));
CREATE POLICY "payments_update" ON payments FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true)))));

-- scholarships
DROP POLICY IF EXISTS "Finance gestiona becas" ON scholarships;
DROP POLICY IF EXISTS "Finance ve becas" ON scholarships;
CREATE POLICY "scholarships_select" ON scholarships FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true))))) OR ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text, 'staff_leader'::text])) AND (mr.is_active = true))))));
CREATE POLICY "scholarships_insert" ON scholarships FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true)))));
CREATE POLICY "scholarships_update" ON scholarships FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true)))));
CREATE POLICY "scholarships_delete" ON scholarships FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'finance'::text])) AND (mr.is_active = true)))));

-- sedes
DROP POLICY IF EXISTS "Admins gestionan sedes" ON sedes;
DROP POLICY IF EXISTS "Autenticados ven sedes" ON sedes;
CREATE POLICY "sedes_select" ON sedes FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'direccion'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "sedes_insert" ON sedes FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'direccion'::text])) AND (mr.is_active = true)))));
CREATE POLICY "sedes_update" ON sedes FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'direccion'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'direccion'::text])) AND (mr.is_active = true)))));
CREATE POLICY "sedes_delete" ON sedes FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'direccion'::text])) AND (mr.is_active = true)))));

-- service_positions
DROP POLICY IF EXISTS "Admins gestionan posiciones" ON service_positions;
DROP POLICY IF EXISTS "Autenticados ven posiciones" ON service_positions;
CREATE POLICY "service_positions_select" ON service_positions FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "service_positions_insert" ON service_positions FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));
CREATE POLICY "service_positions_update" ON service_positions FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));
CREATE POLICY "service_positions_delete" ON service_positions FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text])) AND (mr.is_active = true)))));

-- study_attendance
DROP POLICY IF EXISTS "Admins gestionan asistencia estudios" ON study_attendance;
DROP POLICY IF EXISTS "Autenticados ven asistencia estudios" ON study_attendance;
CREATE POLICY "study_attendance_select" ON study_attendance FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "study_attendance_insert" ON study_attendance FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "study_attendance_update" ON study_attendance FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "study_attendance_delete" ON study_attendance FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));

-- study_enrollments
DROP POLICY IF EXISTS "Admins gestionan inscripciones" ON study_enrollments;
DROP POLICY IF EXISTS "Miembros ven sus inscripciones" ON study_enrollments;
CREATE POLICY "study_enrollments_select" ON study_enrollments FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((member_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))));
CREATE POLICY "study_enrollments_insert" ON study_enrollments FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "study_enrollments_update" ON study_enrollments FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "study_enrollments_delete" ON study_enrollments FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));

-- study_groups
DROP POLICY IF EXISTS "Admins gestionan grupos" ON study_groups;
DROP POLICY IF EXISTS "Autenticados ven grupos" ON study_groups;
CREATE POLICY "study_groups_select" ON study_groups FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "study_groups_insert" ON study_groups FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "study_groups_update" ON study_groups FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "study_groups_delete" ON study_groups FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));

-- study_plans
DROP POLICY IF EXISTS "Admins gestionan planes" ON study_plans;
DROP POLICY IF EXISTS "Autenticados ven planes" ON study_plans;
CREATE POLICY "study_plans_select" ON study_plans FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "study_plans_insert" ON study_plans FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "study_plans_update" ON study_plans FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "study_plans_delete" ON study_plans FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));

-- study_sessions
DROP POLICY IF EXISTS "Admins gestionan sesiones" ON study_sessions;
DROP POLICY IF EXISTS "Autenticados ven sesiones" ON study_sessions;
CREATE POLICY "study_sessions_select" ON study_sessions FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "study_sessions_insert" ON study_sessions FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "study_sessions_update" ON study_sessions FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "study_sessions_delete" ON study_sessions FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));

-- sub_events
DROP POLICY IF EXISTS "Admins gestionan sub-eventos" ON sub_events;
DROP POLICY IF EXISTS "Autenticados ven sub-eventos" ON sub_events;
CREATE POLICY "sub_events_select" ON sub_events FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "sub_events_insert" ON sub_events FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "sub_events_update" ON sub_events FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));
CREATE POLICY "sub_events_delete" ON sub_events FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'director'::text])) AND (mr.is_active = true)))));

-- volunteers
DROP POLICY IF EXISTS "Admins gestionan voluntarios" ON volunteers;
DROP POLICY IF EXISTS "Autenticados ven voluntarios" ON volunteers;
CREATE POLICY "volunteers_select" ON volunteers FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'committee_leader'::text])) AND (mr.is_active = true))))) OR (((select auth.role()) = 'authenticated'::text)));
CREATE POLICY "volunteers_insert" ON volunteers FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'committee_leader'::text])) AND (mr.is_active = true)))));
CREATE POLICY "volunteers_update" ON volunteers FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'committee_leader'::text])) AND (mr.is_active = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'committee_leader'::text])) AND (mr.is_active = true)))));
CREATE POLICY "volunteers_delete" ON volunteers FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM member_roles mr
  WHERE ((mr.member_id = (select auth.uid())) AND (mr.role = ANY (ARRAY['admin'::text, 'staff_leader'::text, 'committee_leader'::text])) AND (mr.is_active = true)))));
