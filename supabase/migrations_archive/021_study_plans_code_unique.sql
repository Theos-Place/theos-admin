-- 021: índice único normal en study_plans.code (el parcial no sirve para
-- ON CONFLICT / upsert por code). NULLs siguen siendo distintos.

DROP INDEX IF EXISTS idx_study_plans_code;
ALTER TABLE study_plans ADD CONSTRAINT study_plans_code_key UNIQUE (code);
