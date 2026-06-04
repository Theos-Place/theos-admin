-- 022: campos extra de sede (horario/ubicación) para que el catálogo de sedes
-- en la base refleje el del frontend.

ALTER TABLE sedes
  ADD COLUMN day           TEXT,
  ADD COLUMN time          TEXT,
  ADD COLUMN location      TEXT,
  ADD COLUMN age_group     TEXT,
  ADD COLUMN waze_url      TEXT,
  ADD COLUMN is_historical BOOLEAN DEFAULT FALSE;
