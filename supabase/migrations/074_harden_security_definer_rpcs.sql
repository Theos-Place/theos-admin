-- WARN del linter: RPCs SECURITY DEFINER ejecutables por anon/authenticated vía
-- PostgREST. La app los llama por service role; revocar el EXECUTE público quita
-- la exposición sin afectar al backend.
revoke execute on function public.donation_stats()          from anon, authenticated;
revoke execute on function public.payment_stats()           from anon, authenticated;
revoke execute on function public.study_dashboard_stats()   from anon, authenticated;
revoke execute on function public.study_dashboard_stats_v2() from anon, authenticated;
revoke execute on function public.campaign_student_counts() from anon, authenticated;

-- WARN: search_path mutable.
alter function public.charla_sede_code(text) set search_path = public;
