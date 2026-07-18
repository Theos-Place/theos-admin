-- Claim atómico de la cola de emails (auditoría 2026-06-11, hallazgo S6):
-- dos ejecuciones concurrentes de processPendingEmails leían los mismos
-- 'pending' y enviaban duplicado. Ahora el lote se reclama con un UPDATE
-- condicional a estado 'sending' (atómico por fila) antes de enviar.

ALTER TABLE message_logs DROP CONSTRAINT message_logs_status_check;
ALTER TABLE message_logs ADD CONSTRAINT message_logs_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'bounced'));

-- Para recuperar claims huérfanos (proceso muerto entre claim y envío).
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
