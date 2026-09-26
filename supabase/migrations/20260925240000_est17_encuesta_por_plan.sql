-- EST-17 · La encuesta de satisfacción se decide POR PLAN, no en todos los cierres.
--
-- LA DECISIÓN (2026-09-24): se manda al cerrar Nivel 2 y Nivel 4, y ya no en
-- Nivel 1 ni Nivel 3. El motivo es EST-14: con los niveles en dos bloques
-- (N1+N2 y N3+N4), preguntar al cerrar N1 y otra vez al cerrar N2 son dos
-- encuestas del MISMO tramo, a la misma gente, sobre el mismo dirigente. La
-- segunda se responde peor y ensucia el promedio de la primera.
--
-- DISCÍPULOS Y LOS DEMÁS NO CAMBIAN. Por eso el default es `true` y solo se
-- apagan dos: una lista de «quiénes sí» habría apagado en silencio los 29
-- planes del catálogo, incluidos los que hoy sí encuestan (SCJ, DIS1, DIS3,
-- PREMAT tienen encuestas pedidas).
--
-- UNA COLUMNA Y NO UNA LISTA DE CÓDIGOS EN EL CÓDIGO, que era la otra opción y
-- es la que pidió el ítem: los nombres de plan cambian, se archivan y se
-- agregan, y un `if (code === 'N1')` obliga a un deploy para algo que la
-- coordinación tiene que poder cambiar sola.
--
-- CONVIVE con `study_groups.survey_enabled`, que ya existía: esa es la excepción
-- de UN grupo y hoy está en `true` en los 2.204. La nueva es la regla del plan.
-- Para que llegue la encuesta tienen que estar las dos, que es lo que hace que
-- apagar el plan no se pueda saltar grupo por grupo sin querer.

ALTER TABLE public.study_plans
  ADD COLUMN IF NOT EXISTS sends_satisfaction_survey boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.study_plans.sends_satisfaction_survey IS
  'EST-17: si al cerrar un grupo de este plan se le pide la encuesta de satisfacción a los estudiantes.';

UPDATE public.study_plans
   SET sends_satisfaction_survey = false
 WHERE code IN ('N1', 'N3');
