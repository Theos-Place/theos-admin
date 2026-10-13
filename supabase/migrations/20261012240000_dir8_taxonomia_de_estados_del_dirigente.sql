-- DIR-8 · La taxonomía de estados del dirigente (reunión con Fabiola, 2026-10-12).
--
-- EL PROBLEMA DEL MODELO VIEJO. `availability_status` mezclaba tres
-- preguntas distintas en una sola columna plana —available / inactive /
-- resting / en_revision— y por eso no respondía ninguna:
--
--   · «en revisión» TAPABA si la persona estaba disponible o no;
--   · «resting» no decía si volvía ni cuándo;
--   · «inactive» no decía si dejó de venir a Theos o si viene y no ejerce,
--     que son dos conversaciones completamente distintas.
--
-- Ahora son tres preguntas separadas: ¿sigue siendo dirigente? ¿puede tomar
-- un grupo ahora? ¿hay algo que mirar con esta persona?
--
-- Las reglas de qué combina con qué viven en `lib/leaders/estado-del-dirigente`
-- con tests; acá van los CHECK que impiden que la base guarde algo que esa
-- función rechazaría.
--
-- CONVERSIÓN DE LOS 505 QUE HAY:
--   available   (209) → activo / disponible
--   inactive    (294) → inactivo, SIN razón: nadie la registró nunca y
--                       ponerle una sería inventarla. Coordinación las llena
--                       —o llegan en el Excel de Fabiola— y hasta entonces
--                       la ficha muestra «falta decir por qué».
--   resting       (1) → activo / no disponible / pausa, sin fecha todavía.
--   en_revision   (1) → activo / disponible + BANDERITA. Es justo el caso
--                       que el rediseño arregla: esa persona estaba
--                       disponible y el estado lo escondía.

alter table public.study_leaders
  add column if not exists estado_base text not null default 'inactivo',
  add column if not exists razon_inactivo text,
  add column if not exists detalle_no_ejerce text,
  add column if not exists situacion_cdeb text,
  add column if not exists disponibilidad text,
  add column if not exists razon_no_disponible text,
  add column if not exists pausa_hasta date,
  -- Varias a la vez, o ninguna: es una marca, no un estado.
  add column if not exists revision text[] not null default '{}',
  -- Las notas de los cinco lugares con flecha roja en el diagrama.
  add column if not exists nota_revision text,
  add column if not exists nota_cdeb text,
  add column if not exists nota_decision_propia text,
  add column if not exists nota_pausa text,
  -- La nota GENERAL, para casos sensibles. Confidencial: la lee y escribe
  -- coordinación de dirigentes; el dirigente no la ve nunca.
  add column if not exists nota_general text,
  -- DIR-8 extras.
  add column if not exists en_grupo_whatsapp boolean not null default false,
  -- La comunidad a la que SIENTE que pertenece, que puede ser distinta de
  -- donde asiste y de las zonas donde puede dar. El catálogo lo pasa
  -- Fabiola; hasta entonces queda vacío, no inventado.
  add column if not exists comunidades text[] not null default '{}';

-- ── Conversión, antes de los CHECK ──────────────────────────────────────
update public.study_leaders set
  estado_base = case when availability_status in ('available', 'en_revision', 'resting')
                     then 'activo' else 'inactivo' end,
  razon_inactivo = null,
  disponibilidad = case
    when availability_status in ('available', 'en_revision') then 'disponible'
    when availability_status = 'resting' then 'no_disponible'
    else null end,
  razon_no_disponible = case when availability_status = 'resting' then 'pausa' else null end,
  revision = case when availability_status = 'en_revision' then array['testimonio'] else '{}' end;

-- ── Las reglas, como CHECK ──────────────────────────────────────────────
alter table public.study_leaders
  drop constraint if exists study_leaders_estado_base_check,
  add constraint study_leaders_estado_base_check
    check (estado_base in ('activo', 'inactivo'));

alter table public.study_leaders
  drop constraint if exists study_leaders_razon_inactivo_check,
  add constraint study_leaders_razon_inactivo_check
    check (razon_inactivo is null or razon_inactivo in ('no_asiste', 'asiste_no_ejerce'));

alter table public.study_leaders
  drop constraint if exists study_leaders_detalle_no_ejerce_check,
  add constraint study_leaders_detalle_no_ejerce_check
    check (detalle_no_ejerce is null or detalle_no_ejerce in ('no_aprobo_cdeb', 'decision_propia'));

alter table public.study_leaders
  drop constraint if exists study_leaders_situacion_cdeb_check,
  add constraint study_leaders_situacion_cdeb_check
    check (situacion_cdeb is null or situacion_cdeb in ('definitivo', 'seguimiento'));

alter table public.study_leaders
  drop constraint if exists study_leaders_disponibilidad_check,
  add constraint study_leaders_disponibilidad_check
    check (disponibilidad is null or disponibilidad in ('disponible', 'no_disponible'));

alter table public.study_leaders
  drop constraint if exists study_leaders_razon_no_disponible_check,
  add constraint study_leaders_razon_no_disponible_check
    check (razon_no_disponible is null or razon_no_disponible in
      ('dirigiendo', 'estudiante_capacitacion', 'en_formacion', 'pasantia', 'pausa'));

-- La FORMA: lo que la base no puede dejar pasar aunque la app se equivoque.
-- Un inactivo con disponibilidad, o un activo con razones de inactividad,
-- es una ficha que después nadie sabe leer.
alter table public.study_leaders
  drop constraint if exists study_leaders_forma_del_estado,
  add constraint study_leaders_forma_del_estado check (
    case when estado_base = 'inactivo'
      then disponibilidad is null and razon_no_disponible is null and pausa_hasta is null
      else razon_inactivo is null and detalle_no_ejerce is null and situacion_cdeb is null
           and disponibilidad is not null
    end
  );

-- La fecha de regreso es SOLO de la pausa, y la pausa la necesita. Se deja
-- fuera de la conversión del único `resting` que había: esa fila entra sin
-- fecha y coordinación la completa (el CHECK solo exige la fecha cuando la
-- razón se elige de nuevo, para no bloquear la migración de un dato que
-- nunca se pidió).
alter table public.study_leaders
  drop constraint if exists study_leaders_pausa_solo_en_pausa,
  add constraint study_leaders_pausa_solo_en_pausa
    check (pausa_hasta is null or razon_no_disponible = 'pausa');

comment on column public.study_leaders.availability_status is
  'OBSOLETA desde DIR-8 (2026-10-12): la reemplazan estado_base + disponibilidad + revision. Se conserva hasta que no quede código leyéndola.';
