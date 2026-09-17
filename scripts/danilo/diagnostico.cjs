/** SOLO LECTURA: la matrícula de prueba de Danilo Mata en el Nivel 4 de Floriana. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const f = await c.query(`
    select id, first_name||' '||last_name nom, cedula, email, is_active
    from members where unaccent(lower(first_name||' '||last_name)) like '%danilo%mata%'`)
  console.log(`=== fichas "Danilo Mata" (${f.rowCount}) ===`)
  f.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  if (!f.rowCount) { await c.end(); return }
  const ids = f.rows.map(x => x.id)

  const g = await c.query(`
    select g.id, g.name, g.status, pl.name plan
    from study_groups g left join study_plans pl on pl.id=g.plan_id
    where unaccent(lower(g.name)) like '%floriana%' order by g.starts_at desc`)
  console.log(`\n=== grupos de Floriana (${g.rowCount}) ===`)
  g.rows.forEach(x => console.log(`  ${x.name}  [${x.plan}] ${x.status}  ${x.id}`))

  const e = await c.query(`
    select e.id, e.member_id, e.status, e.enrolled_at, e.created_at, e.plan_id,
           gr.name grupo, gr.id group_id
    from study_enrollments e join study_groups gr on gr.id=e.group_id
    where e.member_id = any($1) order by e.created_at desc limit 8`, [ids])
  console.log(`\n=== matrículas de Danilo (${e.rowCount}) ===`)
  e.rows.forEach(x => { console.log('  ---'); for (const [k,v] of Object.entries(x)) if(v!==null) console.log(`    ${k}: ${JSON.stringify(v)}`) })

  const p = await c.query(`
    select pa.id, pa.amount, pa.status, pa.concept, pa.description, pa.payment_method,
           pa.review_status, pa.enrollment_id, pa.study_group_id, pa.receipt_path,
           pa.created_at, pa.scholarship_id, gr.name grupo
    from payments pa left join study_groups gr on gr.id=pa.study_group_id
    where pa.member_id = any($1) order by pa.created_at desc`, [ids])
  console.log(`\n=== pagos de Danilo (${p.rowCount}) ===`)
  p.rows.forEach(x => { console.log('  ---'); for (const [k,v] of Object.entries(x)) if(v!==null&&v!=='') console.log(`    ${k}: ${JSON.stringify(v)}`) })
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
