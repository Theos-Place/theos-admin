-- Permite registrar estudios en el histórico de un miembro aunque no hayan sido
-- parte de un grupo del sistema (estudios viejos, cuando la plataforma no existía).
-- group_id pasa a ser opcional y se agrega plan_id directo en la inscripción.

alter table study_enrollments alter column group_id drop not null;

alter table study_enrollments add column if not exists plan_id uuid;

alter table study_enrollments
  add constraint study_enrollments_plan_id_fkey
  foreign key (plan_id) references study_plans(id);
