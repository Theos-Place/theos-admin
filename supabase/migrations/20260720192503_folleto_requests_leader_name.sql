-- Solicitud de folletos manual: el dirigente destinatario ahora es autofill con
-- opción de digitar uno libre ("otro", sin member_id). Guardamos el nombre libre
-- además del id (que solo existe si coincide con un dirigente registrado).
ALTER TABLE folleto_requests ADD COLUMN IF NOT EXISTS target_leader_name text;
