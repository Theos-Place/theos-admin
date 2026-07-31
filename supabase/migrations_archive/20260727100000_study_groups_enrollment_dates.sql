-- GRU-1: período de matrícula por grupo. La ventana controla cuándo el grupo
-- acepta matrículas (elegibilidad + guard de enrollMember); el cron diario
-- group-enrollment-windows pasa a 'en_curso' los grupos cuya ventana venció y
-- cuya fecha de inicio ya llegó. Nullable: sin fechas, el grupo se comporta
-- como siempre (modo manual).

alter table "public"."study_groups" add column "enrollment_start_date" date;
alter table "public"."study_groups" add column "enrollment_end_date" date;
