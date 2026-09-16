/** SOLO LECTURA: estado de María José Ruiz Fuentes en estudios, becas y pagos. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const MJ = '2c04a86e-0166-4156-8b3b-d9477ab257c3'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const q = async (t, sql, p = [MJ]) => {
    const r = await c.query(sql, p)
    console.log(`\n=== ${t} (${r.rowCount}) ===`)
    r.rows.forEach(x => console.log(JSON.stringify(x)))
    return r.rows
  }

  await q('MATRÍCULAS', `
    select e.id, e.status, e.enrolled_at, e.dropped_at, e.drop_reason, e.transferred_to,
           g.id as group_id, g.name as grupo, g.status as estado_grupo, g.max_students,
           p.name as plan, g.plan_id
    from study_enrollments e
      join study_groups g on g.id = e.group_id
      left join study_plans p on p.id = g.plan_id
    where e.member_id = $1 order by e.created_at`)

  await q('BECAS', `
    select s.id, s.status, s.kind, s.discount_type, s.discount_value, s.amount,
           s.original_amount, s.final_amount, s.is_used, s.used_at, s.entity_type,
           s.plan_id, pl.name as plan_beca, s.request_id, s.approved_at, s.created_at, s.notes, s.reason
    from scholarships s left join study_plans pl on pl.id = s.plan_id
    where s.member_id = $1 order by s.created_at`)

  await q('PAGOS', `
    select pa.id, pa.amount, pa.status, pa.concept, pa.description, pa.scholarship,
           pa.scholarship_id, pa.enrollment_id, pa.study_group_id, g.name as grupo,
           pa.created_at, pa.review_status
    from payments pa left join study_groups g on g.id = pa.study_group_id
    where pa.member_id = $1 order by pa.created_at`)

  // ¿Existe un grupo de Lecturas con Propósito abierto? ¿y el de Romanos?
  await q('GRUPOS candidatos (Romanos / Lecturas)', `
    select g.id, g.name, g.status, g.max_students, g.sede, g.starts_at,
           p.name as plan, g.plan_id,
           (select count(*) from study_enrollments e
             where e.group_id = g.id and e.status <> 'withdrawn') as inscritos
    from study_groups g left join study_plans p on p.id = g.plan_id
    where (unaccent(lower(g.name)) like '%romanos%' or unaccent(lower(p.name)) like '%romanos%'
        or unaccent(lower(g.name)) like '%lectura%' or unaccent(lower(p.name)) like '%lectura%')
      and g.starts_at > now() - interval '8 months'
    order by g.starts_at desc`, [])

  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
