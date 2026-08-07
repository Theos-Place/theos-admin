-- Comunicados programados: el estado 'scheduled' faltaba en el CHECK.
--
-- La columna scheduled_at existía desde siempre pero NUNCA se escribió: la
-- pantalla tenía el toggle "Programar envío" y el botón cambiaba de texto, pero
-- el código llamaba a /send igual que "Enviar ahora". Todo salía al instante.
ALTER TABLE public.message_broadcasts DROP CONSTRAINT IF EXISTS message_broadcasts_status_check;
ALTER TABLE public.message_broadcasts
  ADD CONSTRAINT message_broadcasts_status_check
  CHECK (status = ANY (ARRAY['draft', 'scheduled', 'sending', 'sent', 'failed', 'partial']));

COMMENT ON COLUMN public.message_broadcasts.scheduled_at IS
  'Instante (UTC) en que debe salir. Con status=scheduled lo recoge el cron /api/cron/scheduled-broadcasts.';

COMMENT ON COLUMN public.message_broadcasts.recipient_filter IS
  'Con status=scheduled: {"recipients": [{member_id, channel}]} — a quién mandarle cuando llegue la hora.';

CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled
  ON public.message_broadcasts (scheduled_at)
  WHERE status = 'scheduled';
