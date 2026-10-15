-- QA-3/N4 (2026-10-15) · Índices en las claves foráneas de las tablas que van
-- a crecer y que se filtran por esa columna.
--
-- Hoy ninguna pasa de unos cientos de filas, así que no cuesta nada medible;
-- se ponen ahora porque es cuando son baratos (crearlos sobre una tabla chica
-- es instantáneo) y porque un borrado en la tabla padre recorre la hija entera
-- si la FK no tiene índice. Las otras ~65 FK sin índice son columnas de
-- auditoría (`*_by`) por las que nadie filtra: no se indexan.

create index if not exists idx_support_tickets_member_id            on public.support_tickets (member_id);
create index if not exists idx_scholarships_plan_id                 on public.scholarships (plan_id);
create index if not exists idx_scholarship_redemptions_enrollment_id on public.scholarship_redemptions (enrollment_id);
create index if not exists idx_cdeb_recommendations_enrollment_id    on public.cdeb_recommendations (enrollment_id);
create index if not exists idx_study_requests_resolved_group_id      on public.study_requests (resolved_group_id);
create index if not exists idx_finance_requests_plan_id              on public.finance_requests (plan_id);
create index if not exists idx_finance_requests_event_id             on public.finance_requests (event_id);
