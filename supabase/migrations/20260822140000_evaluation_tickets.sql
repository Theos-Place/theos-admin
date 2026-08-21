-- DIR-5 · Tiquetes de evaluación del dirigente.
--
-- Cuando los estudiantes llenan la evaluación (EST-12), la coordinación tiene
-- que revisar el compilado ANTES de que algo le llegue al dirigente. Hasta hoy
-- eso se hacía grupo por grupo, entrando al detalle de cada uno: no hay forma de
-- ver qué falta revisar. Esto convierte esa revisión en una cola.
--
-- UN tiquete POR GRUPO, no por respuesta: lo que se revisa es el compilado.
--
-- Acceso: rol nuevo `evaluaciones` + coordinador_dirigentes + admin, y nadie
-- más. `direccion` queda AFUERA a propósito (a diferencia del resto de
-- estudios): la retro del dirigente es material sensible y la decisión de quién
-- la ve se toma explícito, no por herencia de privilegio.

-- ── 1. Rol 'evaluaciones' en el CHECK de member_roles (eran 20, quedan 21) ────
-- Mismo patrón que FRM-1 (20260804120000), que es la definición vigente del
-- CHECK; la del baseline quedó atrás.
ALTER TABLE public.member_roles DROP CONSTRAINT IF EXISTS member_roles_role_check;
ALTER TABLE public.member_roles ADD CONSTRAINT member_roles_role_check CHECK (
  role = ANY (ARRAY[
    'admin', 'direccion', 'finanzas', 'encargado_staff', 'coordinador_servidores',
    'coordinador_estudios', 'coordinador_dirigentes', 'encargado_eventos',
    'lider_comite', 'comunicaciones', 'dirigente', 'editor_perfiles', 'miembro',
    'solo_lectura', 'reportes', 'folletos', 'becas', 'revision_pagos',
    'editor_grupos_estudio', 'forms', 'evaluaciones'
  ])
);

-- ── 2. El tiquete ────────────────────────────────────────────────────────────
-- Tabla propia, no una genérica: es la misma decisión que se documentó en
-- FRM-1 para form_access_grants. Las columnas específicas del dominio
-- (sent_at/sent_by) viven acá, igual que study_requests guarda las suyas.
CREATE TABLE IF NOT EXISTS public.evaluation_tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Un tiquete por grupo, y se acabó: el UNIQUE es la regla de negocio.
  group_id      uuid NOT NULL UNIQUE REFERENCES public.study_groups(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'open',
  -- Quién lo tiene asignado (mismo rol que reviewed_by en study/finance_requests).
  reviewed_by   uuid REFERENCES public.members(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  review_notes  text,
  -- Envío manual del resumen al dirigente (EST-13). Se registra acá y no solo
  -- en study_groups.feedback_released_at porque acá interesa el rastro del
  -- correo: quién apretó el botón y cuándo, aunque se mande más de una vez.
  sent_at       timestamptz,
  sent_by       uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- 'escalated' es el estado propio de este tablero: la coordinación vio algo
  -- que no resuelve sola y lo sube. Los otros cuatro son los de siempre.
  CONSTRAINT evaluation_tickets_status_check CHECK (
    status = ANY (ARRAY['open', 'in_review', 'escalated', 'resolved', 'rejected'])
  )
);

COMMENT ON TABLE public.evaluation_tickets IS
  'DIR-5: un tiquete por grupo para revisar el compilado de la evaluación del dirigente antes de compartírselo.';
COMMENT ON COLUMN public.evaluation_tickets.sent_at IS
  'DIR-5: cuándo se envió el resumen al dirigente (EST-13). Se re-sella en cada envío manual.';

-- La cola se lee por estado; el índice parcial es lo que se consulta a diario.
CREATE INDEX IF NOT EXISTS idx_evaluation_tickets_abiertos
  ON public.evaluation_tickets (created_at DESC)
  WHERE status IN ('open', 'in_review', 'escalated');
CREATE INDEX IF NOT EXISTS idx_evaluation_tickets_reviewed_by
  ON public.evaluation_tickets (reviewed_by) WHERE reviewed_by IS NOT NULL;

-- ── 3. Historial ─────────────────────────────────────────────────────────────
-- Esquema idéntico a finance_request_status_history / study_request_status_history:
-- el RequestBoard espera exactamente esta forma.
CREATE TABLE IF NOT EXISTS public.evaluation_ticket_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.evaluation_tickets(id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  changed_by  uuid REFERENCES public.members(id) ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_ticket_history_ticket
  ON public.evaluation_ticket_status_history (ticket_id, created_at);

-- ── 4. updated_at ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_updated_at_evaluation_tickets ON public.evaluation_tickets;
CREATE TRIGGER set_updated_at_evaluation_tickets
  BEFORE UPDATE ON public.evaluation_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. RLS ───────────────────────────────────────────────────────────────────
-- Defensa en profundidad: las queries de la app usan service role. El acceso
-- real lo cierra requireRoles() en cada handler.
ALTER TABLE public.evaluation_tickets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_ticket_status_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY evaluation_tickets_all ON public.evaluation_tickets
    FOR ALL TO authenticated
    USING (private.is_admin() OR private.has_any_role(ARRAY['evaluaciones', 'coordinador_dirigentes']))
    WITH CHECK (private.is_admin() OR private.has_any_role(ARRAY['evaluaciones', 'coordinador_dirigentes']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY evaluation_ticket_history_all ON public.evaluation_ticket_status_history
    FOR ALL TO authenticated
    USING (private.is_admin() OR private.has_any_role(ARRAY['evaluaciones', 'coordinador_dirigentes']))
    WITH CHECK (private.is_admin() OR private.has_any_role(ARRAY['evaluaciones', 'coordinador_dirigentes']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_tickets              TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_ticket_status_history TO authenticated, service_role;

-- ── 6. Backfill ──────────────────────────────────────────────────────────────
-- Todo grupo que ya pidió evaluación y tiene al menos una respuesta entra a la
-- cola. Los que ya se compartieron con el dirigente entran como resueltos: esa
-- revisión ya ocurrió, no hay que volver a hacerla.
INSERT INTO public.evaluation_tickets (group_id, status, sent_at)
SELECT g.id,
       CASE WHEN g.feedback_released_at IS NOT NULL THEN 'resolved' ELSE 'open' END,
       g.feedback_released_at
FROM public.study_groups g
WHERE g.feedback_requested_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.leader_evaluations e WHERE e.group_id = g.id)
ON CONFLICT (group_id) DO NOTHING;
