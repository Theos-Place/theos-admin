-- Preferencias de notificación por miembro. NO incluye la suscripción de
-- marketing: esa vive en members.newsletter_opt_out (fuente única, sincronizada
-- con /unsubscribe y los complaints de SES). Acá solo los toggles internos y el
-- canal preferido. Si un miembro no tiene fila, se asumen los defaults.
CREATE TABLE member_notification_prefs (
  member_id              UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  recordatorios_eventos  BOOLEAN NOT NULL DEFAULT true,
  grupo_estudio          BOOLEAN NOT NULL DEFAULT true,
  mensajes_sistema       BOOLEAN NOT NULL DEFAULT true,
  canal_preferido        TEXT    NOT NULL DEFAULT 'email' CHECK (canal_preferido IN ('email', 'whatsapp', 'ambos')),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE member_notification_prefs ENABLE ROW LEVEL SECURITY;

-- Cada miembro lee/escribe SOLO su fila (members.auth_user_id = auth.uid());
-- admin pasa por todo. Las rutas API usan service role + guard igualmente.
CREATE POLICY "mnp_select" ON member_notification_prefs FOR SELECT TO authenticated
  USING (private.is_admin() OR member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid())));
CREATE POLICY "mnp_insert" ON member_notification_prefs FOR INSERT TO authenticated
  WITH CHECK (private.is_admin() OR member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid())));
CREATE POLICY "mnp_update" ON member_notification_prefs FOR UPDATE TO authenticated
  USING (private.is_admin() OR member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid())))
  WITH CHECK (private.is_admin() OR member_id IN (SELECT m.id FROM members m WHERE m.auth_user_id = (SELECT auth.uid())));
