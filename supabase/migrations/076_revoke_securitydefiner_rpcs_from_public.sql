-- Los RPCs SECURITY DEFINER tenían EXECUTE concedido a PUBLIC (=X), por eso
-- anon/authenticated podían llamarlos vía /rest/v1/rpc. Revocar de PUBLIC cierra
-- la exposición; service_role conserva su grant (la app los llama por service role).
revoke execute on function public.donation_stats()           from public, anon, authenticated;
revoke execute on function public.payment_stats()            from public, anon, authenticated;
revoke execute on function public.study_dashboard_stats()    from public, anon, authenticated;
revoke execute on function public.study_dashboard_stats_v2() from public, anon, authenticated;
revoke execute on function public.campaign_student_counts()  from public, anon, authenticated;
revoke execute on function public.report_charla_attendance() from public, anon, authenticated;
