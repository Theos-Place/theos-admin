-- Resolver un ID de CCB a la ficha correcta, incluso después de una fusión.
--
-- El merge deja el external_id del duplicado en external_id_fusionados y NO se
-- lo copia al principal (external_id está en merge_no_copia). La ficha del
-- duplicado tampoco se borra: queda is_active=false con
-- deactivation_reason='merged', conservando su external_id.
--
-- O sea que un ID de CCB puede aparecer en DOS fichas a la vez: como
-- external_id de la muerta y dentro de external_id_fusionados de la viva. Es el
-- caso de Dylana Vincenti (5107) y de María José Céspedes (23069). Buscar por
-- external_id a secas devuelve la ficha muerta, que es peor que no encontrar
-- nada — parece que la persona está inactiva cuando está sirviendo.
--
-- Por eso el orden de preferencia es ACTIVA primero y recién después el tipo de
-- coincidencia. Sin esto, el próximo import de CCB crearía fichas nuevas para
-- las tres personas fusionadas y desharía las fusiones.

-- Sin índice, cada búsqueda por el arreglo es un seq scan sobre members.
create index if not exists idx_members_external_id_fusionados
  on public.members using gin (external_id_fusionados);

create or replace function public.member_por_external_id(p_ext text)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select m.id
  from members m
  where p_ext is not null
    and (m.external_id = p_ext or m.external_id_fusionados @> array[p_ext])
  order by
    -- 1) una ficha viva siempre le gana a una fusionada.
    m.is_active desc,
    -- 2) entre vivas, el external_id propio le gana al heredado: si alguien
    --    tiene el ID como suyo, es esa persona y no quien lo absorbió.
    (m.external_id = p_ext) desc,
    -- 3) desempate estable para que dos corridas den lo mismo.
    m.created_at
  limit 1
$function$;

comment on function public.member_por_external_id(text) is
  'ID de CCB → ficha viva, mirando también los external_id absorbidos en una fusión. Todo import o cruce contra CCB debe usar esto y no members.external_id a secas.';
