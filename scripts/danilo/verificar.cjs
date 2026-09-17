const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const g = await c.query(`
    select m.first_name||' '||m.last_name p, e.status,
           coalesce(pa.status,'sin cobro') pago, pa.amount
    from study_enrollments e join members m on m.id=e.member_id
      left join payments pa on pa.enrollment_id=e.id and pa.concept='matricula'
    where e.group_id='46b307f3-6184-484a-bb81-e4cadff84b36' order by 1`)
  console.log(`=== Nivel 4. Floriana Fonseca. Junio 2026 (${g.rowCount}) ===`)
  g.rows.forEach(x => console.log(`  ${x.p.padEnd(32)} ${String(x.status).padEnd(12)} ${x.pago}${x.amount ? ' ₡'+Number(x.amount) : ''}`))
  const d = await c.query(`
    select e.status, gr.name grupo, pa.amount, pa.status pago
    from study_enrollments e join study_groups gr on gr.id=e.group_id
      left join payments pa on pa.enrollment_id=e.id
    where e.member_id='f4d0952e-645b-4064-b8f9-b1ada3d62d84' and e.created_at > now() - interval '3 months'`)
  console.log(`\n=== lo que le queda a Danilo Mata Corella este trimestre ===`)
  d.rows.forEach(x => console.log(`  ${x.grupo.padEnd(34)} ${x.status}  ${x.amount ? '₡'+Number(x.amount)+' '+x.pago : 'sin cobro'}`))
  const a = await c.query(`select action, entity_type, created_at from audit_log
    where entity_id in ('7dfcb575-84b4-46a1-aefe-f1e3353ff994','6c6986cf-390b-4cd4-a86f-6ec65d63f38b')
      and action='DELETE'`)
  console.log(`\nborrados registrados en la auditoría: ${a.rowCount}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
