-- 057: Canal 'interna' para broadcasts (decisión 2026-06-11): mientras no se
-- configure el correo (Brevo), las comunicaciones se entregan como
-- notificaciones internas (internal_notifications) a cada destinatario.

ALTER TABLE message_broadcasts DROP CONSTRAINT IF EXISTS message_broadcasts_channel_check;
ALTER TABLE message_broadcasts ADD CONSTRAINT message_broadcasts_channel_check
  CHECK (channel IN ('whatsapp', 'email', 'both', 'interna'));

ALTER TABLE message_logs DROP CONSTRAINT IF EXISTS message_logs_channel_check;
ALTER TABLE message_logs ADD CONSTRAINT message_logs_channel_check
  CHECK (channel IN ('whatsapp', 'email', 'interna'));
