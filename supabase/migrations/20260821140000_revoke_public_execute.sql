-- Advisors de Supabase (2026-08-21) — lints 0028/0029:
-- "Public/Signed-In Users Can Execute SECURITY DEFINER Function" en
-- forms_detach_on_parent_delete, forms_validate_entity y
-- sync_member_account_confirmed_on_link.
--
-- CAUSA RAÍZ: Postgres le da EXECUTE a PUBLIC por defecto a toda función nueva.
-- El baseline consolidado emparejaba, para CADA función, un
-- `REVOKE ALL ... FROM PUBLIC` con el `GRANT ALL ... TO service_role`; a estas
-- tres se les escribió el GRANT pero se les OLVIDÓ el REVOKE (ver
-- 20260730193000_baseline_consolidado.sql líneas 7034, 7038 y 7171: hay GRANT
-- sin su REVOKE). Por eso quedaron accesibles a anon/authenticated.
--
-- Al revisar la BD aparecieron 3 más con el mismo grant sobrante que el advisor
-- NO marca porque son SECURITY INVOKER. Se limpian igual: la convención del
-- proyecto es que TODO pasa por rutas API con service role (AGENTS.md), así que
-- ninguna función de public/ debe ser invocable con la llave anon.
--
-- Por qué es seguro:
--   · Las 4 primeras son funciones de trigger (RETURNS trigger). Postgres exige
--     EXECUTE al CREAR el trigger, no cada vez que dispara, así que los triggers
--     siguen funcionando igual. Vía RPC nunca fueron útiles: PostgREST no expone
--     funciones de trigger y llamarlas directo revienta con "trigger functions
--     can only be called as trigger triggers".
--   · dashboard_sums y block_folletos_detail sí son RPCs de verdad, pero sus
--     únicos llamadores son queries/dashboard.ts y queries/bloques.ts (esta
--     última marcada 'server-only'), ambas sobre createAdminClient() =
--     service_role, que conserva el GRANT.
--
-- NO se toca public.immutable_unaccent(text), que arrastra el mismo grant: es un
-- helper de texto puro (sin acceso a datos, nada que escalar con SECURITY
-- INVOKER) y alimenta la columna generada members.search_text, que se evalúa en
-- cada INSERT/UPDATE con los privilegios de quien escribe. Revocarlo es riesgo
-- sin ganancia.

-- Funciones de trigger.
REVOKE ALL ON FUNCTION public.forms_detach_on_parent_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.forms_validate_entity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_member_account_confirmed_on_link() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_group_bloque() FROM PUBLIC;

-- RPCs que solo se llaman con service_role desde el servidor.
REVOKE ALL ON FUNCTION public.dashboard_sums(p_month_start timestamp with time zone, p_month_start_date date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_folletos_detail(p_apertura date) FROM PUBLIC;

-- dashboard_sums además tenía grants EXPLÍCITOS a anon y authenticated, puestos
-- en 20260806240000_multimoneda_agregados.sql al recrearla ("TO anon,
-- authenticated, service_role" — el boilerplate de Supabase, no una decisión).
-- Un REVOKE FROM PUBLIC no los quita, hay que nombrar los roles.
-- Hoy no hay fuga: llamarla con la llave anon devuelve 401 / "permission denied
-- for table payments", porque anon no tiene SELECT en las tablas que lee. Pero
-- deja el ingreso del mes a un GRANT de distancia, y su único llamador es
-- queries/dashboard.ts sobre createAdminClient().
REVOKE ALL ON FUNCTION public.dashboard_sums(p_month_start timestamp with time zone, p_month_start_date date) FROM anon, authenticated;

-- El GRANT a service_role ya existe en el baseline para las seis; se reafirma
-- para que esta migración quede autocontenida si alguien la corre sobre una BD
-- reconstruida.
GRANT ALL ON FUNCTION public.forms_detach_on_parent_delete() TO service_role;
GRANT ALL ON FUNCTION public.forms_validate_entity() TO service_role;
GRANT ALL ON FUNCTION public.sync_member_account_confirmed_on_link() TO service_role;
GRANT ALL ON FUNCTION public.assign_group_bloque() TO service_role;
GRANT ALL ON FUNCTION public.dashboard_sums(p_month_start timestamp with time zone, p_month_start_date date) TO service_role;
GRANT ALL ON FUNCTION public.block_folletos_detail(p_apertura date) TO service_role;
