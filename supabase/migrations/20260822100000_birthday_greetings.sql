-- DIR-2 · Saludo de cumpleaños a servidores y dirigentes.
--
-- 1) Registro de envíos con UNIQUE (miembro, año): el dedupe anual queda
--    garantizado por la BD, no por un "consultá y después insertá" que dos
--    corridas simultáneas del cron podrían saltarse.
-- 2) Plantilla EDITABLE por comunicaciones: is_system = FALSE a propósito (así
--    la pueden cambiar y hasta borrar). getSystemTemplate la busca por
--    system_key sin exigir is_system, y si no está hay un fallback en código.

CREATE TABLE IF NOT EXISTS public.birthday_greetings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  -- Año del SALUDO, no de nacimiento. A quien cumple el 29 de febrero se le
  -- felicita el 28 en los años no bisiestos, y el año es igual el del saludo.
  year       int  NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birthday_greetings_unique UNIQUE (member_id, year)
);

COMMENT ON TABLE public.birthday_greetings IS
  'DIR-2: a quién ya se le mandó el saludo de cumpleaños y en qué año. El UNIQUE es el dedupe anual.';

CREATE INDEX IF NOT EXISTS idx_birthday_greetings_year ON public.birthday_greetings (year);

-- Las queries de la app usan service role; RLS es defensa en profundidad. Nadie
-- necesita leer esto desde el cliente: es bitácora del cron.
ALTER TABLE public.birthday_greetings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY birthday_greetings_staff ON public.birthday_greetings
    FOR SELECT TO authenticated
    USING (private.has_any_role(ARRAY['admin', 'direccion', 'comunicaciones']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON TABLE public.birthday_greetings TO authenticated;
GRANT ALL ON TABLE public.birthday_greetings TO service_role;

-- ── Plantilla ───────────────────────────────────────────────────────────────

INSERT INTO public.message_templates (name, channel, subject, body, body_format, category, is_system, system_key, is_active, available_variables)
SELECT
  'Feliz cumpleaños', 'email',
  '¡Feliz cumpleaños, {{nombre}}!',
  '<p>Hola {{nombre}},</p>

   <p>Hoy es tu día y queríamos saludarte. <strong>¡Feliz cumpleaños!</strong></p>

   <p>Gracias por servir en Theos Place. Tu entrega no pasa desapercibida: detrás de cada
   estudio, cada actividad y cada persona acompañada, hay alguien como vos poniendo su tiempo
   y su corazón.</p>

   <p>Que este año nuevo de vida venga lleno de la cercanía de Dios.</p>

   <p>Con cariño,<br>Equipo Theos Place</p>',
  'html', 'general',
  -- EDITABLE: comunicaciones puede cambiar el texto sin tocar código.
  false, 'cumpleanos', true,
  '["nombre"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.message_templates WHERE system_key = 'cumpleanos');
