-- 2026-08-04 · La matrícula es efectiva de inmediato; el pago es un carril aparte.
--
-- El código dejó de escribir 'pendiente_de_pago': una matrícula con costo nace
-- 'enrolled' y su pago nace pendiente, para que finanzas lo revise sin que eso
-- toque la matrícula.
--
-- El VALOR del CHECK se queda: hay matrículas históricas con ese estado y
-- borrarlo del enum rompería la fila (y el registro de lo que pasó). Lo que se
-- migra es la única matrícula ACTIVA que quedó en ese estado — dejar una sola
-- fila en un estado que ya nadie escribe es una mina: no la cierra el cierre de
-- grupo (el RPC solo toca 'enrolled'), no la ve el conteo de cupo del mismo
-- modo, y nadie se acuerda de por qué está ahí.
--
-- Al aplicar esta migración: 1 fila (matrícula de prueba del 2026-07-20, con su
-- pago de ₡5.000 pendiente). El pago NO se toca: sigue en la cola de revisión,
-- que es exactamente el comportamiento nuevo.

UPDATE study_enrollments
SET status = 'enrolled', updated_at = NOW()
WHERE status = 'pendiente_de_pago';

COMMENT ON COLUMN public.study_enrollments.status IS
  'enrolled | waitlist | completed | dropped | transferred | reprobado | expirada. "pendiente_de_pago" quedó SOLO para datos históricos: desde 2026-08-04 la matrícula es efectiva de inmediato y el pago va por su cuenta.';
