-- Backfill: miembros con auth confirmado pero espejo desactualizado (el
-- trigger de la 096 solo dispara con cambios en auth.users.email_confirmed_at,
-- no cuando se vincula/actualiza members.auth_user_id después de la confirmación).
update members m
set account_confirmed_at = u.email_confirmed_at
from auth.users u
where m.auth_user_id = u.id
  and u.email_confirmed_at is not null
  and m.account_confirmed_at is distinct from u.email_confirmed_at;

-- Cierra el gap hacia adelante: también sincroniza cuando se (re)vincula auth_user_id.
create or replace function public.sync_member_account_confirmed_on_link()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.auth_user_id is not null and (old.auth_user_id is distinct from new.auth_user_id) then
    update public.members
    set account_confirmed_at = u.email_confirmed_at
    from auth.users u
    where u.id = new.auth_user_id and members.id = new.id
      and members.account_confirmed_at is distinct from u.email_confirmed_at;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_account_confirmed_on_link on members;
create trigger trg_sync_account_confirmed_on_link
  after insert or update of auth_user_id on members
  for each row execute function public.sync_member_account_confirmed_on_link();
