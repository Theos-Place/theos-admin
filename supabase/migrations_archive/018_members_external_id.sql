-- 018: ID externo del miembro (el del sistema viejo). Sirve como llave de
-- deduplicación en la importación y para cruzar data relacionada (pagos,
-- donaciones, asistencias) que viene con ese mismo ID.
-- Se guarda como TEXT aunque hoy sea numérico, para no perder ceros a la
-- izquierda ni atarnos al formato actual.

ALTER TABLE members ADD COLUMN external_id TEXT;

CREATE UNIQUE INDEX idx_members_external_id ON members(external_id) WHERE external_id IS NOT NULL;
