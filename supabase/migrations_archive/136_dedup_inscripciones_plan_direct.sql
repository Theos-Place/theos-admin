-- Dedup de inscripciones plan-direct (backlog QA 2026-07-17, confirmado por
-- el usuario): el histórico de campañas quedó importado DOS veces para ~626
-- miembros — una inscripción DIRECTA (group_id null) y otra por GRUPO del
-- mismo plan. Cuando la de grupo está 'completed', la directa es redundante
-- (la de grupo tiene dirigente/fechas) y solo infla conteos.
-- Se CONSERVAN las directas cuyo grupo quedó 'dropped': ahí la directa es el
-- único registro de que la persona completó el plan.
delete from study_enrollments d
where d.group_id is null
  and exists (
    select 1 from study_enrollments g
    join study_groups sg on sg.id = g.group_id
    where g.member_id = d.member_id
      and sg.plan_id = d.plan_id
      and g.status = 'completed'
  );
