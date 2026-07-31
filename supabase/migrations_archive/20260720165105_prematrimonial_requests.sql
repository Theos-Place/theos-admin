-- Flujo de inscripción al curso prematrimonial: solicitud de creación de grupo.
-- La pareja se inscribe (1 persona inicia, cubre a ambos), paga por comprobante,
-- y al aprobarse el pago queda una solicitud que un coordinador de estudios toma
-- para crear el grupo y asignar a la pareja. Molde: study_requests.

-- 1. Concepto de pago 'prematrimonial'.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_concept_check;
ALTER TABLE payments ADD CONSTRAINT payments_concept_check
  CHECK (concept IS NULL OR concept = ANY (ARRAY['matricula','folletos','evento','prematrimonial']));

-- 2. Tabla de solicitudes.
CREATE TABLE IF NOT EXISTS prematrimonial_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  spouse_member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  -- pago_en_revision → pendiente (pago aprobado) → grupo_creado | cancelada
  status text NOT NULL DEFAULT 'pago_en_revision'
    CHECK (status IN ('pago_en_revision','pendiente','grupo_creado','cancelada')),
  -- Logística (la aporta la pareja; el sistema no la tiene).
  available_days  text[] NOT NULL DEFAULT '{}',   -- lunes..viernes
  available_times text[] NOT NULL DEFAULT '{}',   -- tarde | noche
  zones           text[] NOT NULL DEFAULT '{}',   -- Virtual, Este SJ, ... (Madrid=Virtual)
  can_host      boolean NOT NULL DEFAULT false,
  host_address  text,
  host_maps_url text,
  -- Ceremonia.
  ceremony_date date,
  ceremony_date_defined boolean NOT NULL DEFAULT false,
  venue_defined      boolean NOT NULL DEFAULT false,
  venue_outside_gam  boolean NOT NULL DEFAULT false,
  officiant text,          -- nombre autorizado, 'otro' o 'no_requiere'
  comments  text,
  -- Enlaces al objeto que produce el flujo.
  payment_id         uuid REFERENCES payments(id) ON DELETE SET NULL,
  resulting_group_id uuid REFERENCES study_groups(id) ON DELETE SET NULL,
  refund_request_id  uuid REFERENCES finance_requests(id) ON DELETE SET NULL,
  -- Auditoría.
  created_by  uuid REFERENCES members(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES members(id) ON DELETE SET NULL,
  canceled_by uuid REFERENCES members(id) ON DELETE SET NULL,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT premat_distinct_pair CHECK (requester_member_id <> spouse_member_id)
);
CREATE INDEX IF NOT EXISTS idx_premat_requester ON prematrimonial_requests(requester_member_id);
CREATE INDEX IF NOT EXISTS idx_premat_spouse    ON prematrimonial_requests(spouse_member_id);
CREATE INDEX IF NOT EXISTS idx_premat_status    ON prematrimonial_requests(status);
CREATE INDEX IF NOT EXISTS idx_premat_payment   ON prematrimonial_requests(payment_id);
-- Una sola solicitud ACTIVA por pareja (en cualquier orden no se puede, pero sí
-- evita doble-submit del mismo requester+spouse mientras esté viva).
CREATE UNIQUE INDEX IF NOT EXISTS premat_active_pair_uniq
  ON prematrimonial_requests(requester_member_id, spouse_member_id)
  WHERE status IN ('pago_en_revision','pendiente');

CREATE TABLE IF NOT EXISTS prematrimonial_request_status_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid NOT NULL REFERENCES prematrimonial_requests(id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  changed_by  uuid REFERENCES members(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_premat_hist_request ON prematrimonial_request_status_history(request_id);

CREATE TRIGGER set_updated_at_premat BEFORE UPDATE ON prematrimonial_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. RPC approve_payment extendido: al aprobar un pago 'prematrimonial',
--    la solicitud pasa de pago_en_revision → pendiente (lista para coordinador).
CREATE OR REPLACE FUNCTION public.approve_payment(p_payment_id uuid, p_reviewer uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $$
DECLARE
  v_concept text;
  v_enrollment uuid;
  v_event_registration uuid;
BEGIN
  UPDATE payments
  SET review_status = 'aprobado', status = 'paid',
      reviewed_by = p_reviewer, reviewed_at = now(), paid_at = now()
  WHERE id = p_payment_id AND review_status = 'en_revision' AND status = 'pending'
  RETURNING concept, enrollment_id, event_registration_id
    INTO v_concept, v_enrollment, v_event_registration;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_concept IN ('matricula', 'folletos') AND v_enrollment IS NOT NULL THEN
    UPDATE study_enrollments SET status = 'enrolled'
    WHERE id = v_enrollment AND status = 'pendiente_de_pago';
  ELSIF v_concept = 'evento' AND v_event_registration IS NOT NULL THEN
    UPDATE event_registrations SET payment_status = 'paid'
    WHERE id = v_event_registration AND payment_status = 'pending';
  ELSIF v_concept = 'prematrimonial' THEN
    UPDATE prematrimonial_requests SET status = 'pendiente', reviewed_by = p_reviewer
    WHERE payment_id = p_payment_id AND status = 'pago_en_revision';
  END IF;
  RETURN true;
END $$;

-- 4. RLS: la pareja ve la suya; estudios/finanzas/admin gestionan. Escrituras
--    por service role (endpoints /api). Defensa en profundidad.
ALTER TABLE prematrimonial_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE prematrimonial_request_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY premat_select ON prematrimonial_requests FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR private.has_any_role(array['coordinador_estudios','coordinador_dirigentes','finanzas','direccion'])
    OR private.is_own_member(requester_member_id)
    OR private.is_own_member(spouse_member_id)
  );
CREATE POLICY premat_write ON prematrimonial_requests FOR ALL TO authenticated
  USING (private.is_admin() OR private.has_any_role(array['coordinador_estudios','coordinador_dirigentes','finanzas','direccion']))
  WITH CHECK (private.is_admin() OR private.has_any_role(array['coordinador_estudios','coordinador_dirigentes','finanzas','direccion']));

CREATE POLICY premat_hist_select ON prematrimonial_request_status_history FOR SELECT TO authenticated
  USING (private.is_admin() OR private.has_any_role(array['coordinador_estudios','coordinador_dirigentes','finanzas','direccion']));
