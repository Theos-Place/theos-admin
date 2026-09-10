-- Por qué se autorizó a alguien a llevar un estudio virtual.
--
-- La autorización ya guardaba quién y cuándo, pero no el POR QUÉ. Meses
-- después nadie sabe si fue por distancia, por salud, por horario de trabajo o
-- por una excepción puntual — y sin eso no se puede revisar el criterio ni
-- explicárselo a quien pregunta.
--
-- Mismo patrón que not_recommended_reason, que ya existe y funciona: la razón
-- se exige al MARCAR y se limpia al desmarcar, porque una razón sin la marca
-- que la motivó no dice nada.

ALTER TABLE public.member_admin_data
  ADD COLUMN IF NOT EXISTS authorized_virtual_studies_reason text;

COMMENT ON COLUMN public.member_admin_data.authorized_virtual_studies_reason IS
  'Por qué se le autorizó llevar estudios virtuales. Obligatoria al autorizar; se limpia al quitar la autorización.';
