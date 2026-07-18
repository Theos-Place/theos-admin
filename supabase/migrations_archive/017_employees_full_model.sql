-- 017: Empleados — puestos pagados, historiales (salario/posición/vacaciones)
-- y columnas faltantes en employees.

-- ─────────────────────────────────────────────────────────────────────────────
-- paid_positions: puestos remunerados (asociados a un comité)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE paid_positions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  committee_id  UUID REFERENCES areas(id) ON DELETE SET NULL,
  description   TEXT,
  contract_type TEXT CHECK (contract_type IN ('planilla', 'servicios_profesionales')),
  salary_min    NUMERIC(12,2),
  salary_max    NUMERIC(12,2),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_paid_positions_committee ON paid_positions(committee_id);

CREATE TRIGGER set_updated_at_paid_positions
  BEFORE UPDATE ON paid_positions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- employees: columnas del frontend
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN contract_type       TEXT CHECK (contract_type IN ('planilla', 'servicios_profesionales')),
  ADD COLUMN position_id         UUID REFERENCES paid_positions(id) ON DELETE SET NULL,
  ADD COLUMN vacation_days_total INT DEFAULT 0,
  ADD COLUMN vacation_days_used  INT DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- Historiales
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE salary_changes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  change_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_salary NUMERIC(12,2),
  new_salary      NUMERIC(12,2) NOT NULL,
  reason          TEXT,
  approved_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_salary_changes_employee ON salary_changes(employee_id);

CREATE TABLE position_records (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  position_name TEXT NOT NULL,
  start_date    DATE,
  end_date      DATE,
  contract_type TEXT CHECK (contract_type IN ('planilla', 'servicios_profesionales')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_position_records_employee ON position_records(employee_id);

CREATE TABLE vacation_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'incapacidad'
              )),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  days        INT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN (
                'aprobado', 'pendiente', 'rechazado'
              )),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vacation_records_employee ON vacation_records(employee_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- employee_documents: tipos del frontend
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS employee_documents_doc_type_check;
ALTER TABLE employee_documents ADD CONSTRAINT employee_documents_doc_type_check CHECK (doc_type IN (
  'contrato', 'cedula', 'titulo', 'certificado', 'evaluacion', 'permiso', 'otro',
  'identificacion', 'seguro_social'
));

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS en las tablas nuevas (patrón normalizado)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['paid_positions','salary_changes','position_records','vacation_records']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$CREATE POLICY "%1$s_select" ON %1$I FOR SELECT TO authenticated USING ((select auth.role()) = 'authenticated')$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_insert" ON %1$I FOR INSERT TO authenticated WITH CHECK (private.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_update" ON %1$I FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_delete" ON %1$I FOR DELETE TO authenticated USING (private.is_admin())$f$, t);
  END LOOP;
END $$;
