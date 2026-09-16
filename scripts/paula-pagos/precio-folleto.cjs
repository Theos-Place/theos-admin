const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const cc = await c.query(`select column_name from information_schema.columns where table_name='study_plans' and table_schema='public' order by ordinal_position`)
  console.log('columnas de study_plans: ' + cc.rows.map(r=>r.column_name).join(', '))
  const p = await c.query(`select id, name, code, cost, currency from study_plans where id='03eae89f-075c-4d0c-86e2-8e2bce167b70'`)
  console.log('\nplan del grupo: ' + JSON.stringify(p.rows[0]))
  // ¿La solicitud de reubicación de Paula pedía folleto?
  const r = await c.query(`
    select id, member_id, status, wants_folleto, created_at, resolved_at
    from study_requests where member_id='736684e1-7c94-4ff4-a3bf-7a7f22e31e2e' order by created_at desc limit 5`)
  console.log(`\nsolicitudes de estudio de Paula: ${r.rowCount}`)
  r.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
