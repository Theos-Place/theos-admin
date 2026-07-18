-- ============================================================
-- member_roles.status_detail — sub-estado por rol
-- ============================================================
-- Para el rol 'dirigente' los valores son 'activo' | 'en_descanso' | 'disponible'.
-- Para otros roles la columna queda NULL.
-- La constraint sólo aplica cuando role = 'dirigente'; otros roles pueden usar
-- la columna en el futuro con sus propios valores (sin restricción acá).

ALTER TABLE member_roles ADD COLUMN status_detail TEXT;

ALTER TABLE member_roles ADD CONSTRAINT chk_dirigente_status_detail
  CHECK (
    role <> 'dirigente'
    OR status_detail IS NULL
    OR status_detail IN ('activo', 'en_descanso', 'disponible')
  );

CREATE INDEX idx_member_roles_status_detail
  ON member_roles(role, status_detail)
  WHERE status_detail IS NOT NULL;
