const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const m = await c.query(`select id from members where replace(replace(cedula,'-',''),' ','')='115380496'`)
  const id = m.rows[0].id
  const s = await c.query(`select id, status, discount_value, plan_id, used_at, created_at from scholarships where member_id=$1`, [id])
  console.log('becas:'); s.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  const a = await c.query(`select old_data, new_data, created_at from audit_log
    where entity_id='ac7ebcf5-8e25-4428-829b-575cce80e75d' order by created_at`)
  console.log('\ncambios en el PRIMER cobro pendiente (ac7ebcf5):')
  a.rows.forEach(x => console.log(`  ${x.created_at.toISOString()}\n    old: ${JSON.stringify(x.old_data)}\n    new: ${JSON.stringify(x.new_data)}`))
  const b = await c.query(`select new_data from audit_log where entity_id='f1828c81-604b-40a1-a87e-3d83047b3041'`)
  console.log('\nel SEGUNDO cobro al nacer:')
  b.rows.forEach(x => { const d = x.new_data; console.log('  ' + JSON.stringify({amount:d.amount, scholarship_id:d.scholarship_id, payment_method:d.payment_method, description:d.description, recorded_by:d.recorded_by})) })
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
