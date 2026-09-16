const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select id, status, discount_value, plan_id, is_used, used_at, updated_at, notes
    from scholarships where member_id='2c04a86e-0166-4156-8b3b-d9477ab257c3' order by created_at`)
  r.rows.forEach(x => console.log(JSON.stringify(x)))
  console.log('\nROMANOS esperado: 9f23a1de-112f-4137-bbcb-0b2726221a89')
  console.log('LECTPROP esperado: ff8b6e29-4bc4-4cc5-9dcb-b14a581047b4')
  const p = await c.query(`select id, name from study_plans where id = any($1)`,
    [['9f23a1de-112f-4137-bbcb-0b2726221a89','ff8b6e29-4bc4-4cc5-9dcb-b14a581047b4']])
  p.rows.forEach(x => console.log(JSON.stringify(x)))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
