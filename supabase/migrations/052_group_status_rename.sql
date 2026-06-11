-- Nuevos estados de grupo: en_matricula (antes 'open'/'pending_opening'),
-- en_curso (antes 'in_progress'), finalizado (antes 'finished').
-- 'pending_leader' desaparece como estado: "sin dirigente" pasa a ser un flag
-- derivado (leader_id IS NULL) que la UI muestra como badge adicional.
--
-- Mapeo aplicado sobre los datos existentes (conteos al 2026-06-11):
--   open (1) + pending_opening (0) + pending_leader (1) → en_matricula
--   in_progress (117)                                   → en_curso
--   finished (1563)                                     → finalizado

-- 1. CHECK transitorio que admite viejos y nuevos.
ALTER TABLE study_groups DROP CONSTRAINT study_groups_status_check;
ALTER TABLE study_groups ADD CONSTRAINT study_groups_status_check
  CHECK (status IN ('pending_leader', 'pending_opening', 'open', 'in_progress', 'finished',
                    'en_matricula', 'en_curso', 'finalizado'));

-- 2. Migrar datos.
UPDATE study_groups SET status = 'en_matricula' WHERE status IN ('open', 'pending_opening', 'pending_leader');
UPDATE study_groups SET status = 'en_curso'     WHERE status = 'in_progress';
UPDATE study_groups SET status = 'finalizado'   WHERE status = 'finished';

-- 3. CHECK final con solo los estados vigentes.
ALTER TABLE study_groups DROP CONSTRAINT study_groups_status_check;
ALTER TABLE study_groups ADD CONSTRAINT study_groups_status_check
  CHECK (status IN ('en_matricula', 'en_curso', 'finalizado'));
