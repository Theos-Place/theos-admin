-- Estado 'skipped' en message_logs: quien quedó FUERA de un comunicado y por qué.
--
-- Antes los excluidos (sin correo, rebotado, queja, baja del newsletter) solo se
-- contaban en message_broadcasts.skipped_count. La pantalla mostraba "19 saltados"
-- sin decir quiénes, así que no había forma de perseguir los casos — que es justo
-- lo que hace falta para arreglarlos (conseguir el correo que falta, confirmar una
-- dirección mala).
--
-- Ahora cada excluido deja su fila, con el código del motivo en error_message
-- ('sin_correo' | 'rebotado' | 'queja' | 'baja' | 'silenciado'; ver
-- src/lib/communications/skip-reasons.ts).
--
-- Estas filas NO son cola de envío: processPendingEmails solo toma status =
-- 'pending', y los contadores de enviados/fallidos listan sus estados de forma
-- explícita, así que un 'skipped' no se cuela en ninguno.

ALTER TABLE "public"."message_logs"
  DROP CONSTRAINT IF EXISTS "message_logs_status_check";

ALTER TABLE "public"."message_logs"
  ADD CONSTRAINT "message_logs_status_check" CHECK (
    "status" = ANY (ARRAY[
      'pending'::"text", 'sending'::"text", 'sent'::"text", 'delivered'::"text",
      'failed'::"text", 'bounced'::"text", 'complained'::"text", 'skipped'::"text"
    ])
  );

COMMENT ON COLUMN "public"."message_logs"."error_message" IS
  'Para status=skipped: el código del motivo de exclusión (sin_correo, rebotado, queja, baja, silenciado). Para el resto, texto de error.';
