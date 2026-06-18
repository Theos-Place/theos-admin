-- 1. Quitar la auditoría de event_checkins: es la tabla de mayor volumen y
--    auditar cada check-in con snapshot JSON infló audit_log hasta llenar el disco.
--    El dato de check-in ya vive en su propia tabla; no aporta auditarlo.
drop trigger if exists audit_event_checkins on event_checkins;

-- 2. Retención del audit_log: borra entradas con más de 90 días. Evita el
--    crecimiento sin techo (cambiar el intervalo si se quiere otra ventana).
create or replace function prune_audit_log()
returns void language sql as $$
  delete from audit_log where created_at < now() - interval '90 days';
$$;

-- 3. Cron diario (04:00) de retención.
select cron.schedule('prune-audit-log', '0 4 * * *', $$select prune_audit_log()$$);
