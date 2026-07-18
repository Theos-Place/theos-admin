-- Formación (capacitado para dar) como campo almacenado y editable. Antes se
-- derivaba de los grupos dados; ahora se persiste para gestionarla en lote.
alter table study_leaders add column if not exists formation_study_codes text[] not null default '{}';

-- Siembra: lo que cada dirigente YA dio (leader o co-líder), códigos distintos.
with given as (
  select gm.member_id, array_agg(distinct sp.code order by sp.code) as codes
  from (
    select leader_id as member_id, plan_id from study_groups where leader_id is not null and plan_id is not null
    union all
    select co_leader_id as member_id, plan_id from study_groups where co_leader_id is not null and plan_id is not null
  ) gm
  join study_plans sp on sp.id = gm.plan_id and sp.code is not null
  group by gm.member_id
)
insert into study_leaders (member_id, formation_study_codes, is_active, availability_status, zone_preference, qualified_study_codes)
select member_id, codes, false, 'inactive', '{}', '{}' from given
on conflict (member_id) do update set formation_study_codes = excluded.formation_study_codes;
