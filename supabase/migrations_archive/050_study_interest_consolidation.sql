-- Consolida los tipos de solicitud 'join_group' y 'new_group' en un único
-- tipo 'study_interest' ("Interés en estudio"). La distinción no aportaba:
-- ambos expresan que el miembro quiere llevar un estudio; el equipo de
-- estudios analiza la demanda y decide cómo abrir grupos.

-- 1. Ampliar el CHECK para permitir el valor nuevo durante la transición.
ALTER TABLE study_requests DROP CONSTRAINT study_requests_request_type_check;
ALTER TABLE study_requests ADD CONSTRAINT study_requests_request_type_check
  CHECK (request_type IN ('new_group', 'join_group', 'relocation', 'study_interest'));

-- 2. Migrar las solicitudes existentes de los tipos viejos al nuevo.
UPDATE study_requests
SET request_type = 'study_interest'
WHERE request_type IN ('join_group', 'new_group');

-- 3. Restringir el CHECK a los dos tipos vigentes.
ALTER TABLE study_requests DROP CONSTRAINT study_requests_request_type_check;
ALTER TABLE study_requests ADD CONSTRAINT study_requests_request_type_check
  CHECK (request_type IN ('relocation', 'study_interest'));
