const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select action, entity_type, entity_id, old_data, new_data, created_at from audit_log
    where entity_id::text in ('80f5a122-d8c3-4a01-bf89-0d25d4dce339','ecc2226c-52fc-41b2-bc06-e7a769710139')
    order by created_at`)
  r.rows.forEach(x => {
    const d = x.new_data || {}
    console.log(`${x.created_at.toISOString()} ${x.action.padEnd(6)} ${x.entity_type.padEnd(18)} ` +
      (x.entity_type === 'payments'
        ? `₡${d.amount} ${d.status} grupo=${String(d.study_group_id ?? '—').slice(0,8)} nota=${d.transfer_note ? 'sí' : 'no'}`
        : `${d.status}`))
  })
  // ¿A quién bota el cron mañana a las 16:00?
  const v = await c.query(`
    select m.first_name||' '||m.last_name as p, g.name as grupo, e.created_at,
           round(extract(epoch from (now() - p2.created_at))/3600, 1) as horas
    from study_enrollments e join members m on m.id=e.member_id
      left join study_groups g on g.id=e.group_id
      left join payments p2 on p2.enrollment_id=e.id and p2.concept='matricula' and p2.status='pending'
    where e.status='pendiente_de_pago' and p2.review_status is null
    order by p2.created_at`)
  console.log(`\n=== en riesgo de que el cron les suelte el cupo (${v.rowCount}) ===`)
  v.rows.forEach(x => console.log(`  ${x.p.padEnd(28)} ${x.grupo} · lleva ${x.horas}h sin comprobante`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
