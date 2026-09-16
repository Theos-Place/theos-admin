const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  for (const nombre of ['alberto%vargas%carpio','yanil%gutierrez%rios']) {
    const f = await c.query(`select id, first_name||' '||last_name as n from members where unaccent(lower(first_name||' '||last_name)) like $1`,[nombre])
    const id = f.rows[0].id
    console.log(`\n######## ${f.rows[0].n} ########`)
    const p = await c.query(`
      select pa.id, pa.amount, pa.status, pa.concept, pa.description, pa.review_status,
             pa.receipt_path is not null as recibo, pa.reference_code, pa.enrollment_id,
             pa.created_at, pa.rejection_reason
      from payments pa where pa.member_id=$1 order by pa.created_at`,[id])
    p.rows.forEach(x => console.log('  PAGO ' + JSON.stringify(x)))
    const enrs = [...new Set(p.rows.map(x=>x.enrollment_id).filter(Boolean))]
    const a = await c.query(`
      select action, entity_type, entity_id, new_data, created_at from audit_log
      where entity_id::text = any($1) order by created_at`,
      [[...p.rows.map(x=>x.id), ...enrs]])
    a.rows.forEach(x => {
      const d = x.new_data || {}
      console.log(`  ${x.created_at.toISOString()} ${x.action.padEnd(6)} ${x.entity_type.padEnd(18)} ${String(x.entity_id).slice(0,8)} ` +
        (x.entity_type==='payments' ? `amount=${d.amount} status=${d.status} review=${d.review_status} recibo=${d.receipt_path?'sí':'no'}` : `status=${d.status}`))
    })
  }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
