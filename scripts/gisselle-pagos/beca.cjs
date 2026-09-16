/** SOLO LECTURA: la beca de Gisselle y el historial del traslado. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const G='15389eb8-2398-4fbc-9468-ac1ca9a5386b'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const b = await c.query(`
    select s.id, s.status, s.kind, s.discount_type, s.discount_value, s.original_amount,
           s.final_amount, s.approval_type, s.entity_type, s.plan_id, pl.name as plan_beca,
           s.used_at, s.created_at, s.approved_at, s.request_id, s.notes
    from scholarships s left join study_plans pl on pl.id=s.plan_id
    where s.member_id=$1 order by s.created_at`, [G])
  console.log(`=== BECAS (${b.rowCount}) ===`)
  b.rows.forEach(x => console.log(JSON.stringify(x)))

  const fr = await c.query(`select id, request_type, reason, status, plan_id, created_at, reviewed_at from finance_requests where member_id=$1 order by created_at`,[G])
  console.log(`\n=== SOLICITUDES (${fr.rowCount}) ===`)
  fr.rows.forEach(x => { console.log('---'); for (const [k,v] of Object.entries(x)) if(v!==null&&v!=='') console.log(`  ${k}: ${JSON.stringify(v)}`) })

  const pl = await c.query(`select id, name, cost, currency from study_plans where id = any($1)`,
    [['ff8b6e29-4bc4-4cc5-9dcb-b14a581047b4','695122cb-9365-4941-ae7e-5dbf56450484']])
  console.log('\n=== PLANES involucrados ===')
  pl.rows.forEach(x => console.log(JSON.stringify(x)))

  const a = await c.query(`
    select action, entity_type, entity_id, old_data, new_data, created_at from audit_log
    where entity_id::text in ('4ab61d83-79d1-43f3-8d3d-362d91a938c5','1c66625a-ef7e-45fd-88f4-266a7d8c02d5',
      '5ae5c373-5252-44d5-991e-bc925b2bbd28','9dfe1724-78fc-441a-b721-881a0f05d2ef','1a0ba6f2-47f1-4f1f-bf00-15e022901cf8')
    order by created_at`)
  console.log(`\n=== AUDITORÍA (${a.rowCount}) ===`)
  a.rows.forEach(x => console.log(`${x.created_at.toISOString()} ${x.action} ${x.entity_type} ${x.entity_id}\n   old: ${JSON.stringify(x.old_data)}\n   new: ${JSON.stringify(x.new_data)}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
