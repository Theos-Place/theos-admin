-- Zonas de grupos de estudio como subconjunto del catálogo de sedes.
-- El picker de zona (crear/editar grupo, reubicaciones) filtraba por is_active,
-- pero ese flag gobierna los pickers de miembros/eventos/comunicaciones: activar
-- las 23 zonas ahí habría metido "Tres Ríos" como sede de un miembro, y
-- desactivar Antares la habría sacado de eventos. is_zone separa ambos usos.
ALTER TABLE public.sedes ADD COLUMN IF NOT EXISTS is_zone boolean NOT NULL DEFAULT false;

-- Lista aprobada 2026-08-17 (coordinación de estudios).
UPDATE public.sedes SET is_zone = true WHERE code IN (
  'alajuela',
  'san-rafael-de-alajuela',
  'belen',
  'cartago',
  'este-sj',
  'oeste-sj',
  'casona-escalante',
  'casona-pedregal',
  'ciudad-colon',
  'curridabat',
  'escazu',
  'finca-sasso',
  'heredia',
  'liberia',
  'limon',
  'lindora',
  'perez-zeledon',
  'potrero',
  'la-sabana',
  'la-uruca',
  'santa-ana',
  'san-pedro',
  'tres-rios'
);
