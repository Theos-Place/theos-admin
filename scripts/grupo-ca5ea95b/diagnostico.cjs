/** SOLO LECTURA: el grupo ca5ea95b, sus matrículas y sus pagos. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const G = 'ca5ea95b-ac49-46ec-a631-f2d1632d6cae'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const g = await c.query(`
    select g.id, g.name, g.status, g.max_students, g.starts_at, g.ends_at, g.current_week,
           g.closed_at, g.closed_by, pl.name as plan, pl.code, pl.cost, pl.next_study_code,
           l.first_name||' '||l.last_name as dirigente
    from study_groups g left join study_plans pl on pl.id=g.plan_id
      left join members l on l.id=g.leader_id where g.id=$1`,[G])
  console.log('=== GRUPO ===\n' + JSON.stringify(g.rows[0], null, 1))

  const e = await c.query(`
    select e.id, m.first_name||' '||m.last_name as persona, e.status, e.grade, e.notes,
           e.enrolled_at, e.dropped_at, e.drop_reason, e.completed_at, e.created_at
    from study_enrollments e join members m on m.id=e.member_id
    where e.group_id=$1 order by m.first_name`,[G])
  console.log(`\n=== MATRÍCULAS (${e.rowCount}) ===`)
  e.rows.forEach(x => console.log(`  ${x.persona.padEnd(32)} ${String(x.status).padEnd(18)} nota=${x.grade ?? '—'} ${x.drop_reason ? '· '+x.drop_reason : ''}${x.notes ? ' · notes='+x.notes : ''}`))

  const p = await c.query(`
    select m.first_name||' '||m.last_name as persona, pa.id, pa.amount, pa.status, pa.concept,
           pa.review_status, pa.receipt_path is not null as recibo, pa.enrollment_id, pa.created_at
    from payments pa join members m on m.id=pa.member_id
    where pa.study_group_id=$1 order by m.first_name`,[G])
  console.log(`\n=== PAGOS (${p.rowCount}) ===`)
  p.rows.forEach(x => console.log(`  ${x.persona.padEnd(32)} ₡${String(Number(x.amount)).padEnd(7)} ${String(x.status).padEnd(10)} ${String(x.review_status ?? '—').padEnd(12)} recibo=${x.recibo?'sí':'no'} [${x.concept}]`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
