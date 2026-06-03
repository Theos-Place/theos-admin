-- ============================================================
-- Renombrar members.phone_whatsapp → members.phone
-- ============================================================
-- El código frontend espera `phone`. El schema original (001) la creó como
-- `phone_whatsapp` y se renombró luego para alinear con el código de dominio.

-- Idempotente: 001 ya pudo haberse editado para crear la columna como `phone`.
-- Solo renombramos si todavía existe la columna vieja.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'phone_whatsapp'
  ) THEN
    ALTER TABLE members RENAME COLUMN phone_whatsapp TO phone;
  END IF;
END $$;
