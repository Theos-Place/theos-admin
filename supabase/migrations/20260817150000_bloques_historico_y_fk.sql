-- BLQ-2 (2026-08-17): bloques históricos + asociación grupo→bloque.
-- 1) Renombra c3-26 al esquema legible "Bloque N YYYY".
-- 2) Crea el histórico de bloques 2013–2026 (3 por año, ene/may/sep), archivados;
--    con la nueva regla por cuatrimestre el activo hoy es Bloque 2 2026.
-- 3) study_groups.bloque_id: FK a capacitacion_bloques, auto-asignada por
--    trigger según starts_at (el bloque más reciente cuya apertura <= inicio);
--    solo para capacitaciones (los niveles y DIS2/DIS3 quedan NULL).
-- 4) Los RPC de folletos por bloque pasan del rango de fechas (±14/+75 días)
--    a la FK, que ahora es la fuente de la asociación.

-- 1) Renombre.
UPDATE public.capacitacion_bloques SET nombre = 'Bloque 3 2026' WHERE nombre = 'c3-26';

-- 2) Histórico. Aperturas estándar 15 ene / 15 may / 15 sep, cierre = apertura+7.
--    Los hitos quedan sellados (*_sent_at) para que el cron jamás avise por
--    bloques pasados. Idempotente: no inserta si ya existe un bloque del mismo
--    nombre. El Bloque 3 2026 ya existe (renombrado arriba, con sus fechas reales).
INSERT INTO public.capacitacion_bloques
  (nombre, anio, fecha_apertura, fecha_cierre_matricula, estado,
   preliminar_sent_at, confirmacion_sent_at, final_sent_at)
SELECT
  'Bloque ' || n || ' ' || y,
  y,
  make_date(y, CASE n WHEN 1 THEN 1 WHEN 2 THEN 5 ELSE 9 END, 15),
  make_date(y, CASE n WHEN 1 THEN 1 WHEN 2 THEN 5 ELSE 9 END, 22),
  'archivado',
  now(), now(), now()
FROM generate_series(2013, 2026) AS y, generate_series(1, 3) AS n
WHERE NOT (y = 2026 AND n = 3)
  AND NOT EXISTS (
    SELECT 1 FROM public.capacitacion_bloques b WHERE b.nombre = 'Bloque ' || n || ' ' || y
  );

-- Estado inicial coherente con la regla por cuatrimestre (el cron diario lo
-- recalcula igual): activo = el de apertura más reciente ya llegada.
UPDATE public.capacitacion_bloques SET estado = 'archivado' WHERE fecha_apertura <= CURRENT_DATE;
UPDATE public.capacitacion_bloques SET estado = 'activo'
WHERE id = (
  SELECT id FROM public.capacitacion_bloques
  WHERE fecha_apertura <= CURRENT_DATE
  ORDER BY fecha_apertura DESC, created_at DESC LIMIT 1
);
UPDATE public.capacitacion_bloques SET estado = 'en_apertura' WHERE fecha_apertura > CURRENT_DATE;

-- 3) FK + trigger de auto-asignación.
ALTER TABLE public.study_groups
  ADD COLUMN IF NOT EXISTS bloque_id uuid REFERENCES public.capacitacion_bloques(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS study_groups_bloque_id_idx ON public.study_groups (bloque_id);

CREATE OR REPLACE FUNCTION public.assign_group_bloque()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Solo capacitaciones con fecha de inicio; el resto queda sin bloque.
  IF NEW.starts_at IS NULL OR NEW.plan_id IS NULL OR EXISTS (
    SELECT 1 FROM study_plans p
    WHERE p.id = NEW.plan_id
      AND p.code = ANY (ARRAY['N1','N2','N3','N4','DIS2','DIS3'])
  ) THEN
    NEW.bloque_id := NULL;
    RETURN NEW;
  END IF;

  SELECT b.id INTO NEW.bloque_id
  FROM capacitacion_bloques b
  WHERE b.fecha_apertura <= NEW.starts_at::date
  ORDER BY b.fecha_apertura DESC, b.created_at DESC
  LIMIT 1;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.assign_group_bloque() OWNER TO postgres;

DROP TRIGGER IF EXISTS study_groups_assign_bloque ON public.study_groups;
CREATE TRIGGER study_groups_assign_bloque
  BEFORE INSERT OR UPDATE OF starts_at, plan_id ON public.study_groups
  FOR EACH ROW EXECUTE FUNCTION public.assign_group_bloque();

-- Backfill de todos los grupos existentes (misma regla que el trigger).
UPDATE public.study_groups sg
SET bloque_id = (
  SELECT b.id FROM public.capacitacion_bloques b
  WHERE b.fecha_apertura <= sg.starts_at::date
  ORDER BY b.fecha_apertura DESC, b.created_at DESC
  LIMIT 1
)
FROM public.study_plans sp
WHERE sp.id = sg.plan_id
  AND sg.starts_at IS NOT NULL
  AND sp.code <> ALL (ARRAY['N1','N2','N3','N4','DIS2','DIS3']);

-- 4) RPCs de folletos por bloque: ahora cuentan por la FK, no por rango de fechas.
CREATE OR REPLACE FUNCTION public.block_folletos_by_sede(p_apertura date)
RETURNS TABLE(sede text, cantidad bigint)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(sd.name, 'Sin sede') AS sede, count(*)::bigint AS cantidad
  FROM study_enrollments e
  JOIN study_groups sg ON sg.id = e.group_id
  LEFT JOIN members lead ON lead.id = sg.leader_id
  LEFT JOIN sedes sd ON sd.id = lead.sede_id
  WHERE sg.bloque_id = (
      SELECT id FROM capacitacion_bloques
      WHERE fecha_apertura = p_apertura
      ORDER BY created_at LIMIT 1)
    AND e.status IN ('enrolled','pendiente_de_pago')
  GROUP BY COALESCE(sd.name, 'Sin sede')
  ORDER BY cantidad DESC;
$$;

CREATE OR REPLACE FUNCTION public.block_folletos_detail(p_apertura date)
RETURNS TABLE(sede text, grupo text, nivel_code text, nivel text, dirigente text, cantidad bigint)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(sd.name, 'Sin sede') AS sede,
         sg.name AS grupo,
         sp.code AS nivel_code,
         sp.name AS nivel,
         COALESCE(NULLIF(btrim(concat(lead.first_name, ' ', lead.last_name)), ''), 'Sin dirigente') AS dirigente,
         count(*)::bigint AS cantidad
  FROM study_enrollments e
  JOIN study_groups sg ON sg.id = e.group_id
  JOIN study_plans sp ON sp.id = sg.plan_id
  LEFT JOIN members lead ON lead.id = sg.leader_id
  LEFT JOIN sedes sd ON sd.id = lead.sede_id
  WHERE sg.bloque_id = (
      SELECT id FROM capacitacion_bloques
      WHERE fecha_apertura = p_apertura
      ORDER BY created_at LIMIT 1)
    AND e.status IN ('enrolled','pendiente_de_pago')
  GROUP BY 1, 2, 3, 4, 5
  ORDER BY 1, cantidad DESC;
$$;
