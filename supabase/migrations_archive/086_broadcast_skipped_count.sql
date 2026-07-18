-- 086: contador de destinatarios SALTADOS por broadcast (excluidos del envío
-- por baja de newsletter / rebote / queja). Complementa sent_count y failed_count.
ALTER TABLE message_broadcasts
  ADD COLUMN IF NOT EXISTS skipped_count INT DEFAULT 0;
