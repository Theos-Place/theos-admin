-- EST-14 · Quién vive bajo el esquema VIEJO y quién bajo el de BLOQUES.
--
-- EL BUG (producción, 2026-10-05). EST-14 hizo que los cierres 1→2 y 3→4
-- dejaran de generar folletos y cobros, porque bajo bloques el par ya se pagó
-- y se entregó al entrar. Correcto para los grupos nuevos y destructivo para
-- los que venían de antes: cinco cierres de Nivel 3 del 5 de octubre dejaron
-- a 32 estudiantes sin cobro de N4 y sin folleto de N4.
--
-- DOS MARCAS, porque son dos preguntas distintas. Medido en producción antes
-- de elegirlas:
--
--  1 · `study_groups.modalidad` — QUÉ REGLA aplica el grupo. Va en el grupo
--      porque el tiquete de folletos es del grupo.
--
--      NO se deriva de la fecha, que era el criterio propuesto: los 5 grupos
--      de N4 que hay que reparar se CREARON el 2026-10-05 como sucesores de
--      grupos legacy, así que «creado antes del 5 de octubre = legacy»
--      marcaría como «bloques» justo a los que no lo son. El sucesor HEREDA
--      la del origen, y eso lo hace el código al crearlo.
--
--  2 · `study_enrollments.cubre_bloque` — si ESTA PERSONA ya pagó el par.
--      Hace falta porque hay GRUPOS MIXTOS: el N3 de Michelle Guier, creado
--      en julio, tiene 9 estudiantes viejos y 1 que se matriculó el 5 de
--      octubre pagando ₡10.000 (el bloque N3+N4 completo). Cobrarle N4 al
--      cerrar sería cobrarle dos veces. Lo mismo en 4 grupos de N1, con 8
--      personas que pagaron ₡5.000 por el par N1+N2.
--
-- EL BACKFILL ES ASIMÉTRICO A PROPÓSITO:
--   · TODOS los grupos que existen hoy quedan 'legacy'. Es el default seguro:
--     equivocarse hacia legacy genera un cobro de más —visible y
--     corregible— y equivocarse hacia bloques deja a alguien sin folleto, que
--     es el error que nadie ve hasta que llega a clase sin material.
--   · El DEFAULT de la columna es 'bloques', para los grupos que nazcan de
--     ahora en adelante por la pantalla normal.

alter table public.study_groups
  add column if not exists modalidad text not null default 'bloques';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.study_groups'::regclass
       and conname = 'study_groups_modalidad_check'
  ) then
    alter table public.study_groups
      add constraint study_groups_modalidad_check
      check (modalidad in ('legacy', 'bloques'));
  end if;
end $$;

comment on column public.study_groups.modalidad is
  'EST-14: legacy = cobra y entrega folleto POR NIVEL (esquema viejo); bloques = por par N1+N2 / N3+N4. El grupo sucesor hereda la del origen.';

-- Todo lo que YA existe es del esquema viejo. La columna nació con default
-- 'bloques' para lo que viene; esto corrige lo que había.
update public.study_groups set modalidad = 'legacy' where created_at < now();

alter table public.study_enrollments
  add column if not exists cubre_bloque boolean not null default false;

comment on column public.study_enrollments.cubre_bloque is
  'EST-14: esta matrícula ya pagó el PAR de niveles (N1+N2 o N3+N4). Al cerrar, a esta persona NO se le cobra el nivel siguiente.';

-- Backfill por EVIDENCIA, no por fecha: se marca a quien tiene un cobro de
-- matrícula por el monto del par. Son los 9 medidos (8 en N1 a ₡5.000 y 1 en
-- N3 a ₡10.000), y la condición los encuentra sin listar ids a mano.
update public.study_enrollments e
   set cubre_bloque = true
  from study_groups g
  join study_plans p on p.id = g.plan_id
 where e.group_id = g.id
   and p.code in ('N1', 'N3')
   and exists (
     select 1 from payments pm
      where pm.enrollment_id = e.id
        and pm.concept = 'matricula'
        and pm.status <> 'cancelado'
        -- El par vale la suma de los dos niveles; el nivel suelto, uno.
        and pm.amount >= (
          select coalesce(sum(sp.cost), 0) from study_plans sp
           where sp.code in (case p.code when 'N1' then 'N1' else 'N3' end,
                             case p.code when 'N1' then 'N2' else 'N4' end)
        )
        and pm.amount > 0
   );

create index if not exists study_enrollments_cubre_bloque
  on public.study_enrollments (group_id) where cubre_bloque;

-- Un cobro que NO debe recordarse todavía.
--
-- La reparación de los cierres legacy crea cobros de los que la persona no
-- sabe nada: se decidió (Floriana, 2026-10-05) que el aviso lo da cada
-- dirigente, no el sistema. Sin esto, el cron semanal de recordatorios les
-- escribiría al día siguiente — justo lo que la decisión evita.
--
-- Es una columna general y no una marca del lote: sirve para cualquier cobro
-- que se cree antes de que la persona esté enterada.
alter table public.payments
  add column if not exists reminder_exempt_until timestamptz;

comment on column public.payments.reminder_exempt_until is
  'Hasta cuándo este cobro NO entra en el recordatorio automático. Para cobros creados antes de que la persona esté enterada.';
