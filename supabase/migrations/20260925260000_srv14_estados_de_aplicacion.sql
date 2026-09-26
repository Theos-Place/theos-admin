-- SRV-14 · Un estado nuevo para las aplicaciones: «enviada al encargado».
--
-- LOS CINCO ESTADOS (dictados el 2026-09-25) y cómo mapean a lo que ya había:
--   recibida             → `pending`          (ya existía, se renombra en la UI)
--   enviada al encargado → `sent_to_leader`   ← EL NUEVO
--   aceptada             → `approved`         (ya existía)
--   en revisión          → `reviewing`        (ya existía)
--   rechazada            → `rejected`         (ya existía)
--
-- SOLO SE AGREGA UNO. Los otros cuatro ya estaban con otro nombre en pantalla;
-- renombrar las columnas habría obligado a migrar datos y a tocar el RPC
-- `approve_applications`, que es lo único que activa a alguien como servidor.
-- El vocabulario visible vive en `lib/servers/application-states.ts`.
--
-- POR QUÉ EL NOMBRE «enviada al encargado» y no «PDF enviado»: dice QUÉ pasó y
-- A QUIÉN, sin amarrarse al medio. Sirve igual si el correo lo mandó el sistema
-- o si alguien bajó el PDF y lo mandó por WhatsApp.

alter table applications drop constraint if exists applications_status_check;

alter table applications add constraint applications_status_check
  check (status = any (array['pending', 'sent_to_leader', 'reviewing', 'approved', 'rejected']));
