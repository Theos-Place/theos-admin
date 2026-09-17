const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const cc = await c.query(`select column_name from information_schema.columns where table_name='payment_plans' and table_schema='public' order by ordinal_position`)
  console.log('payment_plans: ' + cc.rows.map(r=>r.column_name).join(', '))
  const p = await c.query(`select * from payment_plans order by created_at desc limit 3`)
  console.log(`\nplanes existentes: ${p.rowCount}`)
  p.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  const r = await c.query(`
    select count(*) n from study_enrollments e
    where e.status='pendiente_de_pago'
      and exists (select 1 from payments pa where pa.enrollment_id=e.id and pa.payment_plan_id is not null)`)
  console.log(`\nmatrículas 'pendiente_de_pago' CON plan de pagos: ${r.rows[0].n}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
