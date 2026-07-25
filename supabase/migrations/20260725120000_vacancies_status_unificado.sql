-- DEU-1: unifica vacancies.status al vocabulario del flujo de solicitud.
-- Antes convivían dos vocabularios en la misma columna: el legacy en inglés
-- (draft/published/filled/closed) y el del flujo de solicitud
-- (creado/enviado_lider/aprobado/denegado). El código ya trataba 'published'
-- como equivalente de 'aprobado' ("visible y aplicable").
--
-- Mapeo legacy → nuevo:
--   draft     → creado   (recién creada, sin revisar)
--   published → aprobado (visible y aplicable)
--   filled    → cerrada  (terminal: ya no acepta aplicaciones)
--   closed    → cerrada  (terminal: ya no acepta aplicaciones)
-- 'cerrada' es un estado NUEVO: el flujo de solicitud no tenía terminal de
-- cierre y la UI usaba el legacy 'closed' para eso.

update "public"."vacancies"
set "status" = case "status"
  when 'draft' then 'creado'
  when 'published' then 'aprobado'
  when 'filled' then 'cerrada'
  when 'closed' then 'cerrada'
  else "status"
end
where "status" in ('draft', 'published', 'filled', 'closed');

alter table "public"."vacancies" drop constraint "vacancies_status_check";
alter table "public"."vacancies" add constraint "vacancies_status_check"
  check ("status" = any (array['creado'::text, 'enviado_lider'::text, 'aprobado'::text, 'denegado'::text, 'cerrada'::text]));
