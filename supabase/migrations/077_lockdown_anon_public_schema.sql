-- Nada del schema public es accesible por usuarios SIN login (anon). Toda la data
-- de la app va por API routes con service role; la anon key del navegador se usa
-- solo para auth (schema auth, no afectado). El calendario público y los embeds
-- leen por /api/public/events (ruta Next pública con service role), no por Supabase
-- anon. 'authenticated' no se toca (sigue gateado por RLS).
revoke all privileges on all tables    in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all routines  in schema public from anon;
revoke usage on schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on routines  from anon;
