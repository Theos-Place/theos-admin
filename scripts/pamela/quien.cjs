/** SOLO LECTURA: quién y cuándo movió a Pamela Fonseca de grupo en SCJ. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const P = '113130107'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const f = await c.query(`select id, first_name||' '||last_name as nom from members where replace(replace(cedula,'-',''),' ','')=$1`,[P])
  const id = f.rows[0].id
  console.log(`${f.rows[0].nom} · ${id}\n`)

  const e = await c.query(`
    select e.id, e.status, e.enrolled_at, e.created_at, e.updated_at, e.transferred_to, e.recorded_by,
           g.name as grupo, r.first_name||' '||r.last_name as registrado_por
    from study_enrollments e join study_groups g on g.id=e.group_id
      left join members r on r.id = e.recorded_by
    where e.member_id=$1 and g.name like 'SCJ%' order by e.created_at`,[id])
  console.log('=== MATRÍCULAS EN SCJ ===')
  e.rows.forEach(x => console.log(`  ${x.grupo.padEnd(18)} ${String(x.status).padEnd(12)} creada ${x.created_at.toISOString()} · actualizada ${x.updated_at.toISOString()} · recorded_by=${x.registrado_por ?? x.recorded_by ?? '—'}`))

  const p = await c.query(`
    select pa.id, pa.amount, pa.status, pa.transfer_note, pa.created_at, pa.updated_at, g.name as grupo
    from payments pa left join study_groups g on g.id=pa.study_group_id
    where pa.member_id=$1 order by pa.created_at`,[id])
  console.log('\n=== NOTA DE TRASLADO (la escribe transferEnrollment con el nombre de quien lo hizo) ===')
  p.rows.forEach(x => console.log(`  ₡${Number(x.amount)} ${x.status} · ${x.grupo}\n    ${x.transfer_note ?? 'sin nota'}`))

  console.log('\n=== AUDITORÍA de esas matrículas y pagos ===')
  const ids = [...e.rows.map(x=>x.id), ...p.rows.map(x=>x.id)]
  const a = await c.query(`select actor_id, action, entity_type, entity_id, old_data, new_data, created_at, ip_address
    from audit_log where entity_id::text = any($1) order by created_at`,[ids])
  for (const x of a.rows) {
    let quien = '—'
    if (x.actor_id) {
      const m = await c.query(`select first_name||' '||last_name as n from members where auth_user_id=$1 or id=$1`,[x.actor_id])
      quien = m.rows[0]?.n ?? x.actor_id
    }
    console.log(`  ${x.created_at.toISOString()} ${x.action.padEnd(6)} ${x.entity_type.padEnd(18)} actor=${quien}`)
  }

  console.log('\n=== ¿hubo una solicitud de reubicación? ===')
  const s = await c.query(`select id, request_type, status, reason, review_notes, reviewed_by, reviewed_at, created_at,
    resolved_group_id from study_requests where member_id=$1 order by created_at desc`,[id])
  for (const x of s.rows) {
    const r = await c.query(`select first_name||' '||last_name as n from members where auth_user_id=$1 or id=$1`,[x.reviewed_by])
    console.log(`  ${x.request_type} ${x.status} · creada ${x.created_at.toISOString()} · resuelta ${x.reviewed_at ? x.reviewed_at.toISOString() : '—'} por ${r.rows[0]?.n ?? x.reviewed_by ?? '—'}`)
    console.log(`    motivo: ${x.reason}`)
    if (x.review_notes) console.log(`    notas: ${x.review_notes}`)
  }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
