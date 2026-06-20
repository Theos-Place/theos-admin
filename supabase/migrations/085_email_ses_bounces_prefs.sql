-- 085: Email vía AWS SES — manejo de rebotes/quejas y preferencias de suscripción.
--
-- members:
--   email_bounced / email_complained  → la dirección no debe recibir más correo
--     (bounce duro o queja de spam reportada por SES vía SNS). Se excluyen del envío.
--   newsletter_opt_out                → el miembro se dio de baja del newsletter
--     (link de unsubscribe). Solo afecta correo de marketing, no el transaccional.
--   unsubscribe_token                 → token estable para el link de baja sin login.
-- message_broadcasts.kind: 'marketing' (respeta opt-out + lleva unsubscribe) vs
--   'transactional' (siempre se envía, sin unsubscribe).
-- message_logs.status: se agrega 'complained' (queja de spam).

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS email_bounced        BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_bounced_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_complained     BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_complained_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS newsletter_opt_out   BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS newsletter_opt_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unsubscribe_token    UUID        DEFAULT gen_random_uuid();

-- Backfill de tokens para filas viejas (el DEFAULT solo aplica a inserts nuevos
-- en algunas versiones; lo forzamos para todas).
UPDATE members SET unsubscribe_token = gen_random_uuid() WHERE unsubscribe_token IS NULL;
ALTER TABLE members ALTER COLUMN unsubscribe_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_unsubscribe_token ON members(unsubscribe_token);
-- Para excluir rápido del envío.
CREATE INDEX IF NOT EXISTS idx_members_email_blocked
  ON members(email_bounced, email_complained, newsletter_opt_out);

-- Tipo de broadcast: marketing (default) vs transaccional.
ALTER TABLE message_broadcasts
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'marketing';
ALTER TABLE message_broadcasts DROP CONSTRAINT IF EXISTS message_broadcasts_kind_check;
ALTER TABLE message_broadcasts ADD CONSTRAINT message_broadcasts_kind_check
  CHECK (kind IN ('marketing', 'transactional'));

-- message_logs: agregar 'complained' al estado.
ALTER TABLE message_logs DROP CONSTRAINT IF EXISTS message_logs_status_check;
ALTER TABLE message_logs ADD CONSTRAINT message_logs_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'complained'));
