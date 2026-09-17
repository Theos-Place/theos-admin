const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const m = await c.query(`select id from members where replace(replace(cedula,'-',''),' ','')='115380496'`)
  const id = m.rows[0].id
  const e = await c.query(`select e.id, e.status, e.created_at, e.updated_at, g.name from study_enrollments e
    join study_groups g on g.id=e.group_id where e.member_id=$1 and e.created_at > now() - interval '7 days'`, [id])
  console.log(`matrículas recientes: ${e.rowCount}`)
  e.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  const p = await c.query(`select id, amount, status, concept, enrollment_id, created_at, review_status
    from payments where member_id=$1 order by created_at`, [id])
  console.log(`\npagos: ${p.rowCount}`)
  p.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  const a = await c.query(`select action, entity_type, entity_id, new_data->>'status' st, actor_id, created_at
    from audit_log where entity_id::text = any($1) order by created_at`,
    [[...e.rows.map(x=>x.id), ...p.rows.map(x=>x.id)]])
  console.log(`\nauditoría:`)
  a.rows.forEach(x => console.log(`  ${x.created_at.toISOString()} ${x.action.padEnd(6)} ${x.entity_type.padEnd(18)} st=${x.st ?? '—'} actor=${x.actor_id ? x.actor_id.slice(0,8) : '—'}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
