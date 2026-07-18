-- 023: quitar UNIQUE de members.cedula. La data migrada tiene cédulas repetidas
-- (re-registros con distinto external_id). La llave de identidad/dedup real es
-- external_id; los duplicados por cédula se revisan con detección de duplicados.

ALTER TABLE members DROP CONSTRAINT IF EXISTS members_cedula_key;
