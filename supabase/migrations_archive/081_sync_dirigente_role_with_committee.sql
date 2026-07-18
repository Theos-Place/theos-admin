-- Regla: dirigente activo (voluntario activo del Comité de Dirigentes) debe tener
-- el rol 'dirigente' en member_roles. Sincroniza el estado existente (164 activos
-- sin el rol). Reactiva el rol si estaba inactivo; lo inserta si falta.
update member_roles mr set is_active = true, revoked_at = null
where mr.role = 'dirigente' and mr.is_active = false
  and exists (
    select 1 from volunteers v join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
    where v.member_id = mr.member_id and v.status='active' and a.area_type='committee' and a.name ilike 'Comité de Dirigentes');

insert into member_roles (member_id, role, is_active)
select distinct v.member_id, 'dirigente', true
from volunteers v join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
where v.status='active' and a.area_type='committee' and a.name ilike 'Comité de Dirigentes'
  and not exists (select 1 from member_roles mr where mr.member_id=v.member_id and mr.role='dirigente');
