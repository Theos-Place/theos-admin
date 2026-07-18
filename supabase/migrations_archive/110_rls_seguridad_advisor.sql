-- Advisor de seguridad de Supabase (2026-07-06): dos tablas nuevas quedaron sin
-- RLS (creadas en 104/107 sin el enable que llevan las demás). Toda la app
-- consulta con service role (salta RLS) y la anon key del navegador solo hace
-- Auth, así que RLS deny-by-default (sin políticas) es el estado correcto:
-- bloquea el acceso directo vía PostgREST con la anon key del bundle.
alter table public.folleto_requests enable row level security;
alter table public.capacitacion_bloques enable row level security;

-- Función de trigger (auth.users → members): SECURITY DEFINER y ejecutable vía
-- /rest/v1/rpc por anon/authenticated. Nadie debe poder llamarla directo; el
-- trigger no necesita estos grants.
revoke execute on function public.sync_member_account_confirmed() from public, anon, authenticated;

-- RPCs internas: solo las llama el servidor con service role.
revoke execute on function public.approve_applications(uuid[]) from public, anon, authenticated;
revoke execute on function public.block_folletos_by_sede(date) from public, anon, authenticated;

-- Linter 0011: search_path fijo para que un search_path manipulado no pueda
-- redirigir las referencias de tabla de la función.
alter function public.approve_applications(uuid[]) set search_path = public;
alter function public.block_folletos_by_sede(date) set search_path = public;
