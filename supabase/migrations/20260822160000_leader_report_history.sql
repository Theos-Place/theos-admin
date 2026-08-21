-- DIR-7 · Historia del reporte de dirigentes.
--
-- POR QUÉ UNA TABLA NUEVA. La ficha pedía "comparación contra el snapshot de
-- hace 3 y 6 meses", y eso hoy no se puede: report_snapshots tiene PRIMARY KEY
-- (report_key) y el cron hace upsert, así que solo existe la foto más reciente.
--
-- Y NO se puede reconstruir hacia atrás. volunteers.start_date está poblado
-- (951 de 998 filas), pero end_date tiene UNA fila: cuando alguien deja de
-- servir se voltea el status y no queda cuándo. Una reconstrucción contaría a
-- quienes empezaron y siguen, y se perdería a quienes estaban y ya no — el
-- pasado saldría subestimado y cualquier tendencia se vería falsamente
-- positiva. Preferimos empezar a acumular hoy y decir "sin dato" mientras no
-- haya, antes que mostrar un crecimiento que no ocurrió.
--
-- Tabla propia y no una genérica: son tres enteros y una fecha. Guardar el
-- payload completo de cada día para leer tres números sería caro de leer y de
-- crecer. Mismo criterio que documentó FRM-1 para form_access_grants.

CREATE TABLE IF NOT EXISTS public.leader_report_history (
  -- Un punto por día. El cron corre a diario y hace upsert sobre el día: si se
  -- dispara dos veces, la segunda corrige la primera en vez de duplicar.
  captured_on              date PRIMARY KEY DEFAULT CURRENT_DATE,
  activos                  integer NOT NULL,
  dando_ahora              integer NOT NULL,
  disponibles_sin_grupo    integer NOT NULL,
  en_pausa                 integer NOT NULL DEFAULT 0,
  en_revision              integer NOT NULL DEFAULT 0,
  total                    integer NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.leader_report_history IS
  'DIR-7: un punto por día del pulso de dirigentes, para la evolución del reporte. Lo escribe el cron report-snapshots. Empieza a acumular el 2026-08-21: antes de esa fecha no hay dato y el reporte lo dice en vez de estimarlo.';

ALTER TABLE public.leader_report_history ENABLE ROW LEVEL SECURITY;

-- Defensa en profundidad: las lecturas van por service role desde el reporte,
-- que ya exige el módulo 'reportes'.
DO $$
BEGIN
  CREATE POLICY leader_report_history_select ON public.leader_report_history
    FOR SELECT TO authenticated
    USING (private.is_admin() OR private.has_any_role(ARRAY[
      'reportes', 'direccion', 'coordinador_dirigentes', 'coordinador_estudios'
    ]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.leader_report_history TO authenticated, service_role;
