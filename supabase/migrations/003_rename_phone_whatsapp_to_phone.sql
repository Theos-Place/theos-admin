-- ============================================================
-- Renombrar members.phone_whatsapp → members.phone
-- ============================================================
-- El código frontend espera `phone`. El schema original (001) la creó como
-- `phone_whatsapp` y se renombró luego para alinear con el código de dominio.

ALTER TABLE members RENAME COLUMN phone_whatsapp TO phone;
