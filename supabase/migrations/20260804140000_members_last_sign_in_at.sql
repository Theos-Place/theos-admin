-- 2026-08-04 · Estado de cuenta con tres casos distinguibles.
--
-- Hasta ahora el estado salía de `account_confirmed_at` (espejo de
-- auth.users.email_confirmed_at) y mezclaba dos situaciones que se resuelven
-- distinto: "nunca se le creó usuario" y "tiene usuario pero nunca ha entrado".
-- Con AUTH-1 (18.101 cuentas creadas en lote) la segunda es el caso normal.
--
-- Se agrega el espejo de `last_sign_in_at`, que es el dato que responde "¿ya
-- entró alguna vez?" — la métrica de adopción de agosto. Los tres estados
-- quedan: sin auth_user_id → "Sin cuenta"; con usuario y sin login → "Nunca ha
-- entrado"; con login → "Activa".

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

COMMENT ON COLUMN public.members.last_sign_in_at IS
  'Espejo de auth.users.last_sign_in_at (sincronizado por trigger). NULL con auth_user_id = nunca ha entrado; NULL sin auth_user_id = no tiene cuenta.';

-- Backfill de lo que ya pasó.
UPDATE public.members m
SET last_sign_in_at = u.last_sign_in_at
FROM auth.users u
WHERE m.auth_user_id = u.id
  AND m.last_sign_in_at IS DISTINCT FROM u.last_sign_in_at;

-- El trigger existente ya corre en cada UPDATE de email_confirmed_at; se amplía
-- para llevar también el último ingreso, y se dispara además con last_sign_in_at
-- (que es lo que cambia en cada login).
CREATE OR REPLACE FUNCTION public.sync_member_account_confirmed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
begin
  update public.members
  set account_confirmed_at = new.email_confirmed_at,
      last_sign_in_at      = new.last_sign_in_at
  where auth_user_id = new.id
    and (account_confirmed_at is distinct from new.email_confirmed_at
         or last_sign_in_at is distinct from new.last_sign_in_at);
  return new;
end $$;

DROP TRIGGER IF EXISTS trg_sync_member_account_confirmed ON auth.users;
CREATE TRIGGER trg_sync_member_account_confirmed
  AFTER INSERT OR UPDATE OF email_confirmed_at, last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_member_account_confirmed();

-- Mismo espejo cuando se ENLAZA un usuario de Auth a un miembro.
CREATE OR REPLACE FUNCTION public.sync_member_account_confirmed_on_link() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
begin
  if new.auth_user_id is not null and (old.auth_user_id is distinct from new.auth_user_id) then
    update public.members
    set account_confirmed_at = u.email_confirmed_at,
        last_sign_in_at      = u.last_sign_in_at
    from auth.users u
    where u.id = new.auth_user_id and members.id = new.id
      and (members.account_confirmed_at is distinct from u.email_confirmed_at
           or members.last_sign_in_at is distinct from u.last_sign_in_at);
  end if;
  return new;
end $$;

-- El filtro "nunca ha entrado" del padrón recorre members por estas dos columnas.
CREATE INDEX IF NOT EXISTS idx_members_account_state
  ON public.members (auth_user_id, last_sign_in_at);
