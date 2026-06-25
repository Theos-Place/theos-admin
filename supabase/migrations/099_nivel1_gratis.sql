-- Nivel 1 es siempre gratuito. Idempotente.
update study_plans set cost = 0 where code = 'N1';
