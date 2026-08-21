-- DIR-6 · Estado administrativo "en revisión" del dirigente.
--
-- La columna availability_status ya existía con cuatro valores, pero ninguna
-- pantalla la editaba: en la práctica era un espejo de is_active (126
-- 'available' activos, 359 'inactive' inactivos, y 0 filas en 'assigned' o
-- 'resting'). DIR-6 la pone a trabajar.
--
-- 'resting' NO se toca: es el "en pausa" que pedía la ficha y solo cambia de
-- etiqueta en la UI. Lo único que se agrega acá es 'en_revision'.
--
-- Nombre en español a propósito, distinto del resto del enum: los otros valores
-- venían de la migración original y renombrarlos costaría más de lo que aclara.

ALTER TABLE public.study_leaders
  DROP CONSTRAINT IF EXISTS study_leaders_availability_status_check;

ALTER TABLE public.study_leaders
  ADD CONSTRAINT study_leaders_availability_status_check CHECK (
    availability_status = ANY (ARRAY[
      'available'::text, 'assigned'::text, 'resting'::text,
      'en_revision'::text, 'inactive'::text
    ])
  );

COMMENT ON COLUMN public.study_leaders.availability_status IS
  'DIR-6: estado administrativo. resting = en pausa (descanso acordado); en_revision = situación bajo evaluación. Los dos son visibles SOLO para coordinador_dirigentes/coordinador_estudios/admin; para el resto colapsan a inactivo. Un dirigente en_revision no se puede activar ni asignar a un grupo.';

-- El coordinador filtra por estado en /estudios/dirigentes; los dos matices son
-- pocas filas, así que el índice parcial es el que sirve.
CREATE INDEX IF NOT EXISTS idx_study_leaders_estado_admin
  ON public.study_leaders (availability_status)
  WHERE availability_status IN ('resting', 'en_revision');
