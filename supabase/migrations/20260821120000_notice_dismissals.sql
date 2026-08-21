-- FIN-2 · Descartes de avisos de perfil, CON FECHA.
--
-- El aviso de "completá tu documento" es descartable y reaparece a los 14 días,
-- así que el descarte necesita fecha (un booleano lo silenciaría para siempre).
-- Tabla genérica por (miembro, aviso) para no agregar una columna a members
-- cada vez que aparezca un aviso nuevo. Mismo patrón que duplicate_dismissals.

CREATE TABLE IF NOT EXISTS public.notice_dismissals (
  member_id    uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  notice_key   text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, notice_key)
);

COMMENT ON TABLE public.notice_dismissals IS
  'Descartes de avisos de perfil por miembro, con fecha (FIN-2). notice_key: document_prompt.';

-- Las queries de la app usan service role; RLS es defensa en profundidad y
-- deja que un miembro vea/escriba SOLO sus propios descartes.
ALTER TABLE public.notice_dismissals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "notice_dismissals_self" ON public.notice_dismissals
    TO authenticated
    USING (private.is_own_member(member_id))
    WITH CHECK (private.is_own_member(member_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON TABLE public.notice_dismissals TO authenticated;
GRANT ALL ON TABLE public.notice_dismissals TO service_role;
