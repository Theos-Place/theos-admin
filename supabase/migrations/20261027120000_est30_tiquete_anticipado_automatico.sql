-- EST-30 · Folletos de Nivel 1: tiquete automático dos semanas antes del fin
-- de matrícula, al cupo máximo; se actualiza al abrir el grupo.
--
-- Tipo nuevo `anticipado_auto`. NO se reusa `anticipado` (EST-21) porque ese
-- lo pide UNA PERSONA desde la pantalla del grupo y queda en la auditoría
-- con su nombre; cuando alguien pregunte «¿quién mandó a imprimir 15 de un
-- grupo con 3 matriculados?», la respuesta tiene que ser «el sistema, por
-- regla», no un nombre que no apretó nada.
--
-- El CHECK se amplía leyendo el que hay (mismo patrón que EST-21): una lista
-- escrita a mano acá se desactualiza contra producción.

begin;

do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint where conname = 'folleto_requests_tipo_check';
  if v_def is null then
    raise exception 'No existe folleto_requests_tipo_check: parar y mirar';
  end if;
  if position('''anticipado_auto''' in v_def) > 0 then
    raise notice 'El CHECK ya conoce «anticipado_auto»; no se toca.';
  else
    execute 'alter table public.folleto_requests drop constraint folleto_requests_tipo_check';
    execute format(
      'alter table public.folleto_requests add constraint folleto_requests_tipo_check %s',
      replace(v_def, 'ARRAY[', 'ARRAY[''anticipado_auto''::text, '));
  end if;
end $$;

-- Una orden por grupo, también para el automático: si el botón de EST-21 o
-- el cierre del grupo anterior ya pidieron, el cron no crea otra encima.
drop index if exists public.folleto_requests_auto_por_grupo;

create unique index folleto_requests_auto_por_grupo
    on public.folleto_requests (source_group_id)
 where tipo in ('cupo_lleno', 'fin_matricula', 'cierre', 'anticipado', 'anticipado_auto');

commit;
