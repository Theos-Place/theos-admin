-- 044: cola de emails con rate limiting (Brevo free tier: 300/día).
-- Los blasts grandes se distribuyen en días: cada log lleva su fecha
-- programada y el cron diario procesa los pendientes del día.

ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS scheduled_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_message_logs_queue
  ON message_logs(status, scheduled_date, channel)
  WHERE status = 'pending';

-- Para el conteo diario de enviados (rate limit).
CREATE INDEX IF NOT EXISTS idx_message_logs_sent_at
  ON message_logs(channel, sent_at)
  WHERE status IN ('sent', 'delivered');
