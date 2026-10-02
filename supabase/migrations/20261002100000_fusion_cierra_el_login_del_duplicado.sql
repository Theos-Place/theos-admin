-- Una ficha fusionada NUNCA puede volver a servir para entrar.
--
-- EL CASO (Dylana Vincenti, reportado el 2026-10-02): su ficha duplicada se
-- fusionó el 14-set y la cuenta con la que ella entra —la del duplicado—
-- siguió viva. Entró el 1-oct, el sistema la resolvió contra una ficha
-- inactiva y la trató como cuenta desactivada: no pudo abrir el formulario de
-- la campa y no había forma de que entendiera por qué.
--
-- HASTA HOY ESTO DEPENDÍA DE LA APP. `merge_members_resuelto` deshabilita la
-- cuenta del duplicado FUERA de la transacción, y su propio comentario lo
-- dice: «si falla, queda una cuenta viva de más, que se arregla a mano». Y
-- quien llama al RPC directo —un script, una corrección puntual— se salta ese
-- paso entero sin enterarse. Yo mismo lo hice ayer con siete fusiones.
--
-- Ahora lo garantiza la BASE: el trigger corre pase lo que pase y venga de
-- donde venga la fusión.
--
-- SE BLOQUEA, NO SE BORRA. Bloquear es reversible: si alguien decide que esa
-- persona debe seguir entrando con ese correo —como se decidió con Dylana—
-- se mueve la cuenta a la ficha viva y se desbloquea. Borrarla no tiene
-- vuelta y se lleva el historial de sesiones.
--
-- LA GUARDA QUE IMPORTA: no se toca una cuenta que esté ligada a una ficha
-- VIVA. La fusión a veces mueve el login del duplicado a la persona que
-- queda —32 de las 151 fusiones hechas terminaron así, y están bien—; sin
-- esta condición, el trigger dejaría afuera a gente sana.

begin;

create or replace function public.cerrar_login_de_ficha_fusionada()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_bloqueadas int := 0;
begin
  -- Solo al pasar a inactiva POR FUSIÓN. Una baja normal tiene su propia
  -- regla (`cuentaHabilitada`) y no es asunto de este trigger.
  if new.is_active is not false or new.deactivation_reason is distinct from 'merged' then
    return new;
  end if;
  if old.is_active is false and old.deactivation_reason is not distinct from 'merged' then
    return new;  -- ya estaba fusionada: nada nuevo que cerrar
  end if;

  with candidatas as (
    -- La cuenta ligada a esta ficha, y la que tenga su mismo correo: el
    -- segundo caso es el que deja HUÉRFANAS cuando el vínculo ya se borró
    -- pero el login sigue existiendo. Esa es peor que el bloqueo — entra y
    -- se queda sin perfil.
    select u.id from auth.users u where u.id = new.auth_user_id
    union
    select u.id from auth.users u
     where new.email is not null and lower(u.email) = lower(new.email)
  )
  update auth.users u
     set banned_until = 'infinity'::timestamptz
    from candidatas c
   where u.id = c.id
     and coalesce(u.banned_until, '-infinity'::timestamptz) < now()
     -- NO tocar una cuenta que usa alguien vivo.
     and not exists (
       select 1 from public.members v
        where v.auth_user_id = u.id and v.is_active and v.id <> new.id);
  get diagnostics v_bloqueadas = row_count;

  if v_bloqueadas > 0 then
    raise notice 'Fusión de %: % cuenta(s) de acceso bloqueadas.', new.id, v_bloqueadas;
  end if;

  -- El vínculo se suelta siempre: una ficha muerta no es dueña de un login.
  new.auth_user_id := null;
  return new;
end $$;

revoke execute on function public.cerrar_login_de_ficha_fusionada() from public, anon, authenticated;
grant  execute on function public.cerrar_login_de_ficha_fusionada() to service_role;

drop trigger if exists members_cerrar_login_al_fusionar on public.members;

-- BEFORE, para poder soltar `auth_user_id` en la misma fila sin un UPDATE
-- extra que volvería a disparar el trigger.
create trigger members_cerrar_login_al_fusionar
  before update of is_active, deactivation_reason on public.members
  for each row execute function public.cerrar_login_de_ficha_fusionada();

commit;
