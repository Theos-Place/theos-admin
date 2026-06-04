-- 019: cambiar el índice único parcial de external_id por uno normal, para que
-- ON CONFLICT (upsert por external_id) funcione. En Postgres los NULL son
-- distintos entre sí, así que un único normal sigue permitiendo varios miembros
-- sin external_id.

DROP INDEX IF EXISTS idx_members_external_id;
ALTER TABLE members ADD CONSTRAINT members_external_id_key UNIQUE (external_id);
