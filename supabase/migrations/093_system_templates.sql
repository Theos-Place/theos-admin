-- Plantillas del SISTEMA (transaccionales): editables pero NO borrables, que el
-- código busca por system_key para enviar correos automáticos.
--   is_system            → true = plantilla del sistema (protegida de borrado).
--   system_key           → clave única con la que el código la busca (ej.
--                          'bienvenida', 'form_asignado'). Marketing = NULL.
--   available_variables  → variables {{...}} que acepta (para mostrarlas al editar).
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS is_system           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_key          TEXT,
  ADD COLUMN IF NOT EXISTS available_variables JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_system_key
  ON message_templates(system_key) WHERE system_key IS NOT NULL;
