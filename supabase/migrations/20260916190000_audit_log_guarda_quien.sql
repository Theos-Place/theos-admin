-- El audit_log ahora sí guarda QUIÉN.
--
-- EL PROBLEMA. `log_changes()` guardaba `auth.uid()`, que sale del JWT. Pero la
-- app escribe siempre con la llave de servicio, así que ese JWT es el del rol
-- de servicio y auth.uid() es null. Medido antes de este cambio: de 369.773
-- filas de auditoría, solo 227 tenían actor. La bitácora sabía qué cambió y
-- cuándo, pero casi nunca quién.
--
-- Se notó buscando quién movió a Pamela Fonseca entre grupos de SCJ: los 5
-- eventos del traslado tenían actor vacío y el único rastro era un nombre
-- suelto dentro del texto libre de una nota de pago.
--
-- LA SOLUCIÓN. El cliente admin manda el usuario de la sesión en el header
-- `x-actor-user-id` (ver lib/auth/actor-actual.ts) y acá se lee con
-- current_setting('request.headers'), que es como PostgREST expone los headers
-- de la petición.
--
-- TRES GUARDAS, y ninguna es opcional:
--
--  1. auth.uid() MANDA. Si el JWT trae un usuario, ese gana y el header ni se
--     mira. Así nadie puede atribuirle a otro lo que escribe con su sesión.
--
--  2. El header SOLO se cree cuando la petición viene con el rol de servicio,
--     o sea desde nuestro propio servidor. Con la llave anónima el header se
--     ignora: si no, cualquiera podría pegarle a PostgREST mandándolo a mano y
--     firmar sus cambios con el nombre de otro.
--
--  3. Se valida que sea un uuid QUE EXISTA en auth.users. audit_log.actor_id
--     tiene FK contra esa tabla, así que un uuid inventado —o basura que no
--     castea— reventaría el INSERT de la auditoría y con él la escritura
--     original. O sea: un header malo dejaría la app sin poder guardar nada.
--     Ante cualquier duda, actor null, que es exactamente como está hoy.

create or replace function public.log_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old   jsonb;
  v_new   jsonb;
  v_actor uuid;
  v_rol   text;
  v_texto text;
begin
  if TG_OP = 'UPDATE' then
    -- Solo las claves cuyo valor cambió. `is distinct from` y no `<>` para que
    -- un NULL cuente como cambio: pasar de una fecha a NULL es justo el caso
    -- que motivó esto.
    select
      coalesce(jsonb_object_agg(o.key, o.value) filter (where o.key is not null), '{}'::jsonb),
      coalesce(jsonb_object_agg(o.key, n.value) filter (where o.key is not null), '{}'::jsonb)
      into v_old, v_new
    from jsonb_each(to_jsonb(OLD)) o
    join jsonb_each(to_jsonb(NEW)) n on n.key = o.key
    where o.value is distinct from n.value
      and o.key <> 'updated_at';
  elsif TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
    v_new := null;
  else
    v_old := null;
    v_new := to_jsonb(NEW);
  end if;

  -- Guarda 1: el JWT manda.
  v_actor := auth.uid();

  if v_actor is null then
    begin
      -- Guarda 2: solo el rol de servicio (nuestro servidor) puede declarar
      -- por quién escribe.
      v_rol := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role';
      if v_rol = 'service_role' then
        v_texto := nullif(
          nullif(current_setting('request.headers', true), '')::json ->> 'x-actor-user-id', '');
        -- Guarda 3: uuid bien formado Y existente. Cualquier otra cosa → null.
        if v_texto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          select u.id into v_actor from auth.users u where u.id = v_texto::uuid;
        end if;
      end if;
    exception when others then
      -- Un header raro NUNCA puede tumbar la escritura que se está auditando.
      v_actor := null;
    end;
  end if;

  insert into audit_log (actor_id, action, entity_type, entity_id, old_data, new_data)
  values (v_actor, TG_OP, TG_TABLE_NAME, coalesce(NEW.id, OLD.id), v_old, v_new);
  return coalesce(NEW, OLD);
end;
$function$;
