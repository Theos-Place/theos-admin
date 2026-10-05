-- BEC-5 · Razones cerradas y el estado «por modificar».
--
-- Decidido con Meli el 2026-09-29. Dos cambios de esquema; el resto de
-- BEC-5 es pantalla y notificaciones.
--
-- 1 · LA RAZÓN SE CATEGORIZA. Hoy `reason` es texto libre y nada más. Las 10
--     solicitudes reales de producción dicen siempre lo mismo de tres formas
--     distintas —«Estuve 4 meses sin trabajo», «voy a cumplir 1 año sin
--     trabajo», «mi situación económica»— así que no se pueden contar ni
--     filtrar, y Meli lee diez párrafos para clasificar algo que son tres
--     casillas.
--
--     `reason` NO se toca: la categoría dice el QUÉ y el texto dice el caso,
--     que es lo que se lee para decidir. Son dos datos, no uno.
--
--     Va NULLABLE a propósito: las 10 que ya existen no tienen categoría y
--     ponerles una sería inventar. Lo obligatorio es para las nuevas, y eso
--     lo exige el endpoint.
--
-- 2 · «POR MODIFICAR». Cuando el grupo elegido se llena, la solicitud no se
--     rechaza. Una de las diez dice textualmente «la había solicitado para
--     Romanos pero ya está lleno»: hoy eso obliga a la persona a empezar de
--     cero y a Meli a leer el caso otra vez. Con este estado la solicitud
--     sigue viva y lo único que falta es que la persona elija otro grupo.
--
-- El `study_group_id` que pide el punto 3 YA EXISTE en la tabla (migración
-- 048) y nunca se había usado: las 10 solicitudes apuntan a `plan_id`. No
-- hace falta columna nueva, hace falta empezar a llenarla.

alter table public.finance_requests
  add column if not exists reason_category text;

-- El CHECK acepta NULL para no romper lo que ya existe.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.finance_requests'::regclass
       and conname = 'finance_requests_reason_category_check'
  ) then
    alter table public.finance_requests
      add constraint finance_requests_reason_category_check
      check (reason_category is null
             or reason_category in ('desempleo', 'salud', 'socioeconomica'));
  end if;
end $$;

comment on column public.finance_requests.reason_category is
  'BEC-5: por cuál de las tres razones se pide la beca. El detalle en texto va en `reason`.';

-- El estado nuevo. Se LEE el CHECK que hay en vez de reescribirlo de memoria:
-- escribir la lista a mano es como se pierde un estado que alguien agregó
-- en el medio.
do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid = 'public.finance_requests'::regclass
     and conname = 'finance_requests_status_check';

  if v_def is null then
    raise exception 'No existe finance_requests_status_check: revisar antes de seguir.';
  end if;

  if position('por_modificar' in v_def) > 0 then
    raise notice 'El CHECK ya acepta por_modificar; no se toca.';
  else
    alter table public.finance_requests drop constraint finance_requests_status_check;
    execute format(
      'alter table public.finance_requests add constraint finance_requests_status_check %s',
      replace(v_def, '''resolved''::text', '''por_modificar''::text, ''resolved''::text'));
  end if;
end $$;

-- La consulta que importa para el punto 5: «¿qué solicitudes vivas apuntan a
-- este grupo?». Se corre cada vez que una matrícula llena un grupo.
create index if not exists finance_requests_grupo_vivas
  on public.finance_requests (study_group_id)
  where status in ('open', 'in_review', 'por_modificar');
