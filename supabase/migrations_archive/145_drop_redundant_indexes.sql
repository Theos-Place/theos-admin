-- Auditoría db (docs/db-audit-2026-07-18.md) — hallazgo 🟢 §3.
-- Índices de una sola columna que son PREFIJO EXACTO de un índice compuesto o
-- único ya existente sobre la misma tabla. El compuesto sirve las mismas
-- consultas de la columna líder, así que el simple es redundante y solo suma
-- costo de escritura/espacio.
--
-- Nota (verificado con pg_stat_user_indexes al 2026-07-18): varios de estos
-- reciben muchos scans propios (el planner los elige por ser más chicos);
-- tras el drop esas consultas pasan al índice compuesto sin pérdida de
-- corrección. El impacto de rendimiento es marginal en estos volúmenes.
-- Ninguno de los eliminados es UNIQUE ni parcial (esos se conservan).

DROP INDEX IF EXISTS public.idx_applications_vacancy;        -- (vacancy_id) ⊂ applications_vacancy_id_applicant_id_key
DROP INDEX IF EXISTS public.idx_checkins_member;             -- (member_id) ⊂ (member_id, checked_in_at DESC) / uniq (member_id,event_id)
DROP INDEX IF EXISTS public.event_exceptions_parent_idx;     -- (parent_event_id) ⊂ event_exceptions_parent_event_id_exception_date_key
DROP INDEX IF EXISTS public.idx_event_registrations_event;   -- (event_id) ⊂ event_registrations_event_id_member_id_key
DROP INDEX IF EXISTS public.idx_event_volunteers_event;      -- (event_id) ⊂ event_volunteers_event_id_member_id_key
DROP INDEX IF EXISTS public.idx_family_members_unit;         -- (family_unit_id) ⊂ family_members_family_unit_id_member_id_key
DROP INDEX IF EXISTS public.idx_form_fields_form;            -- (form_id) ⊂ idx_form_fields_order (form_id, sort_order)
DROP INDEX IF EXISTS public.idx_role_grants_member_role;     -- (member_id, role) ⊂ member_role_position_grants_member_id_role_position_id_key
DROP INDEX IF EXISTS public.idx_member_roles_member;         -- (member_id) ⊂ member_roles_member_id_role_key / idx_member_roles_active
DROP INDEX IF EXISTS public.idx_member_roles_role;           -- (role) ⊂ idx_member_roles_status_detail (role, status_detail)
DROP INDEX IF EXISTS public.idx_message_logs_broadcast;      -- (broadcast_id) ⊂ idx_message_logs_broadcast_status
DROP INDEX IF EXISTS public.idx_message_logs_status;         -- (status) ⊂ idx_message_logs_queue (status, scheduled_date, channel)
DROP INDEX IF EXISTS public.idx_study_attendance_session;    -- (session_id) ⊂ study_attendance_session_id_member_id_key
DROP INDEX IF EXISTS public.idx_enrollments_group;           -- (group_id) ⊂ study_enrollments_group_id_member_id_key
DROP INDEX IF EXISTS public.idx_study_groups_plan;           -- (plan_id) ⊂ study_groups_sucesor_uniq (plan_id, leader_id, ...)
DROP INDEX IF EXISTS public.study_invitations_member_idx;    -- (member_id) ⊂ study_invitations_active_uq (member_id, plan_id)
DROP INDEX IF EXISTS public.idx_volunteers_member;           -- (member_id) ⊂ volunteers_member_id_position_id_key
