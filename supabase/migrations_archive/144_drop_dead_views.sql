-- Auditoría db (docs/db-audit-2026-07-18.md) — hallazgo 🟢 §5.
-- Cuatro vistas sin ninguna referencia en el código (ni .from(), ni joins
-- embebidos, ni RPC, ni SQL de la app; solo aparecían en el database.ts
-- generado). Se eliminan antes del squash para que no queden en el esquema base.

DROP VIEW IF EXISTS public.vw_asistencia_mensual;
DROP VIEW IF EXISTS public.vw_asistencia_semanal;
DROP VIEW IF EXISTS public.vw_asistentes;
DROP VIEW IF EXISTS public.vw_resumen_financiero;
