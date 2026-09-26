-- SRV-9 · Lo que el dirigente dice de SÍ MISMO: disponibilidad y confirmación.
--
-- QUÉ VIENE A MATAR. Hoy esto se recoge tres veces al año (marzo, julio,
-- noviembre) con formularios sueltos de Linktree, y lo que la gente contesta no
-- vuelve al sistema: queda en una hoja que alguien transcribe. Pedido de
-- Fabiola.
--
-- LO QUE YA EXISTÍA Y NO SE TOCA:
--   · `qualified_study_codes` = lo que QUIERE dar (disponibilidad).
--   · `formation_study_codes` = para lo que está CAPACITADO. La edita el
--     comité, nunca la persona.
--   · `zone_preference`       = dónde está dispuesto a dar.
--
-- LAS TRES DISTINCIONES QUE NO SE PUEDEN MEZCLAR, y por eso son tres columnas:
--   · CAPACITADO  → se formó. Lo dice el comité.
--   · DISPONIBLE  → quiere darlo ahora, y puede. Lo dice la persona.
--   · INTERESADO  → quiere APRENDER a darlo y todavía no puede. Lo dice la
--     persona, y alimenta la lista de quién convocar a la próxima capacitación.
--     Sin esta tercera columna, quien marca interés en algo para lo que no está
--     capacitado se cuela en la lista de «disponibles» y termina asignado a un
--     grupo que no puede dar.

ALTER TABLE public.study_leaders
  -- Día × franja, como 'L-mañana' … 'D-noche'. Un arreglo y no siete columnas:
  -- la pregunta real siempre es «¿quién puede los martes en la noche?», que con
  -- un arreglo es un `&&` y con columnas sería un OR de catorce términos.
  ADD COLUMN IF NOT EXISTS available_slots         text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS offers_home             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_as_substitute boolean NOT NULL DEFAULT false,
  -- Ventana del año en que puede dar. NULL en las dos = todo el año, que es el
  -- caso normal y no debería obligar a escribir dos fechas.
  ADD COLUMN IF NOT EXISTS available_from          date,
  ADD COLUMN IF NOT EXISTS available_to            date,
  -- Dónde recibir los folletos. Texto libre a propósito: el 95% es una sede,
  -- pero el 5% es «me los deja Karla» y un selector cerrado obliga a mentir.
  ADD COLUMN IF NOT EXISTS folleto_location        text,
  ADD COLUMN IF NOT EXISTS interested_study_codes  text[]  NOT NULL DEFAULT '{}',
  -- Última vez que la persona dijo «esto sigue siendo cierto». Se sella AUNQUE
  -- no cambie nada: para el comité, «no cambió» y «no contestó» son cosas
  -- distintas, y hoy no hay forma de distinguirlas.
  ADD COLUMN IF NOT EXISTS availability_confirmed_at timestamptz;

COMMENT ON COLUMN public.study_leaders.available_slots IS
  'SRV-9: franjas en que puede dar, como L-mañana … D-noche.';
COMMENT ON COLUMN public.study_leaders.interested_study_codes IS
  'SRV-9: estudios que quiere APRENDER a dar. Interesado ≠ disponible: esto NO habilita para asignar grupo.';
COMMENT ON COLUMN public.study_leaders.availability_confirmed_at IS
  'SRV-9: cuándo confirmó por última vez sus datos, aunque no cambiara nada.';

-- La consulta del comité es «quién no ha confirmado»: índice sobre la fecha,
-- con los NULL incluidos porque son justamente los que nunca confirmaron.
CREATE INDEX IF NOT EXISTS idx_study_leaders_confirmacion
  ON public.study_leaders (availability_confirmed_at NULLS FIRST);
