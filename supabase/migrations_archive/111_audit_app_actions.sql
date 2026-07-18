-- Auditoría app-level (revisión best practices 2026-07-13, hallazgo B4):
-- los triggers de la 001 registran actor_id = NULL porque todas las escrituras
-- van por service role (auth.uid() es NULL). La app ahora inserta registros de
-- auditoría explícitos con el auth user id del guard en las mutaciones
-- sensibles (roles, revisión de pagos, merges, exports del padrón).
-- Ampliamos el CHECK de action para las acciones de aplicación.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'REJECT', 'MERGE', 'ROLE_CHANGE', 'DEACTIVATE'));
