-- Las excepciones de matrícula caducan al cerrar el bloque en que se otorgaron.
--
-- POR QUÉ. Una excepción se da para que la persona entre a los grupos que están
-- abiertos AHORA. Sin caducidad quedaban vivas para siempre y alguien podía
-- usarlas un año después, cuando la razón por la que se otorgaron ya no aplica.
--
-- Se guarda el BLOQUE y no una fecha copiada: si al bloque le mueven el cierre
-- de matrícula, la excepción lo sigue. Una fecha congelada al momento de
-- otorgar quedaría desfasada sin que nadie se entere.
--
-- ON DELETE SET NULL: borrar un bloque no puede borrar excepciones; se quedan
-- sin vencimiento, que es el estado seguro (no bloquea a nadie por accidente).
--
-- LAS 20 EXCEPCIONES ACTIVAS DE HOY quedan con bloque_id NULL, o sea sin
-- vencimiento. Es deliberado: se otorgaron bajo la regla vieja y no se les
-- cambia el trato de forma retroactiva.
ALTER TABLE public.study_requirement_exceptions
  ADD COLUMN IF NOT EXISTS bloque_id uuid
  REFERENCES public.capacitacion_bloques(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.study_requirement_exceptions.bloque_id IS
  'Bloque en que se otorgó. La excepción caduca al cerrar su matrícula (fecha_cierre_matricula). NULL = sin vencimiento (excepciones anteriores a 2026-09-01).';

-- El índice sirve al filtro de vigencia, que corre en cada cálculo de
-- elegibilidad (una vez por persona que abre Matrícula).
CREATE INDEX IF NOT EXISTS idx_excepciones_activas_bloque
  ON public.study_requirement_exceptions (member_id, bloque_id)
  WHERE status = 'active';
