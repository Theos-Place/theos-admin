-- `subject` en message_logs, para que el registro sirva de algo.
--
-- Los correos TRANSACCIONALES (enlace de contraseña, aviso de cobro, cierre)
-- no quedaban registrados en ningún lado: message_logs era solo de campañas.
-- Tres veces en una semana hubo que responder "¿le llegó el correo a esta
-- persona?" por deducción —mirando recovery_sent_at de Auth y descartando
-- causas— en vez de mirarlo.
--
-- Sin el asunto, una fila con destinatario y hora no dice CUÁL correo era, que
-- es justo la pregunta. Nullable: las filas viejas no lo tienen y no se
-- inventa.
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS subject text;

COMMENT ON COLUMN public.message_logs.subject IS
  'Asunto del correo. Para distinguir cuál envío fue, sobre todo en los transaccionales (broadcast_id nulo).';
