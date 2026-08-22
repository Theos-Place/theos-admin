-- MIG-1 Etapa 0 · Registro de lo que el modo silencioso NO envió.
--
-- Sin esto el modo silencioso es ciego: el requisito de la ficha es poder ver
-- "qué habría enviado el sistema en las últimas 24 h" ANTES de apagarlo, y si la
-- lista no está limpia, no se apaga. Un console.warn no sirve — los logs de
-- Vercel rotan y no se pueden agrupar ni contar.
--
-- No se guarda el CUERPO del correo, solo destinatario y asunto: es lo que hace
-- falta para revisar, y guardar el HTML de miles de correos sería acumular datos
-- personales sin razón.

CREATE TABLE IF NOT EXISTS public.silenced_emails (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient    text NOT NULL,
  subject      text NOT NULL,
  /** 'marketing' | 'transactional' — el mismo `kind` que recibió sendEmail. */
  kind         text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.silenced_emails IS
  'MIG-1 Etapa 0: correos que el modo silencioso (EMAIL_SILENT_MODE) NO envió. Se revisa antes de apagar el modo; ver scripts/reporte-correos-silenciados.ts.';

-- El reporte es siempre "las últimas N horas": ese es el índice que importa.
CREATE INDEX IF NOT EXISTS idx_silenced_emails_attempted
  ON public.silenced_emails (attempted_at DESC);

ALTER TABLE public.silenced_emails ENABLE ROW LEVEL SECURITY;

-- Solo quien administra: la lista es un mapa de a quién le habría escrito el
-- sistema. Las escrituras van por service role desde sendEmail.
DO $$
BEGIN
  CREATE POLICY silenced_emails_select ON public.silenced_emails
    FOR SELECT TO authenticated
    USING (private.is_admin() OR private.has_any_role(ARRAY['direccion', 'comunicaciones']));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, DELETE ON public.silenced_emails TO authenticated, service_role;
