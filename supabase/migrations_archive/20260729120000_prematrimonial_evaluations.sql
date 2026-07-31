-- PRE-8: evaluación de la PAREJA al cerrar un grupo prematrimonial (una por
-- solicitud/pareja, llenada por los mentores en el cierre).
--
-- SENSIBLE (información pastoral): va en tabla propia y NO en
-- prematrimonial_requests — la policy premat_select deja que la pareja lea su
-- propia solicitud, y esta evaluación no debe ser visible para ellos. RLS
-- habilitado SIN policies de self: solo service role (los endpoints gatean a
-- coordinador_estudios / direccion / admin explícitamente).
CREATE TABLE IF NOT EXISTS prematrimonial_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES prematrimonial_requests(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  -- 1) compromiso mutuo y con Dios
  commitment text NOT NULL CHECK (commitment IN ('si', 'en_proceso', 'requiere_atencion')),
  -- 2) fortalezas (selección múltiple del catálogo) + texto libre opcional
  strengths text[] NOT NULL DEFAULT '{}',
  strengths_notes text,
  -- 3) temas de los 10 del curso a profundizar
  topics_to_work text[] NOT NULL DEFAULT '{}',
  -- 4) observaciones específicas
  observations text,
  -- 5) punto ciego / desacuerdo grave (si sí, descripción breve)
  blind_spot boolean NOT NULL DEFAULT false,
  blind_spot_notes text,
  -- 6) plan de acción de los mentores (condiciona el seguimiento)
  action_plan text NOT NULL CHECK (action_plan IN ('listos', 'consejeria', 'posponer')),
  -- 7) bendición final
  blessing text,
  filled_by uuid REFERENCES members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- una evaluación por pareja
  CONSTRAINT premat_eval_request_uniq UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS idx_premat_eval_group ON prematrimonial_evaluations(group_id);

ALTER TABLE prematrimonial_evaluations ENABLE ROW LEVEL SECURITY;
-- Sin policies: deny-by-default para clientes con sesión; solo service role.
