-- 016: Comunicaciones — categoría en plantillas, config de canales y campos de
-- segmento/config en broadcasts. Las stats de entrega se derivan de message_logs.

-- ─────────────────────────────────────────────────────────────────────────────
-- channel_configs: configuración de canales SMTP / WhatsApp
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE channel_configs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type             TEXT NOT NULL CHECK (type IN ('smtp', 'whatsapp')),
  name             TEXT NOT NULL,
  smtp_host        TEXT,
  smtp_port        INT,
  smtp_user        TEXT,
  smtp_from_name   TEXT,
  smtp_from_email  TEXT,
  wa_account_id    TEXT,
  wa_phone_number  TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  is_verified      BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_channel_configs
  BEFORE UPDATE ON channel_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- message_templates: categoría
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE message_templates ADD COLUMN category TEXT CHECK (category IN (
  'bienvenida', 'recordatorio', 'inscripcion', 'cancelacion', 'general'
));

-- ─────────────────────────────────────────────────────────────────────────────
-- message_broadcasts: segmento, configs y enum de estado del frontend
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE message_broadcasts
  ADD COLUMN segment_label       TEXT,
  ADD COLUMN smtp_config_id      UUID REFERENCES channel_configs(id) ON DELETE SET NULL,
  ADD COLUMN whatsapp_config_id  UUID REFERENCES channel_configs(id) ON DELETE SET NULL;

ALTER TABLE message_broadcasts ALTER COLUMN status DROP DEFAULT;
ALTER TABLE message_broadcasts DROP CONSTRAINT IF EXISTS message_broadcasts_status_check;
UPDATE message_broadcasts SET status = 'draft'
  WHERE status NOT IN ('draft', 'sending', 'sent', 'failed', 'partial');
ALTER TABLE message_broadcasts ADD CONSTRAINT message_broadcasts_status_check
  CHECK (status IN ('draft', 'sending', 'sent', 'failed', 'partial'));
ALTER TABLE message_broadcasts ALTER COLUMN status SET DEFAULT 'draft';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS en channel_configs (patrón normalizado)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE channel_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channel_configs_select" ON channel_configs FOR SELECT TO authenticated USING ((select auth.role()) = 'authenticated');
CREATE POLICY "channel_configs_insert" ON channel_configs FOR INSERT TO authenticated WITH CHECK (private.is_admin());
CREATE POLICY "channel_configs_update" ON channel_configs FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "channel_configs_delete" ON channel_configs FOR DELETE TO authenticated USING (private.is_admin());
