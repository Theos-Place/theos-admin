-- FOL-3 (2026-10-29) · Estados del tiquete de folletos: creada → en_impresion
-- → empacado → enviado_entregado. Entra «empacado» y sale «cerrada».
--
-- Medido antes en producción: 6 creadas, 2 en impresión, 35 enviadas y CERO
-- cerradas, así que quitar el valor no deja ninguna fila fuera del CHECK. Por
-- si acaso, se comprueba: si hubiera alguna, la migración para y no toca nada.
--
-- El CHECK se reescribe LEYENDO el que hay (mismo molde que EST-21): una lista
-- escrita a mano acá se desactualiza en silencio contra producción.

begin;

do $$
declare
  v_def text;
  v_cerradas int;
begin
  select count(*) into v_cerradas from public.folleto_requests where status = 'cerrada';
  if v_cerradas > 0 then
    raise exception 'Hay % tiquetes en «cerrada»: moverlos antes de quitar el estado', v_cerradas;
  end if;

  select pg_get_constraintdef(oid) into v_def
    from pg_constraint where conname = 'folleto_requests_status_check';
  if v_def is null then
    raise exception 'No existe folleto_requests_status_check: parar y mirar';
  end if;
  if position('''empacado''' in v_def) > 0 and position('''cerrada''' in v_def) = 0 then
    raise notice 'El CHECK ya es el de FOL-3; no se toca.';
  else
    execute 'alter table public.folleto_requests drop constraint folleto_requests_status_check';
    execute format(
      'alter table public.folleto_requests add constraint folleto_requests_status_check %s',
      replace(v_def, '''cerrada''::text', '''empacado''::text'));
  end if;
end $$;

commit;
