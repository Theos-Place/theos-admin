-- CDEB: cuando el dirigente recomienda "sí, pero debería llevar otro estudio
-- primero", ahora indica CUÁL (code de study_plans, texto suelto sin FK — el
-- catálogo de planes usa codes estables).
ALTER TABLE public.cdeb_recommendations
  ADD COLUMN IF NOT EXISTS recommended_prior_study text;
