-- FIN-6 · Devoluciones: tipo derivado, visibilidad compartida y conversión en donación.
--
-- La tabla refunds estaba VACÍA (0 filas) al aplicar esto, así que no hace falta
-- backfill: todo lo nuevo se llena al crear la devolución.
--
-- 1) TIPO: se DERIVA del pago original y se guarda (kind + plan_id + event_id).
--    No se le pide a nadie a mano — el pago ya sabe de dónde vino. Guardar el
--    plan es lo que permite filtrar por tipo de estudio sin joins caros.
--    'campana' sale de un pago de matrícula cuyo plan es de nivel 'campanas'.
-- 3) VISIBILIDAD: event_id permite que el encargado de un evento vea las
--    devoluciones de SU evento; refund_comments le da el "ven y comentan"
--    (resolver sigue siendo solo de finanzas).
-- 4) DONACIÓN: status nuevo 'convertida_donacion' + donations.refund_id como
--    referencia cruzada. Contabilidad confirmó la conversión (2026-08-21).

-- ── 1) Tipo derivado ────────────────────────────────────────────────────────

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS kind     text,
  ADD COLUMN IF NOT EXISTS plan_id  uuid REFERENCES public.study_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

-- Mismos valores que PaymentKind (lib/finance/payment-label.ts) más 'campana'.
-- Sin ñ, por consistencia con el resto del esquema (study_plans.level usa
-- 'campanas'); la etiqueta con tilde vive en la UI.
DO $$ BEGIN
  ALTER TABLE public.refunds ADD CONSTRAINT refunds_kind_check
    CHECK (kind IS NULL OR kind IN ('estudio', 'campana', 'evento', 'prematrimonial', 'folletos', 'otro'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.refunds.kind IS
  'FIN-6: tipo derivado del pago original al crear la devolución. Nunca se pide a mano.';

CREATE INDEX IF NOT EXISTS idx_refunds_kind     ON public.refunds (kind);
CREATE INDEX IF NOT EXISTS idx_refunds_plan     ON public.refunds (plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_event    ON public.refunds (event_id) WHERE event_id IS NOT NULL;

-- ── 4) Conversión en donación ───────────────────────────────────────────────

-- Estado nuevo: la devolución NO se borra (sin soft-delete y con historial),
-- queda resuelta como convertida.
ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS refunds_status_check;
ALTER TABLE public.refunds ADD CONSTRAINT refunds_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'convertida_donacion'));

-- Referencia cruzada: de la donación al refund que la originó. donations no
-- tenía dónde guardar procedencia (source_file es el CSV de un import).
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS refund_id uuid REFERENCES public.refunds(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.donations.refund_id IS
  'FIN-6: si viene, esta donación nació de convertir esa devolución.';

-- Una donación por devolución: si el POST se reintenta, no se duplica la plata.
CREATE UNIQUE INDEX IF NOT EXISTS donations_refund_uniq
  ON public.donations (refund_id) WHERE refund_id IS NOT NULL;

-- ── 3) Comentarios (el "ven y comentan" del responsable del origen) ─────────

CREATE TABLE IF NOT EXISTS public.refund_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id  uuid NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  member_id  uuid REFERENCES public.members(id) ON DELETE SET NULL,
  body       text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.refund_comments IS
  'FIN-6: comentarios de una devolución. El responsable del origen (encargado del evento, coordinación de estudios) ve y comenta; resolver sigue siendo de finanzas.';

CREATE INDEX IF NOT EXISTS idx_refund_comments_refund ON public.refund_comments (refund_id);

ALTER TABLE public.refund_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY refund_comments_staff ON public.refund_comments
    FOR SELECT TO authenticated
    USING (private.has_any_role(ARRAY['admin', 'direccion', 'finanzas', 'coordinador_estudios']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON TABLE public.refund_comments TO authenticated;
GRANT ALL ON TABLE public.refund_comments TO service_role;
