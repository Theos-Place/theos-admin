-- ============================================================
-- THEOS PLACE — FASE 2: Sedes, donaciones y sede calculada del miembro
-- Junio 2026
-- ============================================================
-- Prerrequisito: 001_theos_schema.sql ya ejecutado.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SEDES
-- ------------------------------------------------------------

CREATE TABLE sedes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,            -- 'meridiano', 'antares', 'cartago', ...
  name       TEXT NOT NULL,                   -- 'Meridiano', 'Antares', 'Cartago', ...
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sedes_code   ON sedes(code);
CREATE INDEX idx_sedes_active ON sedes(is_active);

ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados ven sedes"
  ON sedes FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins gestionan sedes"
  ON sedes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM member_roles mr
    WHERE mr.member_id = auth.uid()::uuid
      AND mr.role IN ('admin', 'direccion')
      AND mr.is_active = TRUE
  ));

CREATE TRIGGER set_updated_at_sedes
  BEFORE UPDATE ON sedes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed inicial (los códigos que ya usa el UI en mock-members)
INSERT INTO sedes (code, name) VALUES
  ('meridiano',     'Meridiano'),
  ('antares',       'Antares'),
  ('cartago',       'Cartago'),
  ('pedregal',      'Pedregal'),
  ('alajuela',      'Alajuela'),
  ('guapiles',      'Guápiles'),
  ('potrero',       'Potrero'),
  ('perez-zeledon', 'Pérez Zeledón'),
  ('liberia',       'Liberia'),
  ('madrid',        'Madrid');

-- ------------------------------------------------------------
-- 2. events.sede_id (opcional — solo charlas la usan)
-- ------------------------------------------------------------

ALTER TABLE events ADD COLUMN sede_id UUID REFERENCES sedes(id) ON DELETE SET NULL;
CREATE INDEX idx_events_sede ON events(sede_id);

-- ------------------------------------------------------------
-- 3. members.sede_id (campo calculado, se recalcula vía trigger)
-- ------------------------------------------------------------

ALTER TABLE members ADD COLUMN sede_id UUID REFERENCES sedes(id) ON DELETE SET NULL;
CREATE INDEX idx_members_sede ON members(sede_id);

-- ------------------------------------------------------------
-- 4. payment_categories.is_donation
-- ------------------------------------------------------------

ALTER TABLE payment_categories ADD COLUMN is_donation BOOLEAN DEFAULT FALSE;

-- Seed: categoría 'Donación' por defecto. Más adelante se pueden marcar
-- otras categorías (Diezmo, Ofrenda especial, etc.) seteando is_donation = TRUE.
INSERT INTO payment_categories (name, type, is_donation)
VALUES ('Donación', 'income', TRUE);

-- ------------------------------------------------------------
-- 5. Función + trigger: recalcular members.sede_id desde event_checkins
-- ------------------------------------------------------------
-- Lógica: cuando se inserta un check-in a un evento que tiene sede_id,
-- recalculamos la sede más frecuente del miembro (basado en su historial
-- de check-ins a eventos con sede). Si nunca asistió a un evento con sede,
-- members.sede_id queda NULL.

CREATE OR REPLACE FUNCTION recalc_member_sede()
RETURNS TRIGGER AS $$
DECLARE
  v_sede_id UUID;
  v_member_id UUID;
BEGIN
  v_member_id := NEW.member_id;

  -- Sólo recalculamos para miembros (no para invitados)
  IF v_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sede más frecuente entre check-ins del miembro a eventos con sede definida
  SELECT e.sede_id INTO v_sede_id
  FROM event_checkins ec
  JOIN events e ON e.id = ec.event_id
  WHERE ec.member_id = v_member_id
    AND e.sede_id IS NOT NULL
  GROUP BY e.sede_id
  ORDER BY COUNT(*) DESC, MAX(ec.checked_in_at) DESC
  LIMIT 1;

  UPDATE members SET sede_id = v_sede_id WHERE id = v_member_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_member_sede
  AFTER INSERT ON event_checkins
  FOR EACH ROW EXECUTE FUNCTION recalc_member_sede();
