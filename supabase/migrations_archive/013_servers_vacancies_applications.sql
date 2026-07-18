-- 013: Servidores — vacantes, aplicaciones y metas de comité.
-- Un "comité" es un area con area_type='committee'. Los servidores del comité
-- son volunteers en posiciones (service_positions) de esa área. Solo faltaban:
-- capacidad ideal, vacantes, aplicaciones y metas.

-- Capacidad ideal del comité (cuántos servidores debería tener).
ALTER TABLE areas ADD COLUMN ideal_capacity INT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vacantes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE vacancies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id  UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  position_id   UUID REFERENCES service_positions(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  position      TEXT,
  description   TEXT,
  functions     TEXT[] DEFAULT '{}',
  schedule      TEXT,
  commitment    TEXT,
  slots_total   INT DEFAULT 1,
  slots_filled  INT DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                  'draft', 'published', 'filled', 'closed'
                )),
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vacancies_committee ON vacancies(committee_id);
CREATE INDEX idx_vacancies_position  ON vacancies(position_id);
CREATE INDEX idx_vacancies_status    ON vacancies(status);

CREATE TRIGGER set_updated_at_vacancies
  BEFORE UPDATE ON vacancies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Aplicaciones a vacantes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE applications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vacancy_id   UUID NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                 'pending', 'reviewing', 'approved', 'rejected'
               )),
  notes        TEXT,
  applied_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vacancy_id, applicant_id)
);
CREATE INDEX idx_applications_vacancy   ON applications(vacancy_id);
CREATE INDEX idx_applications_applicant ON applications(applicant_id);
CREATE INDEX idx_applications_status    ON applications(status);

CREATE TRIGGER set_updated_at_applications
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Metas de comité
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE committee_goals (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
                 'in_progress', 'completed'
               )),
  due_date     DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_committee_goals_committee ON committee_goals(committee_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS (patrón normalizado: 1 política por acción)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['vacancies','applications','committee_goals']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$CREATE POLICY "%1$s_select" ON %1$I FOR SELECT TO authenticated USING ((select auth.role()) = 'authenticated')$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_insert" ON %1$I FOR INSERT TO authenticated WITH CHECK (private.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_update" ON %1$I FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_delete" ON %1$I FOR DELETE TO authenticated USING (private.is_admin())$f$, t);
  END LOOP;
END $$;
