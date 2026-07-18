-- 012: Alinear el esquema de estudios con el modelo del frontend.
-- Agrega columnas faltantes a study_plans/study_groups y crea las tablas
-- nuevas: study_leaders, leader_evaluations, study_waitlist, relocation_requests.
-- Los renombres y enums (weeks->duration_weeks, stage/level, is_archived) los
-- resuelve el adapter; aquí solo agregamos lo que de verdad falta.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. study_plans: catálogo enriquecido
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE study_plans
  ADD COLUMN code              TEXT,
  ADD COLUMN requires_payment  BOOLEAN DEFAULT FALSE,
  ADD COLUMN requires_grade    BOOLEAN DEFAULT FALSE,
  ADD COLUMN auto_promote      BOOLEAN DEFAULT FALSE,
  ADD COLUMN requires_server   BOOLEAN DEFAULT FALSE,
  -- Referencias por código (estilo mock), no FK dura para evitar orden de inserción.
  ADD COLUMN prerequisite_code TEXT,
  ADD COLUMN next_study_code   TEXT;

CREATE UNIQUE INDEX idx_study_plans_code ON study_plans(code) WHERE code IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. study_groups: campos de agenda/estado del frontend
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE study_groups
  ADD COLUMN zone               TEXT,
  ADD COLUMN schedule_days      TEXT[],
  ADD COLUMN schedule_time      TEXT,
  ADD COLUMN location           TEXT,
  ADD COLUMN current_week       INT DEFAULT 0,
  ADD COLUMN whatsapp_group_url TEXT;

-- Nuevo enum de estado (el mock maneja el ciclo de vida del grupo).
ALTER TABLE study_groups ALTER COLUMN status DROP DEFAULT;
ALTER TABLE study_groups DROP CONSTRAINT IF EXISTS study_groups_status_check;
UPDATE study_groups SET status = 'open' WHERE status NOT IN
  ('pending_leader', 'pending_opening', 'open', 'in_progress', 'finished');
ALTER TABLE study_groups
  ADD CONSTRAINT study_groups_status_check CHECK (status IN (
    'pending_leader', 'pending_opening', 'open', 'in_progress', 'finished'
  ));
ALTER TABLE study_groups ALTER COLUMN status SET DEFAULT 'pending_leader';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. study_leaders: dirigentes de estudio (1:1 con un miembro)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE study_leaders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id           UUID NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  zone_preference     TEXT[] DEFAULT '{}',
  availability_status TEXT DEFAULT 'available' CHECK (availability_status IN (
                        'available', 'assigned', 'resting', 'inactive'
                      )),
  is_active           BOOLEAN DEFAULT TRUE,
  qualified_study_codes TEXT[] DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_study_leaders_member ON study_leaders(member_id);

CREATE TRIGGER set_updated_at_study_leaders
  BEFORE UPDATE ON study_leaders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. leader_evaluations: evaluaciones de dirigentes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE leader_evaluations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id       UUID NOT NULL REFERENCES study_leaders(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES study_groups(id) ON DELETE SET NULL,
  score           NUMERIC(4,2) NOT NULL,
  evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  comments        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_leader_evaluations_leader ON leader_evaluations(leader_id);
CREATE INDEX idx_leader_evaluations_group  ON leader_evaluations(group_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. study_waitlist: lista de espera (N1 o campaña, sin grupo asignado)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE study_waitlist (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id           UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  zone_preference     TEXT,
  schedule_preference TEXT,
  type                TEXT NOT NULL DEFAULT 'N1' CHECK (type IN ('N1', 'campaign')),
  campaign_code       TEXT,
  requested_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_study_waitlist_member ON study_waitlist(member_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. relocation_requests: solicitudes de reubicación de grupo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE relocation_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  from_group_id   UUID REFERENCES study_groups(id) ON DELETE SET NULL,
  study_plan_code TEXT,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  requested_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_relocation_requests_member ON relocation_requests(member_id);
CREATE INDEX idx_relocation_requests_group  ON relocation_requests(from_group_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS en las tablas nuevas (patrón normalizado: 1 política por acción)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['study_leaders','leader_evaluations','study_waitlist','relocation_requests']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$CREATE POLICY "%1$s_select" ON %1$I FOR SELECT TO authenticated USING ((select auth.role()) = 'authenticated')$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_insert" ON %1$I FOR INSERT TO authenticated WITH CHECK (private.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_update" ON %1$I FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_delete" ON %1$I FOR DELETE TO authenticated USING (private.is_admin())$f$, t);
  END LOOP;
END $$;
