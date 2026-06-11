-- ============================================================
-- THEOS PLACE — ESQUEMA COMPLETO DE BASE DE DATOS
-- Versión consolidada — Junio 2026
-- ============================================================
-- Instrucciones: ejecutar completo en Supabase SQL Editor
-- Requisito previo: extensión uuid-ossp habilitada
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- BLOQUE 1: MIEMBROS, FAMILIAS Y ROLES
-- ============================================================

-- ------------------------------------------------------------
-- MIEMBROS
-- ------------------------------------------------------------

CREATE TABLE members (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedula                  TEXT UNIQUE,
  first_name              TEXT NOT NULL,
  last_name               TEXT NOT NULL,
  birth_date              DATE,
  gender                  TEXT CHECK (gender IN ('M', 'F', 'otro')),
  marital_status          TEXT,
  phone          TEXT,
  email                   TEXT UNIQUE,
  province                TEXT,
  canton                  TEXT,
  district                TEXT,
  address                 TEXT,
  occupation              TEXT,
  workplace               TEXT,
  allergies               TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  photo_url               TEXT,
  smart_link_token        TEXT DEFAULT gen_random_uuid()::TEXT UNIQUE,
  wallet_pass_id          TEXT,
  is_donor                BOOLEAN DEFAULT FALSE,
  is_active               BOOLEAN DEFAULT TRUE,
  deactivation_reason     TEXT,
  deactivated_at          TIMESTAMPTZ,
  deactivated_by          UUID,
  auth_user_id            UUID REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_members_cedula   ON members(cedula);
CREATE INDEX idx_members_email    ON members(email);
CREATE INDEX idx_members_active   ON members(is_active);
CREATE INDEX idx_members_province ON members(province);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven miembros activos"
  ON members FOR SELECT
  USING (auth.role() = 'authenticated');
-- NOTA: la política "Admins gestionan miembros" se crea en la migración 009,
-- porque referencia member_roles (que se define más abajo en este archivo).

-- ------------------------------------------------------------
-- FAMILIAS
-- ------------------------------------------------------------

CREATE TABLE family_units (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE family_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven familias"
  ON family_units FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE TABLE family_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_unit_id UUID REFERENCES family_units(id) ON DELETE CASCADE,
  member_id      UUID REFERENCES members(id) ON DELETE CASCADE,
  relation       TEXT NOT NULL,
  linked_by      UUID REFERENCES members(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_unit_id, member_id)
);

CREATE INDEX idx_family_members_unit   ON family_members(family_unit_id);
CREATE INDEX idx_family_members_member ON family_members(member_id);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven vínculos familiares"
  ON family_members FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE TABLE family_unlink_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id   UUID REFERENCES members(id),
  family_unit_id UUID REFERENCES family_units(id),
  reason         TEXT,
  status         TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'rejected')),
  processed_by   UUID REFERENCES members(id),
  processed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE family_unlink_requests ENABLE ROW LEVEL SECURITY;
-- NOTA: la política "Admins ven solicitudes de desvinculación" se crea en la
-- migración 009 (referencia member_roles, definida más abajo).

-- ------------------------------------------------------------
-- ROLES
-- ------------------------------------------------------------

CREATE TABLE member_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID REFERENCES members(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN (
               'admin', 'direccion', 'finanzas', 'encargado_staff',
               'coordinador_estudios', 'coordinador_dirigentes',
               'lider_comite', 'comunicaciones', 'dirigente',
               'editor_perfiles', 'miembro', 'solo_lectura'
             )),
  granted_by UUID REFERENCES members(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  is_active  BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  UNIQUE(member_id, role)
);

CREATE INDEX idx_member_roles_member ON member_roles(member_id);
CREATE INDEX idx_member_roles_role   ON member_roles(role);
CREATE INDEX idx_member_roles_active ON member_roles(member_id, is_active);

ALTER TABLE member_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gestionan roles"
  ON member_roles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role = 'admin'
      AND mr.is_active = TRUE
  ));

-- ============================================================
-- BLOQUE 2: AUDITORÍA + ÁREAS Y SERVIDORES
-- ============================================================

-- ------------------------------------------------------------
-- AUDITORÍA
-- ------------------------------------------------------------

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_actor   ON audit_log(actor_id);
CREATE INDEX idx_audit_entity  ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Solo admins ven audit_log"
  ON audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader')
      AND mr.is_active = TRUE
  ));

-- Función de auditoría
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (
    auth.uid()::uuid,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE'              THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de auditoría en tablas críticas
CREATE TRIGGER audit_members
  AFTER INSERT OR UPDATE OR DELETE ON members
  FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER audit_member_roles
  AFTER INSERT OR UPDATE OR DELETE ON member_roles
  FOR EACH ROW EXECUTE FUNCTION log_changes();

-- Trigger updated_at en members
CREATE TRIGGER set_updated_at_members
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- ÁREAS Y COMITÉS
-- ------------------------------------------------------------

CREATE TABLE areas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  area_type   TEXT NOT NULL CHECK (area_type IN ('area', 'committee')),
  parent_id   UUID REFERENCES areas(id) ON DELETE SET NULL,
  leader_id   UUID REFERENCES members(id) ON DELETE SET NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_areas_parent ON areas(parent_id);
CREATE INDEX idx_areas_leader ON areas(leader_id);
CREATE INDEX idx_areas_type   ON areas(area_type);

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven areas"
  ON areas FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan areas"
  ON areas FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER audit_areas
  AFTER INSERT OR UPDATE OR DELETE ON areas
  FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER set_updated_at_areas
  BEFORE UPDATE ON areas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- POSICIONES / VACANTES
-- ------------------------------------------------------------

CREATE TABLE service_positions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id        UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  requirements   TEXT,
  max_volunteers INT DEFAULT 1,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_positions_area ON service_positions(area_id);

ALTER TABLE service_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven posiciones"
  ON service_positions FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan posiciones"
  ON service_positions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER set_updated_at_positions
  BEFORE UPDATE ON service_positions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- SERVIDORES / VOLUNTARIOS
-- ------------------------------------------------------------

CREATE TABLE volunteers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES service_positions(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'on_leave', 'pending')),
  start_date  DATE,
  end_date    DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, position_id)
);

CREATE INDEX idx_volunteers_member   ON volunteers(member_id);
CREATE INDEX idx_volunteers_position ON volunteers(position_id);
CREATE INDEX idx_volunteers_status   ON volunteers(status);

ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven voluntarios"
  ON volunteers FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan voluntarios"
  ON volunteers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'committee_leader')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER audit_volunteers
  AFTER INSERT OR UPDATE OR DELETE ON volunteers
  FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER set_updated_at_volunteers
  BEFORE UPDATE ON volunteers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- BLOQUE 3: EVENTOS
-- ============================================================

-- Catálogo editable de tipos de evento (la 006 lo amplió; acá queda el
-- esquema real: events.event_type es FK a este catálogo, no un CHECK).
CREATE TABLE event_types (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#161440',
  icon        TEXT NOT NULL DEFAULT 'calendar',
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO event_types (id, name, color, icon, description) VALUES
  ('charla',       'Charla',          '#161440', 'mic',       'Servicio semanal en sede'),
  ('campamento',   'Campamento',      '#70BDC2', 'tent',      'Retiro de varios días'),
  ('social',       'Actividad Social','#EF5554', 'users',     'Actividades comunitarias'),
  ('capacitacion', 'Capacitación',    '#519DA2', 'book-open', 'Formación de líderes');

CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  description     TEXT,
  event_type      TEXT NOT NULL REFERENCES event_types(id),
  location        TEXT,
  location_url    TEXT,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  is_recurring    BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT,
  parent_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  max_capacity    INT,
  requires_checkin BOOLEAN DEFAULT FALSE,
  flyer_url       TEXT,
  is_public       BOOLEAN DEFAULT TRUE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_starts  ON events(starts_at);
CREATE INDEX idx_events_type    ON events(event_type);
CREATE INDEX idx_events_parent  ON events(parent_event_id);
CREATE INDEX idx_events_active  ON events(is_active);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven eventos"
  ON events FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan eventos"
  ON events FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'director')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER audit_events
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER set_updated_at_events
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Check-in de eventos
CREATE TABLE event_checkins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id     UUID REFERENCES members(id) ON DELETE SET NULL,
  guest_name    TEXT,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  checked_in_by UUID REFERENCES auth.users(id),
  method        TEXT DEFAULT 'manual' CHECK (method IN ('manual', 'qr', 'smart_link')),
  notes         TEXT,
  CONSTRAINT checkin_member_or_guest CHECK (
    member_id IS NOT NULL OR guest_name IS NOT NULL
  )
);

CREATE INDEX idx_checkins_event  ON event_checkins(event_id);
CREATE INDEX idx_checkins_member ON event_checkins(member_id);
CREATE INDEX idx_checkins_time   ON event_checkins(checked_in_at);

ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven checkins"
  ON event_checkins FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Autenticados registran checkins"
  ON event_checkins FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan checkins"
  ON event_checkins FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'director')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER audit_event_checkins
  AFTER INSERT OR UPDATE OR DELETE ON event_checkins
  FOR EACH ROW EXECUTE FUNCTION log_changes();

-- Voluntarios en eventos
CREATE TABLE event_volunteers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role        TEXT,
  status      TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  assigned_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, member_id)
);

CREATE INDEX idx_event_volunteers_event  ON event_volunteers(event_id);
CREATE INDEX idx_event_volunteers_member ON event_volunteers(member_id);

ALTER TABLE event_volunteers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven voluntarios de eventos"
  ON event_volunteers FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan voluntarios de eventos"
  ON event_volunteers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'director')
      AND mr.is_active = TRUE
  ));

-- Vistas Power BI — asistencia
CREATE OR REPLACE VIEW vw_asistencia_semanal AS
SELECT
  DATE_TRUNC('week', ec.checked_in_at)::DATE   AS semana,
  e.event_type,
  e.title                                        AS evento,
  COUNT(*)                                       AS total_asistentes,
  COUNT(ec.member_id)                            AS miembros,
  COUNT(*) FILTER (WHERE ec.member_id IS NULL)   AS visitantes
FROM event_checkins ec
JOIN events e ON e.id = ec.event_id
GROUP BY 1, 2, 3
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW vw_asistencia_mensual AS
SELECT
  DATE_TRUNC('month', ec.checked_in_at)::DATE  AS mes,
  e.event_type,
  COUNT(*)                                       AS total_asistentes,
  COUNT(DISTINCT ec.member_id)                   AS miembros_unicos,
  COUNT(DISTINCT e.id)                           AS eventos_realizados
FROM event_checkins ec
JOIN events e ON e.id = ec.event_id
GROUP BY 1, 2
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW vw_asistentes AS
SELECT
  m.id,
  m.first_name || ' ' || m.last_name  AS nombre,
  m.cedula,
  m.phone,
  m.province,
  m.canton,
  COUNT(ec.id)                         AS total_asistencias,
  MAX(ec.checked_in_at)                AS ultima_asistencia
FROM members m
LEFT JOIN event_checkins ec ON ec.member_id = m.id
WHERE m.is_active = TRUE
GROUP BY m.id, m.first_name, m.last_name, m.cedula, m.phone, m.province, m.canton;

-- ============================================================
-- BLOQUE 4: ESTUDIOS BÍBLICOS
-- ============================================================

CREATE TABLE study_plans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  description         TEXT,
  level               TEXT NOT NULL CHECK (level IN (
                        'niveles', 'etapa_inicial', 'etapa_intermedia', 'campanas'
                      )),
  cost                NUMERIC(10,2) DEFAULT 0,
  requires_donor      BOOLEAN DEFAULT FALSE,
  requires_attendance BOOLEAN DEFAULT FALSE,
  min_attendance_pct  INT DEFAULT 0,
  mentor_id           UUID REFERENCES members(id) ON DELETE SET NULL,
  max_students        INT,
  duration_weeks      INT,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven planes"
  ON study_plans FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan planes"
  ON study_plans FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'director')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER set_updated_at_study_plans
  BEFORE UPDATE ON study_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE study_groups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id      UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  leader_id    UUID REFERENCES members(id) ON DELETE SET NULL,
  sede         TEXT,
  schedule     TEXT,
  starts_at    DATE,
  ends_at      DATE,
  status       TEXT DEFAULT 'active' CHECK (status IN (
                 'active', 'completed', 'cancelled', 'paused'
               )),
  max_students INT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_groups_plan   ON study_groups(plan_id);
CREATE INDEX idx_study_groups_leader ON study_groups(leader_id);
CREATE INDEX idx_study_groups_status ON study_groups(status);

ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven grupos"
  ON study_groups FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan grupos"
  ON study_groups FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'director')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER set_updated_at_study_groups
  BEFORE UPDATE ON study_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE study_enrollments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id       UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status         TEXT DEFAULT 'enrolled' CHECK (status IN (
                   'enrolled', 'waitlist', 'completed', 'dropped', 'transferred'
                 )),
  enrolled_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  dropped_at     TIMESTAMPTZ,
  drop_reason    TEXT,
  transferred_to UUID REFERENCES study_groups(id),
  grade          NUMERIC(4,2),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, member_id)
);

CREATE INDEX idx_enrollments_group  ON study_enrollments(group_id);
CREATE INDEX idx_enrollments_member ON study_enrollments(member_id);
CREATE INDEX idx_enrollments_status ON study_enrollments(status);

ALTER TABLE study_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Miembros ven sus inscripciones"
  ON study_enrollments FOR SELECT
  USING (
    member_id = auth.uid()::uuid
    OR EXISTS (
      SELECT 1 FROM member_roles mr
      WHERE mr.member_id = auth.uid()::uuid
        AND mr.role IN ('admin', 'staff_leader', 'director')
        AND mr.is_active = TRUE
    )
  );
CREATE POLICY "Admins gestionan inscripciones"
  ON study_enrollments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'director')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER audit_enrollments
  AFTER INSERT OR UPDATE OR DELETE ON study_enrollments
  FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER set_updated_at_enrollments
  BEFORE UPDATE ON study_enrollments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE study_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id     UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  topic        TEXT,
  notes        TEXT,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_group ON study_sessions(group_id);
CREATE INDEX idx_sessions_date  ON study_sessions(session_date);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven sesiones"
  ON study_sessions FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan sesiones"
  ON study_sessions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'director')
      AND mr.is_active = TRUE
  ));

CREATE TABLE study_attendance (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  present     BOOLEAN DEFAULT TRUE,
  notes       TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, member_id)
);

CREATE INDEX idx_study_attendance_session ON study_attendance(session_id);
CREATE INDEX idx_study_attendance_member  ON study_attendance(member_id);

ALTER TABLE study_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven asistencia estudios"
  ON study_attendance FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan asistencia estudios"
  ON study_attendance FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'director')
      AND mr.is_active = TRUE
  ));

-- ============================================================
-- BLOQUE 5: FINANZAS
-- ============================================================

CREATE TABLE payment_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven categorías"
  ON payment_categories FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan categorías"
  ON payment_categories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'finance')
      AND mr.is_active = TRUE
  ));

CREATE TABLE payments (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id          UUID REFERENCES members(id) ON DELETE SET NULL,
  category_id        UUID REFERENCES payment_categories(id) ON DELETE SET NULL,
  amount             NUMERIC(12,2) NOT NULL,
  currency           TEXT DEFAULT 'CRC' CHECK (currency IN ('CRC', 'USD')),
  payment_method     TEXT CHECK (payment_method IN (
                       'efectivo', 'sinpe', 'transferencia', 'tarjeta', 'otro'
                     )),
  reference_code     TEXT,
  status             TEXT DEFAULT 'completed' CHECK (status IN (
                       'completed', 'pending', 'refunded', 'cancelled'
                     )),
  payment_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  description        TEXT,
  study_group_id     UUID REFERENCES study_groups(id) ON DELETE SET NULL,
  event_id           UUID REFERENCES events(id) ON DELETE SET NULL,
  scholarship        BOOLEAN DEFAULT FALSE,
  scholarship_reason TEXT,
  recorded_by        UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_member   ON payments(member_id);
CREATE INDEX idx_payments_category ON payments(category_id);
CREATE INDEX idx_payments_date     ON payments(payment_date);
CREATE INDEX idx_payments_status   ON payments(status);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance ve todos los pagos"
  ON payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'finance', 'staff_leader')
      AND mr.is_active = TRUE
  ));
CREATE POLICY "Miembros ven sus pagos"
  ON payments FOR SELECT
  USING (member_id = auth.uid()::uuid);
CREATE POLICY "Finance registra pagos"
  ON payments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'finance')
      AND mr.is_active = TRUE
  ));
CREATE POLICY "Finance actualiza pagos"
  ON payments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'finance')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER set_updated_at_payments
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE scholarships (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  study_group_id UUID REFERENCES study_groups(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL,
  reason         TEXT NOT NULL,
  approved_by    UUID REFERENCES auth.users(id),
  approved_at    TIMESTAMPTZ,
  status         TEXT DEFAULT 'pending' CHECK (status IN (
                   'pending', 'approved', 'rejected', 'cancelled'
                 )),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scholarships_member ON scholarships(member_id);
CREATE INDEX idx_scholarships_status ON scholarships(status);

ALTER TABLE scholarships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance ve becas"
  ON scholarships FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'finance', 'staff_leader')
      AND mr.is_active = TRUE
  ));
CREATE POLICY "Finance gestiona becas"
  ON scholarships FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'finance')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER audit_scholarships
  AFTER INSERT OR UPDATE OR DELETE ON scholarships
  FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER set_updated_at_scholarships
  BEFORE UPDATE ON scholarships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Vista resumen financiero (Power BI)
CREATE OR REPLACE VIEW vw_resumen_financiero AS
SELECT
  DATE_TRUNC('month', payment_date)::DATE  AS mes,
  pc.name                                   AS categoria,
  pc.type                                   AS tipo,
  currency,
  COUNT(*)                                  AS cantidad_pagos,
  SUM(amount)                               AS total,
  SUM(amount) FILTER (WHERE scholarship)    AS total_becas
FROM payments p
LEFT JOIN payment_categories pc ON pc.id = p.category_id
WHERE p.status = 'completed'
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC;

-- ============================================================
-- BLOQUE 6: FORMULARIOS
-- ============================================================

CREATE TABLE forms (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                    TEXT NOT NULL,
  description              TEXT,
  slug                     TEXT UNIQUE,
  is_public                BOOLEAN DEFAULT FALSE,
  is_active                BOOLEAN DEFAULT TRUE,
  requires_auth            BOOLEAN DEFAULT TRUE,
  allow_multiple_responses BOOLEAN DEFAULT FALSE,
  starts_at                TIMESTAMPTZ,
  ends_at                  TIMESTAMPTZ,
  created_by               UUID REFERENCES auth.users(id),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forms_slug   ON forms(slug);
CREATE INDEX idx_forms_active ON forms(is_active);

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven formularios activos"
  ON forms FOR SELECT
  USING (is_active = TRUE AND (is_public = TRUE OR auth.role() = 'authenticated'));
CREATE POLICY "Admins gestionan formularios"
  ON forms FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'comms')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER set_updated_at_forms
  BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE form_fields (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id    UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN (
               'text', 'textarea', 'number', 'email', 'phone',
               'date', 'select', 'multiselect', 'checkbox',
               'radio', 'scale', 'file', 'personal_data', 'section_header'
             )),
  label      TEXT NOT NULL,
  placeholder TEXT,
  help_text  TEXT,
  is_required BOOLEAN DEFAULT FALSE,
  options    JSONB,
  conditions JSONB,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_form_fields_form  ON form_fields(form_id);
CREATE INDEX idx_form_fields_order ON form_fields(form_id, sort_order);

ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven campos"
  ON form_fields FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan campos"
  ON form_fields FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'comms')
      AND mr.is_active = TRUE
  ));

CREATE TABLE form_responses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id      UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  member_id    UUID REFERENCES members(id) ON DELETE SET NULL,
  guest_email  TEXT,
  guest_name   TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address   INET,
  CONSTRAINT response_member_or_guest CHECK (
    member_id IS NOT NULL OR guest_email IS NOT NULL
  )
);

CREATE INDEX idx_responses_form   ON form_responses(form_id);
CREATE INDEX idx_responses_member ON form_responses(member_id);

ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Miembros ven sus respuestas"
  ON form_responses FOR SELECT
  USING (
    member_id = auth.uid()::uuid
    OR EXISTS (
      SELECT 1 FROM member_roles mr
      WHERE mr.member_id = auth.uid()::uuid
        AND mr.role IN ('admin', 'staff_leader', 'comms')
        AND mr.is_active = TRUE
    )
  );
CREATE POLICY "Autenticados envían respuestas"
  ON form_responses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE TRIGGER audit_form_responses
  AFTER INSERT OR UPDATE OR DELETE ON form_responses
  FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TABLE form_response_values (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  field_id    UUID NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
  value_text  TEXT,
  value_json  JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_response_values_response ON form_response_values(response_id);
CREATE INDEX idx_response_values_field    ON form_response_values(field_id);

ALTER TABLE form_response_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mismo acceso que form_responses"
  ON form_response_values FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM form_responses fr
    WHERE fr.id = response_id
      AND (
        fr.member_id = auth.uid()::uuid
        OR EXISTS (
          SELECT 1 FROM member_roles mr
          WHERE mr.member_id = auth.uid()::uuid
            AND mr.role IN ('admin', 'staff_leader', 'comms')
            AND mr.is_active = TRUE
        )
      )
  ));
CREATE POLICY "Autenticados insertan valores"
  ON form_response_values FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- BLOQUE 7: COMUNICACIONES
-- ============================================================

CREATE TABLE message_templates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  channel    TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'both')),
  subject    TEXT,
  body       TEXT NOT NULL,
  variables  JSONB,
  is_active  BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven plantillas"
  ON message_templates FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan plantillas"
  ON message_templates FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'comms')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER set_updated_at_templates
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE message_broadcasts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id      UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  channel          TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'both')),
  subject          TEXT,
  body             TEXT NOT NULL,
  recipient_filter JSONB,
  total_recipients INT DEFAULT 0,
  sent_count       INT DEFAULT 0,
  failed_count     INT DEFAULT 0,
  status           TEXT DEFAULT 'draft' CHECK (status IN (
                     'draft', 'scheduled', 'sending', 'completed', 'cancelled'
                   )),
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broadcasts_status  ON message_broadcasts(status);
CREATE INDEX idx_broadcasts_created ON message_broadcasts(created_at DESC);

ALTER TABLE message_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comms ve broadcasts"
  ON message_broadcasts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'comms')
      AND mr.is_active = TRUE
  ));
CREATE POLICY "Comms gestiona broadcasts"
  ON message_broadcasts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'comms')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER audit_broadcasts
  AFTER INSERT OR UPDATE OR DELETE ON message_broadcasts
  FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER set_updated_at_broadcasts
  BEFORE UPDATE ON message_broadcasts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE message_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID REFERENCES message_broadcasts(id) ON DELETE CASCADE,
  member_id    UUID REFERENCES members(id) ON DELETE SET NULL,
  channel      TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  recipient    TEXT NOT NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN (
                 'pending', 'sent', 'delivered', 'failed', 'bounced'
               )),
  error_message TEXT,
  sent_at      TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_logs_broadcast ON message_logs(broadcast_id);
CREATE INDEX idx_message_logs_member    ON message_logs(member_id);
CREATE INDEX idx_message_logs_status    ON message_logs(status);

ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comms ve logs"
  ON message_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'comms')
      AND mr.is_active = TRUE
  ));

-- ============================================================
-- BLOQUE 8: EMPLEADOS
-- ============================================================

CREATE TABLE employees (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id          UUID REFERENCES members(id) ON DELETE SET NULL,
  employee_code      TEXT UNIQUE,
  position           TEXT NOT NULL,
  department         TEXT,
  employment_type    TEXT CHECK (employment_type IN (
                       'full_time', 'part_time', 'contractor', 'volunteer_paid'
                     )),
  start_date         DATE NOT NULL,
  end_date           DATE,
  salary             NUMERIC(12,2),
  salary_currency    TEXT DEFAULT 'CRC',
  status             TEXT DEFAULT 'active' CHECK (status IN (
                       'active', 'inactive', 'on_leave', 'terminated'
                     )),
  termination_reason TEXT,
  notes              TEXT,
  created_by         UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employees_member ON employees(member_id);
CREATE INDEX idx_employees_status ON employees(status);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins ven empleados"
  ON employees FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'finance')
      AND mr.is_active = TRUE
  ));
CREATE POLICY "Admins gestionan empleados"
  ON employees FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON employees
  FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER set_updated_at_employees
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE employee_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type    TEXT NOT NULL CHECK (doc_type IN (
                'contrato', 'cedula', 'titulo', 'certificado',
                'evaluacion', 'permiso', 'otro'
              )),
  title       TEXT NOT NULL,
  file_url    TEXT,
  expires_at  DATE,
  notes       TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emp_docs_employee ON employee_documents(employee_id);

ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins ven documentos empleados"
  ON employee_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader')
      AND mr.is_active = TRUE
  ));
CREATE POLICY "Admins gestionan documentos empleados"
  ON employee_documents FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader')
      AND mr.is_active = TRUE
  ));
