/** SOLO LECTURA: pagos y matrículas de Paula García Apú. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const f = await c.query(`
    select id, first_name, last_name, email, external_id, is_active, deactivation_reason
    from members
    where unaccent(lower(first_name||' '||last_name)) like '%paula%garcia%'
    order by is_active desc`)
  console.log(`=== FICHAS (${f.rowCount}) ===`)
  f.rows.forEach(x => console.log(JSON.stringify(x)))
  const ids = f.rows.map(x => x.id)
  if (!ids.length) { await c.end(); return }

  const p = await c.query(`
    select pa.id, pa.member_id, pa.amount, pa.currency, pa.status, pa.concept, pa.description,
           pa.payment_method, pa.review_status, pa.scholarship_id, pa.enrollment_id,
           pa.study_group_id, g.name as grupo, pa.receipt_path, pa.paid_at, pa.reference_code,
           pa.created_at, pa.updated_at, pa.reviewed_by, pa.reviewed_at, pa.transfer_note,
           pa.rejection_reason, pa.sinpe_confirmation, pa.payment_plan_id, pa.installment_number
    from payments pa left join study_groups g on g.id = pa.study_group_id
    where pa.member_id = any($1) order by pa.created_at`, [ids])
  console.log(`\n=== PAGOS (${p.rowCount}) ===`)
  p.rows.forEach(x => { console.log('---'); for (const [k,v] of Object.entries(x)) if(v!==null&&v!=='') console.log(`  ${k}: ${JSON.stringify(v)}`) })

  const e = await c.query(`
    select e.id, e.member_id, e.status, e.enrolled_at, e.dropped_at, e.transferred_to, e.created_at,
           g.id as group_id, g.name as grupo, pl.name as plan, pl.cost
    from study_enrollments e join study_groups g on g.id=e.group_id
      left join study_plans pl on pl.id = g.plan_id
    where e.member_id = any($1) and e.created_at > now() - interval '6 months'
    order by e.created_at`, [ids])
  console.log(`\n=== MATRÍCULAS recientes (${e.rowCount}) ===`)
  e.rows.forEach(x => console.log(JSON.stringify(x)))

  const b = await c.query(`select id, status, discount_value, plan_id, original_amount, final_amount from scholarships where member_id = any($1)`,[ids])
  console.log(`\n=== BECAS (${b.rowCount}) ===`)
  b.rows.forEach(x => console.log(JSON.stringify(x)))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
