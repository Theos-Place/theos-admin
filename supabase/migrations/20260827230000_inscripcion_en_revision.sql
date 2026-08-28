-- Estado nuevo de inscripción: 'en_revision'.
--
-- EL PROBLEMA. Hay 604 inscripciones que quedaron en 'enrolled' dentro de grupos
-- que YA están finalizados, algunas desde 2014. El grupo cerró; la persona no.
-- Mientras compartan estado con las matrículas de verdad activas, son
-- indistinguibles: el perfil dice "En curso" para un estudio de hace años, se
-- cuentan como estudio activo, y la pantalla llega a pedir el pago de una
-- matrícula que terminó (el caso que se reportó de Lucía Porras).
--
-- POR QUÉ NO SE RESUELVEN SOLAS. No se puede asumir el resultado. El cruce con
-- el reporte histórico de CCB lo demostró: en un grupo de Hermenéutica de 2024,
-- los 7 marcados aprobados aparecen graduados en CCB y los 4 colgados NO — o
-- sea que el cierre parcial estuvo bien y esos 4 no aprobaron. Marcarlos
-- aprobados en masa les habría dado un estudio que no llevaron, y varios de
-- esos son prerequisito de otros.
--
-- LA SALIDA. Un estado propio que diga la verdad: "esto quedó sin resolver y hay
-- que revisarlo a mano". No afirma aprobado ni reprobado, saca la inscripción de
-- los conteos de estudios activos, y deja el trabajo visible en vez de
-- disfrazado de matrícula vigente. Lo resuelve el coordinador de estudios
-- cuando confirma con el dirigente.
ALTER TABLE public.study_enrollments
  DROP CONSTRAINT IF EXISTS study_enrollments_status_check;

ALTER TABLE public.study_enrollments
  ADD CONSTRAINT study_enrollments_status_check
  CHECK (status = ANY (ARRAY[
    'enrolled'::text, 'waitlist'::text, 'completed'::text, 'dropped'::text,
    'transferred'::text, 'pendiente_de_pago'::text, 'expirada'::text,
    'reprobado'::text,
    -- NUEVO: el grupo cerró y esta inscripción quedó sin resultado.
    'en_revision'::text
  ]));

COMMENT ON COLUMN public.study_enrollments.status IS
  'enrolled = cursando. completed/reprobado/dropped = resultado final. en_revision = el grupo cerró sin registrar el resultado de esta persona; lo resuelve el coordinador de estudios. NO asume aprobado.';

-- Backfill: SOLO las que están en un grupo ya finalizado. Las 'enrolled' de
-- grupos vivos no se tocan.
UPDATE public.study_enrollments e
SET status = 'en_revision'
WHERE e.status = 'enrolled'
  AND EXISTS (
    SELECT 1 FROM public.study_groups g
    WHERE g.id = e.group_id AND g.status = 'finalizado'
  );
