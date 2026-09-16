const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const a = await c.query(`
    select m.first_name||' '||m.last_name as p, e.status, e.notes, e.completed_at, e.grade
    from study_enrollments e join members m on m.id=e.member_id
    where e.group_id='a3570184-300b-4836-9935-76aba5de1127' order by e.notes`)
  console.log('=== N2 de Daniella: cómo quedaron ==='); a.rows.forEach(x=>console.log('  '+JSON.stringify(x)))
  const v = await c.query(`
    select e.id, e.group_id, e.status, e.notes, e.completed_at, e.plan_id, g.name, g.status as eg, g.starts_at
    from study_enrollments e join study_groups g on g.id=e.group_id
    where e.member_id='0552f084-3f0d-4b51-812b-f96305676ebb'`)
  console.log('\n=== matrículas de Victoria ==='); v.rows.forEach(x=>console.log('  '+JSON.stringify(x)))
  const n3 = await c.query(`select id, plan_id, name from study_groups where id='ca5ea95b-ac49-46ec-a631-f2d1632d6cae'`)
  console.log('\nN3 destino: ' + JSON.stringify(n3.rows[0]))
  const j = await c.query(`
    select e.id, e.group_id, e.status, e.notes, e.plan_id, e.dropped_at, e.drop_reason
    from study_enrollments e where e.member_id='2a156c86-a028-451c-b50a-2fc720a289cb'`)
  console.log('\n=== matrículas de Jonathan ==='); j.rows.forEach(x=>console.log('  '+JSON.stringify(x)))
  const jp = await c.query(`select id, amount, status, concept, review_status, payment_method, enrollment_id from payments where member_id='2a156c86-a028-451c-b50a-2fc720a289cb'`)
  console.log('\n=== pagos de Jonathan ==='); jp.rows.forEach(x=>console.log('  '+JSON.stringify(x)))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
