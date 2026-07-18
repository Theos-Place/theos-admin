-- Matrícula automática al siguiente nivel al cerrar un grupo: la inscripción se
-- crea en estado 'pendiente_de_pago' y pasa a 'enrolled' (activa) cuando el pago
-- por comprobante se aprueba (Prompt C). Sumamos el estado al CHECK.

ALTER TABLE study_enrollments DROP CONSTRAINT IF EXISTS study_enrollments_status_check;
ALTER TABLE study_enrollments ADD CONSTRAINT study_enrollments_status_check
  CHECK (status = ANY (ARRAY['enrolled','waitlist','completed','dropped','transferred','pendiente_de_pago']::text[]));
