-- Denormaliza el estado de confirmación de la cuenta de Auth en members, para que
-- la lista (~23k) derive los 3 estados (sin cuenta / sin activar / activada) de
-- columnas de members, sin consultar Auth por fila.
--   estado = auth_user_id IS NULL            -> 'none'
--          | account_confirmed_at IS NULL    -> 'unconfirmed'  (tiene cuenta, sin activar)
--          | account_confirmed_at IS NOT NULL-> 'active'
alter table members add column if not exists account_confirmed_at timestamptz;
comment on column members.account_confirmed_at is
  'Espejo de auth.users.email_confirmed_at (sincronizado por trigger). NULL = cuenta sin activar o sin cuenta.';

-- Backfill desde auth.users.
update members m
set account_confirmed_at = u.email_confirmed_at
from auth.users u
where m.auth_user_id = u.id and u.email_confirmed_at is not null;

-- Mantener sincronizado: cuando un usuario de Auth se confirma (o cambia), refleja
-- la fecha en el miembro ligado.
create or replace function public.sync_member_account_confirmed()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  update public.members
  set account_confirmed_at = new.email_confirmed_at
  where auth_user_id = new.id
    and account_confirmed_at is distinct from new.email_confirmed_at;
  return new;
end $$;

drop trigger if exists trg_sync_member_account_confirmed on auth.users;
create trigger trg_sync_member_account_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.sync_member_account_confirmed();
