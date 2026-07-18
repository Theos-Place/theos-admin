-- 011: Índices que cubren las foreign keys sin índice (lint 0001).
-- Sin un índice sobre la columna FK, los DELETE/UPDATE en la tabla padre
-- obligan a un seq scan de la tabla hija. Estos índices lo evitan.
--
-- NOTA: el lint 0005 (unused_index) NO se atiende: marca índices "sin uso"
-- solo porque la base está vacía y no hay estadísticas de query todavía.
-- Se revisa cuando haya tráfico real, no antes.

CREATE INDEX IF NOT EXISTS idx_employee_documents_uploaded_by   ON employee_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_employees_created_by             ON employees(created_by);
CREATE INDEX IF NOT EXISTS idx_event_checkins_checked_in_by     ON event_checkins(checked_in_by);
CREATE INDEX IF NOT EXISTS idx_event_checkins_sub_event         ON event_checkins(sub_event_id);
CREATE INDEX IF NOT EXISTS idx_event_volunteers_assigned_by     ON event_volunteers(assigned_by);
CREATE INDEX IF NOT EXISTS idx_events_created_by                ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_family_members_linked_by         ON family_members(linked_by);
CREATE INDEX IF NOT EXISTS idx_family_unlink_requests_unit      ON family_unlink_requests(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_family_unlink_requests_processed ON family_unlink_requests(processed_by);
CREATE INDEX IF NOT EXISTS idx_family_unlink_requests_requester ON family_unlink_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_forms_created_by                 ON forms(created_by);
CREATE INDEX IF NOT EXISTS idx_member_roles_granted_by          ON member_roles(granted_by);
CREATE INDEX IF NOT EXISTS idx_member_roles_revoked_by          ON member_roles(revoked_by);
CREATE INDEX IF NOT EXISTS idx_members_auth_user                ON members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_message_broadcasts_created_by    ON message_broadcasts(created_by);
CREATE INDEX IF NOT EXISTS idx_message_broadcasts_template      ON message_broadcasts(template_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_created_by     ON message_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_payments_event                   ON payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by             ON payments(recorded_by);
CREATE INDEX IF NOT EXISTS idx_payments_study_group             ON payments(study_group_id);
CREATE INDEX IF NOT EXISTS idx_scholarships_approved_by         ON scholarships(approved_by);
CREATE INDEX IF NOT EXISTS idx_scholarships_study_group         ON scholarships(study_group_id);
CREATE INDEX IF NOT EXISTS idx_study_attendance_recorded_by     ON study_attendance(recorded_by);
CREATE INDEX IF NOT EXISTS idx_study_enrollments_transferred    ON study_enrollments(transferred_to);
CREATE INDEX IF NOT EXISTS idx_study_plans_mentor               ON study_plans(mentor_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_created_by        ON study_sessions(created_by);
