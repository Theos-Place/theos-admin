-- AUD-1 · El audit_log no servía para revertir nada.
--
-- En un UPDATE, log_changes escribía `old_data` en NULL a propósito y guardaba
-- la fila NUEVA entera en `new_data`. O sea registraba que algo cambió y cómo
-- quedó, pero nunca cómo estaba antes. Se descubrió el 15 de setiembre al
-- vaciar 26 fechas de nacimiento mal digitadas: el único respaldo de esos
-- valores terminaron siendo unos CSV en data-import/.
--
-- Y de paso resuelve el tamaño. La tabla iba en 314 MB con 369 mil filas
-- porque cada UPDATE copiaba las ~50 columnas de la fila aunque hubiera
-- cambiado una sola. Ahora un UPDATE guarda SOLO LO QUE CAMBIÓ, viejo y nuevo:
-- se recupera lo que faltaba y cada fila pesa una fracción.
--
-- INSERT y DELETE no cambian: ahí la fila entera ES el contenido.
--
-- `updated_at` se excluye del diff porque lo mueve el trigger set_updated_at en
-- cada escritura; si contara, todo cambio traería ese ruido y un UPDATE que no
-- tocó nada se vería como si hubiera tocado algo.

create or replace function public.log_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_old jsonb;
  v_new jsonb;
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

  insert into audit_log (actor_id, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid()::uuid, TG_OP, TG_TABLE_NAME, coalesce(NEW.id, OLD.id), v_old, v_new);
  return coalesce(NEW, OLD);
end;
$function$;

comment on function public.log_changes() is
  'AUD-1 · En UPDATE guarda SOLO las columnas que cambiaron, con su valor viejo y el nuevo. Antes old_data iba en NULL y el valor anterior se perdía. INSERT y DELETE guardan la fila entera.';
