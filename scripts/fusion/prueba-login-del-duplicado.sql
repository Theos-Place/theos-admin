-- Una fusión deja la cuenta del duplicado SIN poder entrar. Revierte siempre.
--   node scripts/staging/aplicar-sql.mjs scripts/fusion/prueba-login-del-duplicado.sql
--
-- Caso de Dylana Vincenti (2026-10-02): se fusionó su duplicada y la cuenta
-- con la que ella entra siguió viva, apuntando a una ficha muerta. Entró 17
-- días después y el sistema la trató como cuenta desactivada.
--
-- Los tres casos que importan, y el tercero es el que puede hacer daño: si
-- el trigger bloqueara una cuenta que usa alguien VIVO, dejaría afuera a
-- gente sana. 32 de las 151 fusiones ya hechas terminaron con el login
-- mudado a la persona que queda, y están bien así.
begin;
do $$
declare
  v_keep uuid; v_dup uuid; v_auth uuid; v_auth2 uuid; v_otra uuid;
  v_ban timestamptz; v_link uuid;
begin
  -- ── 1 · La cuenta LIGADA al duplicado se bloquea ──────────────────────
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'zzdup1@example.com', 'x', now(), now(), now()) returning id into v_auth;
  insert into members (first_name, last_name, is_active) values ('ZZFus','Principal', true) returning id into v_keep;
  insert into members (first_name, last_name, is_active, auth_user_id, email)
    values ('ZZFus','Duplicada', true, v_auth, 'zzdup1@example.com') returning id into v_dup;

  update members set is_active = false, deactivation_reason = 'merged', deactivated_at = now() where id = v_dup;

  select banned_until into v_ban from auth.users where id = v_auth;
  select auth_user_id into v_link from members where id = v_dup;
  if v_ban is null or v_ban <= now() then raise exception 'FALLA: la cuenta ligada NO se bloqueó'; end if;
  if v_link is not null then raise exception 'FALLA: la ficha muerta se quedó con el vínculo'; end if;
  raise notice '✓ 1) la cuenta ligada al duplicado quedó bloqueada y sin vínculo';

  -- ── 2 · La cuenta HUÉRFANA (mismo correo, sin vínculo) también ────────
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'zzdup2@example.com', 'x', now(), now(), now()) returning id into v_auth2;
  insert into members (first_name, last_name, is_active, email)
    values ('ZZFus','Duplicada2', true, 'zzdup2@example.com') returning id into v_dup;
  update members set is_active = false, deactivation_reason = 'merged', deactivated_at = now() where id = v_dup;

  select banned_until into v_ban from auth.users where id = v_auth2;
  if v_ban is null or v_ban <= now() then raise exception 'FALLA: la cuenta huérfana NO se bloqueó'; end if;
  raise notice '✓ 2) la cuenta huérfana con el mismo correo también se bloqueó';

  -- ── 3 · La cuenta que USA ALGUIEN VIVO no se toca ─────────────────────
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'zzcompartido@example.com', 'x', now(), now(), now()) returning id into v_auth;
  insert into members (first_name, last_name, is_active, auth_user_id, email)
    values ('ZZFus','Viva', true, v_auth, 'zzcompartido@example.com') returning id into v_otra;
  insert into members (first_name, last_name, is_active, email)
    values ('ZZFus','Duplicada3', true, 'zzcompartido@example.com') returning id into v_dup;
  update members set is_active = false, deactivation_reason = 'merged', deactivated_at = now() where id = v_dup;

  select banned_until into v_ban from auth.users where id = v_auth;
  if v_ban is not null and v_ban > now() then
    raise exception 'FALLA: bloqueó la cuenta de una persona VIVA';
  end if;
  raise notice '✓ 3) la cuenta de la persona viva quedó intacta';

  -- ── 4 · Una baja NORMAL no bloquea nada ───────────────────────────────
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'zzbaja@example.com', 'x', now(), now(), now()) returning id into v_auth;
  insert into members (first_name, last_name, is_active, auth_user_id, email)
    values ('ZZFus','DeBaja', true, v_auth, 'zzbaja@example.com') returning id into v_dup;
  update members set is_active = false, deactivation_reason = 'se mudó' where id = v_dup;
  select banned_until into v_ban from auth.users where id = v_auth;
  if v_ban is not null and v_ban > now() then
    raise exception 'FALLA: una baja normal no debería bloquear la cuenta';
  end if;
  raise notice '✓ 4) una baja que no es fusión no bloquea nada';
end $$;
rollback;
