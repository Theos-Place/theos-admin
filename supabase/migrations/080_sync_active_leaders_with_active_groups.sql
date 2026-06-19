-- Punto 1: todo dirigente "dando ahora" (>=1 grupo en_matricula/en_curso como
-- leader o co-líder) queda ACTIVO = voluntario activo del Comité de Dirigentes +
-- study_leaders.is_active. Conteo previo: 119 dando ahora, 44 aún no activos en el
-- comité -> esta migración marcó 44 dirigentes como activos.
do $$
declare v_area uuid; v_pos uuid;
begin
  select id into v_area from areas where area_type='committee' and name ilike 'Comité de Dirigentes' limit 1;
  select id into v_pos from service_positions where area_id = v_area limit 1;

  create temp table _dando on commit drop as
    select distinct member_id from (
      select leader_id as member_id from study_groups where status in ('en_matricula','en_curso') and leader_id is not null
      union
      select co_leader_id as member_id from study_groups where status in ('en_matricula','en_curso') and co_leader_id is not null
    ) x where member_id is not null;

  insert into study_leaders (member_id, is_active, availability_status, zone_preference, qualified_study_codes, formation_study_codes)
  select member_id, true, 'available', '{}','{}','{}' from _dando
  on conflict (member_id) do update set is_active = true,
    availability_status = case when study_leaders.availability_status='inactive' then 'available' else study_leaders.availability_status end;

  if v_pos is not null then
    insert into volunteers (member_id, position_id, status)
    select member_id, v_pos, 'active' from _dando
    on conflict (member_id, position_id) do update set status = 'active';
  end if;
end $$;
