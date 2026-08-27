-- El tiquete de folletos vuelve a generarse al CERRAR un grupo (2026-08-27),
-- para el grupo SUCESOR que crea la auto-matrícula.
--
-- Por qué hizo falta: FOL-1 dejó la generación en dos reglas que corren durante
-- la matrícula (cupo lleno / fin de ventana), pero el grupo sucesor nace SIN
-- cupo y SIN ventana, así que ninguna de las dos se puede disparar nunca para
-- él. Resultado medido en producción: 0 tiquetes de folleto en toda la base.
--
-- El índice único parcial que garantiza "una fila automática por grupo" cubría
-- solo cupo_lleno y fin_matricula. Sin incluir 'cierre', un grupo podía terminar
-- con DOS tiquetes: el del cierre y el de cupo lleno cuando alguien más se
-- matricula. Se recrea incluyendo los tres.
DROP INDEX IF EXISTS public.folleto_requests_auto_por_grupo;

CREATE UNIQUE INDEX folleto_requests_auto_por_grupo
  ON public.folleto_requests (source_group_id)
  WHERE (tipo = ANY (ARRAY['cupo_lleno'::text, 'fin_matricula'::text, 'cierre'::text]));

COMMENT ON INDEX public.folleto_requests_auto_por_grupo IS
  'Una sola solicitud AUTOMÁTICA de folletos por grupo, sea por cierre, cupo lleno o fin de matrícula. Las manuales y de reubicación quedan fuera a propósito.';
