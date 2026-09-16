-- Cancelar una beca deja constancia de QUIÉN y POR QUÉ.
--
-- Hasta hoy `revokeScholarship` solo escribía status='revoked'. Una beca podía
-- aparecer cancelada sin ninguna explicación y sin nombre al lado, que en algo
-- que mueve plata es justo el dato que después nadie encuentra. El caso que lo
-- destapó: la beca del 50% de María José Ruiz, emitida por error, hubo que
-- cancelarla por script y la única forma de dejar el motivo fue meterlo a mano
-- en `notes`.
--
-- El estado 'revoked' ya existía en el CHECK de status; no hace falta uno nuevo.
-- Lo que faltaba era el contexto.

alter table public.scholarships
  add column if not exists revoked_at    timestamptz,
  add column if not exists revoked_by    uuid references auth.users(id),
  add column if not exists revoke_reason text;

comment on column public.scholarships.revoke_reason is
  'Por qué se canceló. Obligatorio para las canceladas (ver scholarships_revoked_con_motivo).';

-- Backfill de la única beca cancelada que existe (la del 50% de María José
-- Ruiz, 2026-09-16). Su motivo se había guardado en `notes` porque no había
-- dónde más; se mueve al campo que le corresponde y `notes` se libera.
update public.scholarships
   set revoked_at    = coalesce(revoked_at, updated_at),
       revoked_by    = coalesce(revoked_by, (select id from auth.users where email = 'ti@theosplace.org')),
       revoke_reason = coalesce(revoke_reason, nullif(notes, '')),
       notes         = null
 where status = 'revoked' and revoke_reason is null;

-- Red de seguridad: que no se pueda volver a cancelar sin decir por qué. Va
-- después del backfill a propósito — si quedara alguna fila vieja sin motivo,
-- el ALTER falla acá y no en producción a la hora de cancelar.
alter table public.scholarships
  add constraint scholarships_revoked_con_motivo
  check (status <> 'revoked' or (revoke_reason is not null and length(btrim(revoke_reason)) >= 10));
