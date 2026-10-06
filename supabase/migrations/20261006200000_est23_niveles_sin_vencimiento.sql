-- EST-27 · Las excepciones de NIVELES no vencen.
--
-- LA REGLA (Floriana, 2026-10-06): los tres bloques anuales son de
-- CAPACITACIONES. Un grupo de Nivel 1 abre cuando hay gente y dirigente, no
-- cuando empieza un cuatrimestre, así que colgarle a su excepción el cierre
-- de matrícula de un bloque le pone una fecha que no significa nada.
--
-- Una excepción de nivel vive desde que se crea hasta que (a) SE USA —un solo
-- uso: al matricularse queda `used`— o (b) alguien la quita.
--
-- LO QUE ESTO ARREGLA, medido antes de escribirlo: TRES excepciones de Nivel
-- 1 estaban muertas sin que nadie lo supiera, porque el «Bloque 3 2026»
-- cerró su matrícula el 13 de setiembre:
--
--   · Jose Fabio Quesada Matamoros — «tiene 29 años, puede matricular los de 30»
--   · Kenneth Campos Araya — repetir el nivel, decisión del dirigente
--   · Kristal Monge Segura — repetir, no había grupo al cual reubicarla
--
-- Las tres siguen diciendo `active` en la base; la elegibilidad las
-- descartaba en silencio. Quitarles el bloque las revive.
--
-- LAS DE CAPACITACIONES NO SE TOCAN. Ahí el bloque SÍ es la unidad real y su
-- vencimiento es correcto: la condición filtra por el código del plan, no
-- barre parejo.

update public.study_requirement_exceptions e
   set bloque_id = null
  from public.study_plans p
 where e.plan_id = p.id
   and p.code ~ '^N[1-4]$'
   and e.bloque_id is not null;

-- Idempotente por construcción: una segunda corrida no encuentra filas.

comment on column public.study_requirement_exceptions.bloque_id is
  'Bloque en que se otorgó, para la vigencia. SIEMPRE NULL en niveles (EST-27): los niveles no siguen el calendario de bloques y su excepción no vence.';
