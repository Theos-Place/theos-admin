-- REU-1: zonas con selección múltiple en las solicitudes de estudio.
-- Las solicitudes viejas guardaban UNA zona en proposed_location (texto) —
-- se mantienen y el código las lee como fallback ([proposed_location]).
ALTER TABLE study_requests ADD COLUMN IF NOT EXISTS proposed_zones text[] NOT NULL DEFAULT '{}';
