/** SOLO LECTURA: cómo se armó el N3 y qué pasó en el cierre del N2. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const N3 = 'ca5ea95b-ac49-46ec-a631-f2d1632d6cae'
;(async () => {
  const c = nuevoCliente(); await c.connect()

  // El N2 de la misma dirigente, que cerró el 11-set.
  const n2 = await c.query(`select id, name, status, closed_at, closed_by from study_groups
    where name like 'Nivel 2. Daniella%'`)
  console.log('=== GRUPO N2 origen ===\n' + JSON.stringify(n2.rows[0]))
  const gid = n2.rows[0].id
  const e = await c.query(`
    select m.first_name||' '||m.last_name as persona, e.status, e.grade, e.notes, e.completed_at
    from study_enrollments e join members m on m.id=e.member_id where e.group_id=$1 order by m.first_name`,[gid])
  console.log(`\n=== cómo cerró cada quien en el N2 (${e.rowCount}) ===`)
  e.rows.forEach(x => console.log(`  ${x.persona.padEnd(32)} ${String(x.status).padEnd(12)} nota=${x.grade ?? '—'}  ${x.notes ?? ''}`))

  // ¿Quién de esos está en el N3?
  const n3 = await c.query(`
    select m.id, m.first_name||' '||m.last_name as persona, e.status, e.created_at, e.enrolled_at
    from study_enrollments e join members m on m.id=e.member_id where e.group_id=$1 order by e.created_at`,[N3])
  console.log(`\n=== quiénes están en el N3 y cuándo entraron (${n3.rowCount}) ===`)
  n3.rows.forEach(x => console.log(`  ${x.persona.padEnd(32)} ${String(x.status).padEnd(12)} creada ${x.created_at.toISOString()}`))

  // Auditoría del armado del N3.
  const ids = n3.rows.map(x=>x.id)
  const a = await c.query(`
    select action, entity_type, entity_id, new_data, created_at from audit_log
    where created_at > '2026-09-10' and entity_type in ('study_enrollments','payments')
      and (new_data->>'group_id' = $1 or new_data->>'study_group_id' = $1)
    order by created_at`,[N3])
  console.log(`\n=== auditoría del armado del N3 (${a.rowCount}) ===`)
  a.rows.forEach(x => {
    const d = x.new_data || {}
    console.log(`  ${x.created_at.toISOString()} ${x.action.padEnd(6)} ${x.entity_type.padEnd(18)} ` +
      (x.entity_type==='payments' ? `₡${d.amount} ${d.status}` : `${d.status} member=${String(d.member_id).slice(0,8)} recorded_by=${d.recorded_by ?? '—'}`))
  })
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
