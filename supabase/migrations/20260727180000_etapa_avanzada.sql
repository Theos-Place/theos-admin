-- EST-5: nueva etapa "Avanzada". Reglas (decisión confirmada): mismos
-- compromisos que intermedia (donador + servidor + asistencia reforzada) Y
-- solo por invitación (mecanismo existente: study_plans.requires_invitation +
-- study_invitations). Se mueven CDEB, HER y CDC (hoy en etapa_intermedia).
-- OJO: study_plans.level es la ETAPA; study_plans.difficulty es otra cosa.

alter table "public"."study_plans" drop constraint "study_plans_level_check";
alter table "public"."study_plans" add constraint "study_plans_level_check"
  check ("level" = any (array['niveles'::text, 'etapa_inicial'::text, 'etapa_intermedia'::text, 'etapa_avanzada'::text, 'campanas'::text, 'externa'::text]));

update "public"."study_plans"
set "level" = 'etapa_avanzada', "requires_invitation" = true
where "code" in ('CDEB', 'HER', 'CDC');
