-- EST-21 · Pedir los folletos ANTES de que el grupo arranque.
--
-- Un grupo de Nivel 1 necesita los folletos del par (1+2) impresos para el
-- primer día, y la imprenta tarda: hay que pedirlos ~15 días antes, con el
-- grupo todavía en matrícula. Hoy el único disparador vivo de la cadena de
-- niveles es el CIERRE del grupo anterior, que llega tarde para esto —
-- `cupo_lleno` y `fin_matricula` quedaron muertos el 2026-09-02 porque 78 de
-- 93 grupos no tenían ni cupo ni ventana.
--
-- Se agrega el tipo `anticipado`: lo dispara a mano el equipo de estudios
-- desde la pantalla del grupo.
--
-- POR QUÉ UN TIPO NUEVO Y NO `manual`: el `manual` que ya existe es SUELTO —
-- se pide desde la pantalla de folletos y no guarda `source_group_id`—, así
-- que no puede decir «este grupo ya los pidió» ni entrar en la idempotencia.
-- Mezclar los dos habría hecho que uno de los dos significados perdiera.
--
-- EL CHECK SE AMPLÍA LEYENDO EL QUE HAY, no reescribiendo la lista: una lista
-- escrita a mano acá se desactualiza en silencio contra la de producción, que
-- es exactamente como se rompió el CHECK de `member_roles` en setiembre.

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
  if position('''anticipado''' in v_def) > 0 then
    raise notice 'El CHECK ya conoce «anticipado»; no se toca.';
  else
    execute 'alter table public.folleto_requests drop constraint folleto_requests_tipo_check';
    execute format(
      'alter table public.folleto_requests add constraint folleto_requests_tipo_check %s',
      replace(v_def, 'ARRAY[', 'ARRAY[''anticipado''::text, '));
  end if;
end $$;

-- El índice único de una orden por grupo ahora incluye `anticipado`: así el
-- doble clic no duplica, y el disparador automático del cierre tampoco crea
-- una segunda orden encima de la que ya se pidió a mano.
drop index if exists public.folleto_requests_auto_por_grupo;

create unique index folleto_requests_auto_por_grupo
    on public.folleto_requests (source_group_id)
 where tipo in ('cupo_lleno', 'fin_matricula', 'cierre', 'anticipado');

commit;
