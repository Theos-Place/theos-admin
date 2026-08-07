-- INT-3 · Moneda por defecto de la sede.
-- Sin esto alguien crea un evento de Madrid en colones y nadie se entera hasta
-- que cobra. La moneda se PROPONE al crear; queda editable y se guarda en el
-- registro: si mañana cambia la de la sede, lo viejo NO cambia.
ALTER TABLE public.sedes
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CRC';

ALTER TABLE public.sedes DROP CONSTRAINT IF EXISTS sedes_currency_check;
ALTER TABLE public.sedes
  ADD CONSTRAINT sedes_currency_check CHECK (currency IN ('CRC', 'USD', 'EUR'));

COMMENT ON COLUMN public.sedes.currency IS
  'INT-3: moneda por defecto de la sede. Solo PROPONE el valor en los formularios; el registro guarda la suya.';

-- Las dos sedes de Madrid (madrid y madrid-home) cobran en euros.
UPDATE public.sedes SET currency = 'EUR' WHERE code IN ('madrid', 'madrid-home');
