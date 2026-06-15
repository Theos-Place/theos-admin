-- 063: DROP de tablas muertas. study_waitlist y relocation_requests quedaron
-- vacías tras la unificación de solicitudes (migración 042 → study_requests).
-- Verificado 2026-06-15: 0 filas, sin FKs entrantes, sin referencias en código vivo.
DROP TABLE IF EXISTS study_waitlist CASCADE;
DROP TABLE IF EXISTS relocation_requests CASCADE;
