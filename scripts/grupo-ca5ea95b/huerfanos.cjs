/** SOLO LECTURA: cobros de matrícula sin study_group_id (auto-matrícula del cierre). */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select pa.id, m.first_name||' '||m.last_name as persona, pa.amount, pa.status,
           e.group_id, g.name as grupo, pl.name as plan, pa.created_at
    from payments pa
      join members m on m.id=pa.member_id
      left join study_enrollments e on e.id = pa.enrollment_id
      left join study_groups g on g.id = e.group_id
      left join study_plans pl on pl.id = g.plan_id
    where pa.concept='matricula' and pa.study_group_id is null
    order by pa.created_at`)
  console.log(`cobros de matrícula sin grupo: ${r.rowCount}\n`)
  r.rows.forEach(x => console.log(`  ${x.persona.padEnd(30)} ₡${String(Number(x.amount)).padEnd(6)} ${String(x.status).padEnd(10)} → ${x.grupo ?? 'SIN MATRÍCULA'} [${x.plan ?? '—'}]`))
  const sinEnr = r.rows.filter(x => !x.group_id)
  console.log(`\nde esos, sin matrícula que los ubique: ${sinEnr.length}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
