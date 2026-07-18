-- 006: Alinear el esquema de eventos con el modelo del frontend (MockEvent).
-- El mock asume: catálogo editable de tipos, inscripciones con estado de pago,
-- sub-eventos, y varios flags (pago, encuesta, virtual, estado, recurrencia).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Catálogo de tipos de evento (editable desde /eventos/tipos)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_types (
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
  ('capacitacion', 'Capacitación',    '#519DA2', 'book-open', 'Formación de líderes')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven tipos de evento"
  ON event_types FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan tipos de evento"
  ON event_types FOR ALL USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'director')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER set_updated_at_event_types
  BEFORE UPDATE ON event_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Ampliar la tabla events
-- ─────────────────────────────────────────────────────────────────────────────

-- El event_type pasa de CHECK enum fijo a FK contra el catálogo.
-- Reasignamos cualquier valor previo fuera del catálogo a 'charla'.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check;
UPDATE events SET event_type = 'charla'
  WHERE event_type NOT IN (SELECT id FROM event_types);
DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_event_type_fkey'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_event_type_fkey
      FOREIGN KEY (event_type) REFERENCES event_types(id);
  END IF;
END;
$mig$;

ALTER TABLE events
  ADD COLUMN committee_id          TEXT,
  ADD COLUMN is_virtual            BOOLEAN DEFAULT FALSE,
  ADD COLUMN requires_registration BOOLEAN DEFAULT FALSE,
  ADD COLUMN requires_payment      BOOLEAN DEFAULT FALSE,
  ADD COLUMN payment_amount        NUMERIC(12,2),
  ADD COLUMN requires_survey       BOOLEAN DEFAULT FALSE,
  ADD COLUMN status                TEXT DEFAULT 'upcoming' CHECK (status IN (
                                     'upcoming', 'in_progress', 'finished', 'cancelled', 'archived'
                                   )),
  ADD COLUMN recurrence_end        TIMESTAMPTZ,
  ADD COLUMN cancellation_reason   TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Sub-eventos (cupos internos de un evento)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE sub_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  max_capacity INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sub_events_event ON sub_events(event_id);

ALTER TABLE sub_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven sub-eventos"
  ON sub_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan sub-eventos"
  ON sub_events FOR ALL USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'director')
      AND mr.is_active = TRUE
  ));

-- el checkin puede apuntar a un sub-evento
ALTER TABLE event_checkins
  ADD COLUMN sub_event_id UUID REFERENCES sub_events(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Inscripciones a eventos (con estado de pago)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE event_registrations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN (
                   'pending', 'paid', 'exempted'
                 )),
  registered_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, member_id)
);

CREATE INDEX idx_event_registrations_event  ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_member ON event_registrations(member_id);

ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven inscripciones"
  ON event_registrations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Autenticados se inscriben"
  ON event_registrations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan inscripciones"
  ON event_registrations FOR ALL USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'staff_leader', 'director')
      AND mr.is_active = TRUE
  ));
