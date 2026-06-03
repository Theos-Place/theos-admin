-- 008: Resolver warnings del database linter de Supabase.

-- ── 0011: search_path mutable en funciones ──────────────────────────────────
-- Pinneamos search_path para que las funciones no dependan del search_path del
-- rol que las invoca (evita ataques de schema shadowing). Las referencias a
-- auth.uid() ya van calificadas, así que con `public` basta.
ALTER FUNCTION public.log_changes()       SET search_path = public;
ALTER FUNCTION public.set_updated_at()    SET search_path = public;
ALTER FUNCTION public.recalc_member_sede() SET search_path = public;

-- ── 0028 / 0029: log_changes (SECURITY DEFINER) ejecutable vía RPC ───────────
-- Es una función de trigger, nunca debe llamarse por /rest/v1/rpc. Revocamos
-- EXECUTE de los roles expuestos; los triggers siguen corriendo igual.
REVOKE EXECUTE ON FUNCTION public.log_changes() FROM PUBLIC, anon, authenticated;

-- ── 0014: extensión en schema public ────────────────────────────────────────
-- Movemos pg_trgm al schema `extensions` (ningún índice depende de ella aún).
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
