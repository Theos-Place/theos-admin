-- Guardar el messageId que devuelve SES al enviar, para poder casar los eventos
-- que llegan después por SNS (Delivery, Bounce, Complaint) con el envío exacto.
--
-- Sin esto el webhook solo podía casar por dirección de correo, que es ambiguo
-- cuando la misma persona recibe varios comunicados: el evento de entrega de uno
-- podía marcar el log de otro.
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS provider_message_id text;

-- Búsqueda por messageId desde el webhook (solo email lo tiene).
CREATE INDEX IF NOT EXISTS idx_message_logs_provider_message_id
  ON message_logs(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
