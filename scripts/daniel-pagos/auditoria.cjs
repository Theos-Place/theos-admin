const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select action, entity_type, entity_id, old_data, new_data, created_at from audit_log
    where entity_id::text in ('0b92117e-2f5b-4734-9e39-423264ad4e40','bca71469-e51a-46b8-af97-8115748f13e3',
      '3d3a08b2-ac96-4023-a7f2-aeaca8fa769c') order by created_at`)
  r.rows.forEach(x => {
    const d = x.new_data || {}
    const resumen = x.entity_type === 'payments'
      ? `amount=${d.amount} status=${d.status} review=${d.review_status} recibo=${d.receipt_path ? 'sí' : 'no'} ref=${d.reference_code ?? '—'}`
      : `status=${d.status} enrolled_at=${d.enrolled_at} recorded_by=${d.recorded_by ?? '—'}`
    console.log(`${x.created_at.toISOString()} ${x.action.padEnd(6)} ${x.entity_type.padEnd(18)} ${x.entity_id.slice(0,8)}  ${resumen}`)
  })
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
