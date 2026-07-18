-- 024: índices que cubren las FK sin indexar de las tablas agregadas después de
-- la migración 011 (lint 0001). El lint 0005 (unused_index) no se atiende: es
-- ruido por falta de tráfico de queries todavía.

CREATE INDEX IF NOT EXISTS idx_donations_family_unit          ON donations(family_unit_id);
CREATE INDEX IF NOT EXISTS idx_employees_position             ON employees(position_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_imported_by     ON import_batches(imported_by);
CREATE INDEX IF NOT EXISTS idx_message_broadcasts_smtp        ON message_broadcasts(smtp_config_id);
CREATE INDEX IF NOT EXISTS idx_message_broadcasts_whatsapp    ON message_broadcasts(whatsapp_config_id);
CREATE INDEX IF NOT EXISTS idx_payments_scholarship           ON payments(scholarship_id);
CREATE INDEX IF NOT EXISTS idx_refunds_processed_by           ON refunds(processed_by);
CREATE INDEX IF NOT EXISTS idx_salary_changes_approved_by     ON salary_changes(approved_by);
CREATE INDEX IF NOT EXISTS idx_scholarships_created_by        ON scholarships(created_by);
CREATE INDEX IF NOT EXISTS idx_scholarships_event             ON scholarships(event_id);
