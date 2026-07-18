-- B8 (revisión best practices 2026-07-13): cierra la deuda histórica de
-- members sin UNIQUE en cédula (el 020/023 los botaron por data migrada con
-- repetidos; el dedup vivía SOLO en la app con TOCTOU abierto).
--
-- Al momento de esta migración solo quedan 2 cédulas duplicadas (2 filas
-- extra). Se marcan como legado (excluidas del índice) y el índice único
-- parcial protege TODO lo nuevo a nivel de BD; el 409 de la app pasa a ser
-- UX, no la única defensa. Limpieza pendiente: fusionar esos 2 pares desde
-- /miembros/duplicados y borrar el flag cuando quede en cero.

ALTER TABLE members ADD COLUMN IF NOT EXISTS cedula_dup_legacy BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN members.cedula_dup_legacy IS
  'Duplicado histórico de cédula anterior a la migración 114: excluido del índice único. Fusionar y limpiar.';

-- Marcar todos menos el canónico (el más antiguo) de cada grupo duplicado.
UPDATE members m SET cedula_dup_legacy = TRUE
WHERE cedula_normalized IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (cedula_normalized) id FROM members
    WHERE cedula_normalized IS NOT NULL
    ORDER BY cedula_normalized, created_at ASC, id ASC
  );

CREATE UNIQUE INDEX IF NOT EXISTS members_cedula_norm_uniq
  ON members (cedula_normalized)
  WHERE cedula_normalized IS NOT NULL AND NOT cedula_dup_legacy;
