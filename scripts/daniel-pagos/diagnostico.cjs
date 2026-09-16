/** SOLO LECTURA: pagos y matrículas de Daniel Alfaro Cardoza. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const f = await c.query(`
    select id, first_name, last_name, email, external_id, is_active, deactivation_reason
    from members where unaccent(lower(first_name||' '||last_name)) like '%daniel%alfaro%' order by is_active desc`)
  console.log(`=== FICHAS (${f.rowCount}) ===`)
  f.rows.forEach(x => console.log(JSON.stringify(x)))
  const ids = f.rows.map(x => x.id)
  if (!ids.length) { await c.end(); return }

  const p = await c.query(`
    select pa.id, pa.member_id, pa.amount, pa.status, pa.concept, pa.description, pa.payment_method,
           pa.review_status, pa.scholarship_id, pa.enrollment_id, pa.study_group_id, g.name as grupo,
           pa.receipt_path is not null as con_comprobante, pa.reference_code, pa.paid_at,
           pa.created_at, pa.updated_at, pa.rejection_reason, pa.transfer_note
    from payments pa left join study_groups g on g.id=pa.study_group_id
    where pa.member_id = any($1) order by pa.created_at`, [ids])
  console.log(`\n=== PAGOS (${p.rowCount}) ===`)
  p.rows.forEach(x => { console.log('---'); for (const [k,v] of Object.entries(x)) if(v!==null&&v!==''&&v!==false) console.log(`  ${k}: ${JSON.stringify(v)}`) })

  const e = await c.query(`
    select e.id, e.member_id, e.status, e.enrolled_at, e.dropped_at, e.drop_reason, e.transferred_to,
           e.created_at, g.name as grupo, pl.name as plan, pl.cost
    from study_enrollments e join study_groups g on g.id=e.group_id
      left join study_plans pl on pl.id=g.plan_id
    where e.member_id = any($1) and e.created_at > now() - interval '3 months' order by e.created_at`, [ids])
  console.log(`\n=== MATRÍCULAS recientes (${e.rowCount}) ===`)
  e.rows.forEach(x => console.log(JSON.stringify(x)))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
