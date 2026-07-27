-- FEA-1: dedupe del correo form_asignado. Guarda la clave de la última
-- asignación notificada ('event:<uuid>' | 'study_group:<uuid>'): re-guardar el
-- formulario sin cambiar la asignación no reenvía; reasignarlo sí.

alter table "public"."forms" add column "assignment_notified_key" text;
