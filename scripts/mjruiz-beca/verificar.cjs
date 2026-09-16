const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const MJ='2c04a86e-0166-4156-8b3b-d9477ab257c3', G='253a16e5-ece9-44e8-bfaa-d7717db37b95'
const OCUPAN=['enrolled','pendiente_de_pago','waitlist','completed','reprobado']
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const m = await c.query(`select e.status, e.dropped_at, e.drop_reason, g.name from study_enrollments e join study_groups g on g.id=e.group_id where e.member_id=$1 and e.group_id=$2`,[MJ,G])
  console.log('MATRÍCULA: ' + JSON.stringify(m.rows[0]))
  const p = await c.query(`select amount, status, payment_method, review_status, scholarship_id, description from payments where member_id=$1`,[MJ])
  console.log(`PAGOS (${p.rowCount}): ` + p.rows.map(x=>JSON.stringify(x)).join(' '))
  const b = await c.query(`select id, status, discount_value, used_at, plan_id from scholarships where member_id=$1 order by created_at`,[MJ])
  console.log('BECAS:'); b.rows.forEach(x=>console.log('  '+JSON.stringify(x)))
  const cu = await c.query(`select count(*) n from study_enrollments where group_id=$1 and status = any($2)`,[G,OCUPAN])
  const mx = await c.query(`select max_students from study_groups where id=$1`,[G])
  console.log(`CUPO del grupo: ${cu.rows[0].n} de ${mx.rows[0].max_students}`)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
