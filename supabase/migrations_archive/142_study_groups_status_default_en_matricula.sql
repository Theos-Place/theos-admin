-- Auditoría db (docs/db-audit-2026-07-18.md) — hallazgo 🟡 §2.
-- La migración 052 renombró los estados de grupo a
-- ('en_matricula','en_curso','finalizado') y ajustó el CHECK, pero NO tocó el
-- DEFAULT de la columna, que quedó en 'pending_leader' (estado eliminado en 052).
-- Resultado: cualquier INSERT que omita `status` toma 'pending_leader' y viola
-- el propio CHECK → error en runtime. 'pending_leader' es un estado fantasma:
-- 0 filas lo usan y el código nunca lo escribe ni lo lee.
--
-- Corrección: default = 'en_matricula', el estado inicial real de un grupo
-- (según el propio comentario de la migración 052).

ALTER TABLE study_groups ALTER COLUMN status SET DEFAULT 'en_matricula';
