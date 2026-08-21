-- FIN-4 · Arreglo de pago en tractos (uso interno de finanzas).
--
-- El acuerdo vive en payment_plans; los TRACTOS son filas normales de payments
-- ligadas al acuerdo (payment_plan_id) con su monto y su fecha esperada. Así
-- cada tracto pasa por la cola de revisión de siempre y los agregados de
-- finanzas no cambian: un tracto es un pago.
--
-- Decisiones tomadas con finanzas (2026-08-21):
--  · El PRIMER tracto aprobado libera el objeto pagado (approve_payment queda
--    igual). El resto es deuda, y un tracto vencido bloquea matricularse o
--    inscribirse a otro evento pago.
--  · Cancelar el arreglo solo marca el PLAN como 'cancelado': los tractos
--    impagos siguen 'pending', así que siguen bloqueando y siguen entrando a
--    los recordatorios. Cancelar el arreglo NO perdona la deuda — para eso está
--    "Cerrar sin cobrar" de cada pago.

CREATE TABLE IF NOT EXISTS public.payment_plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id             uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  -- El objeto pagado: exactamente uno de los dos (espejo de payments). CASCADE
  -- porque un arreglo sin su matrícula/inscripción no significa nada.
  enrollment_id         uuid REFERENCES public.study_enrollments(id) ON DELETE CASCADE,
  event_registration_id uuid REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  total_amount          numeric(12,2) NOT NULL CHECK (total_amount > 0),
  currency              text NOT NULL DEFAULT 'CRC' CHECK (currency IN ('CRC', 'USD', 'EUR')),
  installments          int  NOT NULL CHECK (installments BETWEEN 2 AND 24),
  status                text NOT NULL DEFAULT 'activo'
                          CHECK (status IN ('activo', 'completado', 'cancelado')),
  notes                 text,
  created_by            uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_plans_target_check
    CHECK ((enrollment_id IS NOT NULL) <> (event_registration_id IS NOT NULL))
);

COMMENT ON TABLE public.payment_plans IS
  'FIN-4: acuerdo de pago en tractos. Los tractos son filas de payments con payment_plan_id. Cancelar el plan no perdona la deuda: los tractos impagos siguen pendientes.';

CREATE INDEX IF NOT EXISTS idx_payment_plans_member     ON public.payment_plans (member_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_enrollment ON public.payment_plans (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_event_reg  ON public.payment_plans (event_registration_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status     ON public.payment_plans (status);

CREATE OR REPLACE TRIGGER set_updated_at_payment_plans
  BEFORE UPDATE ON public.payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Las queries de la app usan service role; RLS es defensa en profundidad. Un
-- miembro puede LEER sus propios arreglos (los ve en /mis-pagos); crearlos y
-- modificarlos es solo de finanzas, y eso pasa por service role.
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY payment_plans_select_own ON public.payment_plans
    FOR SELECT TO authenticated
    USING (private.is_own_member(member_id) OR private.has_any_role(ARRAY['admin','direccion','finanzas']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON TABLE public.payment_plans TO authenticated;
GRANT ALL ON TABLE public.payment_plans TO service_role;

-- ── Los tractos, sobre payments ─────────────────────────────────────────────

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_plan_id    uuid REFERENCES public.payment_plans(id) ON DELETE SET NULL,
  -- Fecha ESPERADA del tracto. Columna nueva a propósito: payment_date ya
  -- existe con otro significado (NOT NULL con default hoy = fecha de registro,
  -- poblada incluso en pagos impagos).
  ADD COLUMN IF NOT EXISTS due_date           date,
  ADD COLUMN IF NOT EXISTS installment_number int;

COMMENT ON COLUMN public.payments.payment_plan_id IS
  'FIN-4: si viene, este pago es un TRACTO del arreglo indicado.';
COMMENT ON COLUMN public.payments.due_date IS
  'FIN-4: fecha esperada del tracto. Vencida + status pending = bloquea matrícula/eventos.';

CREATE INDEX IF NOT EXISTS idx_payments_payment_plan
  ON public.payments (payment_plan_id) WHERE payment_plan_id IS NOT NULL;

-- Búsqueda de tractos vencidos impagos (el guard corre en cada matrícula).
CREATE INDEX IF NOT EXISTS idx_payments_due_pending
  ON public.payments (member_id, due_date)
  WHERE due_date IS NOT NULL AND status = 'pending';

-- Los dos únicos parciales de comprobante permitían UN solo pago en revisión
-- por matrícula/inscripción. Con tractos eso rompe el flujo: subir el
-- comprobante del tracto 2 mientras el 1 está en revisión chocaba. Con arreglo
-- la unidad es el TRACTO (cada uno es su propia fila con su comprobante), así
-- que la restricción se limita a los pagos SIN plan, que es donde tenía sentido.
DROP INDEX IF EXISTS public.payments_comprobante_en_revision_uniq;
CREATE UNIQUE INDEX payments_comprobante_en_revision_uniq
  ON public.payments (enrollment_id)
  WHERE review_status = 'en_revision' AND concept = 'matricula'
    AND enrollment_id IS NOT NULL AND payment_plan_id IS NULL;

DROP INDEX IF EXISTS public.payments_comprobante_evento_en_revision_uniq;
CREATE UNIQUE INDEX payments_comprobante_evento_en_revision_uniq
  ON public.payments (event_registration_id)
  WHERE review_status = 'en_revision' AND concept = 'evento'
    AND event_registration_id IS NOT NULL AND payment_plan_id IS NULL;

-- Un tracto por número dentro del arreglo: evita duplicar el tracto 2 si el
-- POST de creación se reintenta.
CREATE UNIQUE INDEX IF NOT EXISTS payments_plan_installment_uniq
  ON public.payments (payment_plan_id, installment_number)
  WHERE payment_plan_id IS NOT NULL;
