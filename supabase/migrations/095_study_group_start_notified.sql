-- Dedupe del recordatorio "inicio_capacitacion": marca cuándo se notificó a los
-- estudiantes que su grupo está por comenzar, para que el cron diario no reenvíe.
alter table study_groups add column if not exists start_notified_at timestamptz;
comment on column study_groups.start_notified_at is
  'Cuándo se envió el recordatorio inicio_capacitacion a los estudiantes (dedupe del cron de recordatorios).';
