-- Quitarle el bloque EXCEPTION al trigger de auditoría: hacía las escrituras
-- casi 4 veces más lentas.
--
-- QUÉ PASÓ. La migración 20260916190000 (de hoy) envolvió la resolución del
-- actor en un `begin ... exception when others` para que un header malformado
-- no pudiera tumbar la escritura auditada. La intención era correcta; el precio,
-- no: en plpgsql, TODO bloque con manejador de excepciones abre una
-- SUBTRANSACCIÓN cada vez que se ejecuta. Y esto corre en cada INSERT, UPDATE y
-- DELETE de 11 tablas.
--
-- Medido con EXPLAIN ANALYZE sobre un UPDATE de 300 filas de members:
--
--   con EXCEPTION     2,510 ms/fila de trigger · 2.288 ms el statement
--   sin EXCEPTION     1,720 ms/fila            ·   665 ms
--   antes de hoy      1,570 ms/fila            ·   583 ms
--
-- LA SALIDA. Las tres guardas se mantienen intactas; lo que cambia es cómo se
-- leen los valores. En vez de castear a json —que sí puede tirar excepción y
-- por eso obligaba al bloque— se extrae con expresión regular, que ante
-- cualquier basura devuelve NULL y nunca falla. Sin excepción posible, no hace
-- falta el manejador, y sin manejador no hay subtransacción.
--
-- Queda 0,15 ms/fila por encima de como estaba antes de hoy, que es lo que
-- cuesta de verdad buscar el actor.

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
  v_texto text;
begin
  if TG_OP = 'UPDATE' then
    -- Solo las claves cuyo valor cambió. `is distinct from` y no `<>` para que
    -- un NULL cuente como cambio.
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

  -- Guarda 1: si el JWT trae usuario, ese manda y el header ni se mira.
  v_actor := auth.uid();

  if v_actor is null
     -- Guarda 2: solo el rol de servicio (nuestro servidor) declara por quién
     -- escribe. Se busca en el texto crudo del claim, sin castear a json.
     and current_setting('request.jwt.claims', true) ~ '"role"\s*:\s*"service_role"' then
    -- Guarda 3: el uuid se EXTRAE con el patrón, así que o viene bien formado o
    -- sale NULL; no hay cast que pueda fallar. Después se exige que exista:
    -- audit_log.actor_id tiene FK contra auth.users y un id inventado
    -- reventaría el INSERT de la auditoría, y con él la escritura original.
    v_texto := substring(
      current_setting('request.headers', true)
      from '"x-actor-user-id"\s*:\s*"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"');
    if v_texto is not null then
      select u.id into v_actor from auth.users u where u.id = v_texto::uuid;
    end if;
  end if;

  insert into audit_log (actor_id, action, entity_type, entity_id, old_data, new_data)
  values (v_actor, TG_OP, TG_TABLE_NAME, coalesce(NEW.id, OLD.id), v_old, v_new);
  return coalesce(NEW, OLD);
end;
$function$;
