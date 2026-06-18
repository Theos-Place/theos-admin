-- ERROR del linter (rls_disabled_in_public): tabla pública sin RLS. Se accede solo
-- vía service role (createAdminClient); habilitar RLS sin policies la bloquea a
-- anon/authenticated sin romper la app.
alter table public.application_status_history enable row level security;

-- WARN: prune_audit_log tenía search_path mutable.
create or replace function prune_audit_log()
returns void language sql
set search_path = public
as $$
  delete from audit_log where created_at < now() - interval '90 days';
$$;

-- WARN: report_charla_attendance (SECURITY DEFINER) era ejecutable por anon/
-- authenticated vía PostgREST. La app lo llama por service role; revocar EXECUTE
-- público quita la exposición.
revoke execute on function public.report_charla_attendance() from anon, authenticated;
