-- Corrige la duración en semanas de varios estudios. Idempotente (set a valor fijo
-- por code, que es único e inequívoco — no confundir CTBD con Plan Daniel).
update study_plans set duration_weeks = 12 where code = 'PAN';   -- Panorama
update study_plans set duration_weeks = 11 where code = 'CTBD';  -- Cómo Tomar Buenas Decisiones
update study_plans set duration_weeks = 11 where code = 'ROM';   -- Romanos
update study_plans set duration_weeks = 10 where code = 'HEB';   -- Hebreos
update study_plans set duration_weeks = 9  where code = 'HCH';   -- Hechos
update study_plans set duration_weeks = 9  where code = 'RDM';   -- Religiones del Mundo
update study_plans set duration_weeks = 8  where code = 'ASF';   -- Amor sin Fronteras
