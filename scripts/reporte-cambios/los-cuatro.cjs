/** SOLO LECTURA: los 4 pendientes que quedan. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const CEDULAS = ['115380496','402090998','603080549','113130107']
;(async () => {
  const c = nuevoCliente(); await c.connect()
  for (const ced of CEDULAS) {
    const f = await c.query(`select id, first_name||' '||last_name as nom, cedula, email from members where replace(replace(cedula,'-',''),' ','')=$1`, [ced])
    if (!f.rowCount) { console.log(`\n${ced}: ficha NO ENCONTRADA`); continue }
    const { id, nom } = f.rows[0]
    console.log(`\n######## ${nom} (${ced}) ########`)
    const p = await c.query(`
      select pa.id, pa.amount, pa.status, pa.concept, pa.description, pa.review_status,
             pa.payment_method, pa.receipt_path is not null as recibo, pa.reference_code,
             pa.sinpe_confirmation, pa.enrollment_id, pa.study_group_id, g.name as grupo,
             pa.created_at, pa.updated_at, pa.rejection_reason, pa.scholarship_id
      from payments pa left join study_groups g on g.id=pa.study_group_id
      where pa.member_id=$1 and pa.status in ('pending','paid') order by pa.created_at`, [id])
    p.rows.forEach(x => { console.log('  --- PAGO'); for (const [k,v] of Object.entries(x)) if(v!==null&&v!==''&&v!==false) console.log(`      ${k}: ${JSON.stringify(v)}`) })
    const e = await c.query(`
      select e.id, e.status, e.enrolled_at, e.dropped_at, e.drop_reason, g.name as grupo, pl.cost
      from study_enrollments e join study_groups g on g.id=e.group_id
        left join study_plans pl on pl.id=g.plan_id
      where e.member_id=$1 and e.created_at > now() - interval '2 months' order by e.created_at desc`, [id])
    e.rows.forEach(x => console.log(`  MATRÍCULA ${x.status.padEnd(18)} ${x.grupo} (cuesta ₡${Number(x.cost ?? 0)})${x.drop_reason ? ' · '+x.drop_reason : ''}`))
  }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
