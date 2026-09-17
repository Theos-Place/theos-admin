const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const F = 'e139784e-30d9-4763-99a3-dd8e24fb22b6'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select ec.id, e.id as event_id, e.title, e.event_type, e.is_recurring,
           (ec.checked_in_at at time zone 'America/Costa_Rica') hora_cr,
           ec.sub_event_id, ec.method, ec.checked_in_as, se.name sub
    from event_checkins ec join events e on e.id=ec.event_id
      left join sub_events se on se.id=ec.sub_event_id
    where ec.member_id=$1 and ec.checked_in_at > now() - interval '45 days'
    order by ec.checked_in_at desc`, [F])
  console.log(`=== check-ins de Floriana, últimos 45 días (${r.rowCount}) ===`)
  r.rows.forEach(x => console.log(`  ${x.hora_cr.toISOString().slice(0,16).replace('T',' ')}  ${String(x.title).padEnd(24)} ${String(x.sub ?? '').padEnd(8)} ${x.method ?? ''}  evento=${x.event_id.slice(0,8)}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
