-- Rediseño del flujo de vacantes (solicitud de cupos del comité).
-- Nuevo flujo lineal de 4 estados: creado → enviado_lider → aprobado / denegado.
--
-- En Tanda A solo necesitamos que el CHECK acepte los estados nuevos (el carrito
-- guarda en 'creado'). Mantenemos los viejos en el CHECK por compatibilidad con
-- los escritores que aún no migran (vacantes/nueva, import). Tanda B finaliza la
-- migración: remapea datos viejos→nuevos y deja el CHECK solo con los 4 nuevos.
--
-- Mapa de estados viejos→nuevos (para Tanda B; hoy la tabla está vacía, 0 filas):
--   draft     → creado
--   published → enviado_lider   (ya estaba "afuera", visible para revisar)
--   filled    → aprobado
--   closed    → denegado
-- (No se aplica UPDATE acá porque no hay datos; se documenta el criterio.)

ALTER TABLE vacancies DROP CONSTRAINT IF EXISTS vacancies_status_check;
ALTER TABLE vacancies ADD CONSTRAINT vacancies_status_check
  CHECK (status = ANY (ARRAY[
    'draft','published','filled','closed',
    'creado','enviado_lider','aprobado','denegado'
  ]::text[]));

ALTER TABLE vacancies ALTER COLUMN status SET DEFAULT 'creado';
