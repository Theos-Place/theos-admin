-- REU-2 · Una solicitud de reubicación puede quedar EN ESPERA con despertador.
--
-- EL CASO REAL (Ari): a la persona no le sirve ningún grupo de los que hay y
-- quiere esperar a uno concreto —«cuando el grupo X llegue a Discípulos 2»—.
-- Hoy esa solicitud se queda 'Abierta' para siempre: no se puede resolver
-- porque no hay dónde meterla, y rechazarla sería mentir, porque la persona
-- sigue queriendo. Se queda ensuciando la cola y compitiendo por atención con
-- las que sí se pueden trabajar ahora.
--
-- `wait_until` ES UNA FECHA, NO UN NÚMERO DE SEMANAS. La pantalla pregunta en
-- semanas porque así es como se piensa («en unos tres meses»), pero lo que se
-- guarda es el día: si se guardaran las semanas habría que saber además desde
-- cuándo se cuentan, y ese «desde cuándo» se mueve cada vez que alguien toca la
-- solicitud.
--
-- `reactivated_at` NO ES DECORACIÓN. Las solicitudes abiertas VENCEN cuando
-- cierra el bloque de matrícula que les tocaba, y ese bloque se calcula desde
-- `created_at`. Sin esta columna, una solicitud que durmió cuatro meses
-- despertaría 'Abierta' y el cron de vencimiento la mataría en la siguiente
-- corrida por vieja — justo la que alguien decidió a propósito conservar.
-- Cuando está puesta, el vencimiento cuenta desde ella.

ALTER TABLE public.study_requests DROP CONSTRAINT IF EXISTS study_requests_status_check;
ALTER TABLE public.study_requests ADD CONSTRAINT study_requests_status_check
  CHECK (status = ANY (ARRAY['open','in_review','resolved','rejected','vencida','en_espera']));

ALTER TABLE public.study_requests
  ADD COLUMN IF NOT EXISTS wait_until     date,
  ADD COLUMN IF NOT EXISTS reactivated_at timestamptz;

COMMENT ON COLUMN public.study_requests.wait_until IS
  'REU-2: día en que una solicitud en_espera vuelve a la cola. El cron semanal la despierta.';
COMMENT ON COLUMN public.study_requests.reactivated_at IS
  'REU-2: cuándo despertó. El vencimiento por bloque cuenta desde acá y no desde created_at.';

-- El cron semanal pregunta exactamente esto: las dormidas cuyo día ya llegó.
CREATE INDEX IF NOT EXISTS idx_study_requests_en_espera
  ON public.study_requests (wait_until)
  WHERE status = 'en_espera';
