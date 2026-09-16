/** SOLO LECTURA: TODOS los cobros de diferencia que existieron, incluidos los borrados. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select entity_id, action, created_at,
           coalesce(new_data->>'description', old_data->>'description') as descripcion,
           coalesce(new_data->>'amount', old_data->>'amount') as monto,
           coalesce(new_data->>'member_id', old_data->>'member_id') as member_id
    from audit_log
    where entity_type='payments'
      and (new_data->>'description' like 'Diferencia por cambio de grupo%'
        or old_data->>'description' like 'Diferencia por cambio de grupo%')
    order by created_at`)
  console.log(`eventos de auditoría sobre cobros de diferencia: ${r.rowCount}`)
  r.rows.forEach(x => console.log(`  ${x.created_at.toISOString()} ${x.action} ₡${x.monto} · ${x.descripcion} · member ${x.member_id}`))

  // Y cuántas transferencias hubo en total, para saber el tamaño real del riesgo.
  const t = await c.query(`select count(*) n from study_enrollments where status='transferred'`)
  console.log(`\nmatrículas transferidas en total: ${t.rows[0].n}`)
  const tb = await c.query(`
    select count(*) n from study_enrollments e
    where e.status='transferred'
      and exists (select 1 from payments p where p.enrollment_id=e.transferred_to::uuid and p.scholarship_id is not null)`)
  console.log(`(consulta aproximada de las que involucran beca: ${tb.rows[0].n})`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
