-- 020: quitar UNIQUE de members.email. En la práctica varias personas comparten
-- correo (familias, parejas), así que el email no es identificador único.
-- La unicidad real la dan external_id y cedula.

ALTER TABLE members DROP CONSTRAINT IF EXISTS members_email_key;
