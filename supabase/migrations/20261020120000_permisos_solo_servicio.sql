-- SEC-4 · Las tablas de `public` solo se tocan con la llave de servicio.
--
-- POR QUÉ AHORA. Supabase avisó (2026-10-20) que desde el 30-oct-2026 deja de
-- dar permisos automáticos sobre las tablas NUEVAS de `public`. Toda la app
-- consulta desde el servidor con service_role, así que una tabla nueva sin su
-- GRANT daría «permission denied» en la pantalla que la use. La regla de
-- AGENTS.md («Tablas nuevas en public») y `permisos-de-tablas.test.ts` cubren
-- eso: cada migración que crea una tabla le da el permiso a service_role.
--
-- Esto se adelanta a lo que hará Supabase, pero en la dirección que
-- queremos: las tablas que se creen de acá en adelante ya no le dan nada a
-- `authenticated` (a `anon` ya no le daban). Las que existen no cambian, salvo
-- las 16 de abajo.
--
-- LAS 16. Tienen RLS sin políticas: nadie con la llave pública lee una fila,
-- ni con sesión. Pero el permiso de `authenticated` seguía ahí, y lo único
-- que lo frenaba era la RLS: una política abierta agregada por error las
-- habría dejado visibles. Se quita el permiso, que es la segunda cerradura.
-- Revisado antes de aplicar: ninguna se consulta desde el navegador, ninguna
-- política (tampoco las de Storage) ni vista las nombra.

-- `anon` también: en producción ya no estaba, pero staging lo conservaba
-- (medido con una tabla de prueba el 2026-10-20), y los dos ambientes tienen
-- que comportarse igual o la prueba en staging no prueba nada.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
-- Las FUNCIONES no se tocan acá. Su EXECUTE para PUBLIC es un default global
-- de Postgres que un default por esquema no puede quitar (probado en staging:
-- la función de prueba seguía abierta), y quitarlo globalmente cerraría
-- también las de `private` que evalúan las políticas de RLS. Las cubre la
-- regla SEC-3 de AGENTS.md y `scripts/sec3/auditar.cjs`.
-- service_role se queda con los suyos, explícitos para que no dependan de lo
-- que Supabase haga con los de ellos.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

revoke all on table
  public.cdeb_recommendations,
  public.form_response_reviews,
  public.prematrimonial_evaluations,
  public.report_snapshots,
  public.resources,
  public.sede_advance_budgets,
  public.sede_advance_expenses,
  public.sede_advances,
  public.support_ticket_status_history,
  public.support_tickets,
  public.travel_budget_items,
  public.travel_expenses,
  public.travel_mileage_legs,
  public.travel_report_files,
  public.travel_request_status_history,
  public.travel_requests
from anon, authenticated;
