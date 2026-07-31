-- Manual de Puestos Madre 2026: las "habilidades" del puesto pasan a campo
-- propio (antes no existía: el manual las trae aparte de funciones y perfil).
-- Texto libre; puede llevar bullets • como functions/profile.
ALTER TABLE service_positions ADD COLUMN IF NOT EXISTS skills text;
