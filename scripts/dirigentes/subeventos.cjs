const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select se.name as sub_evento, e.title as evento, count(*) n,
           min(extract(week from ec.checked_in_at at time zone 'America/Costa_Rica'))::int desde_sem,
           max(extract(week from ec.checked_in_at at time zone 'America/Costa_Rica'))::int hasta_sem
    from events e join event_checkins ec on ec.event_id=e.id
      join sub_events se on se.id=ec.sub_event_id
    where e.event_type='charla' and ec.checked_in_at is not null
      and extract(isoyear from ec.checked_in_at at time zone 'America/Costa_Rica')=2026
    group by 1,2 order by 1,2`)
  console.log('=== sub-eventos usados en 2026 ===')
  console.log('sub-evento          evento                              n     semanas')
  r.rows.forEach(x => console.log(`${String(x.sub_evento).slice(0,18).padEnd(20)}${String(x.evento).slice(0,34).padEnd(36)}${String(x.n).padStart(5)}   ${x.desde_sem}–${x.hasta_sem}`))

  const dup = await c.query(`
    select se.name, count(distinct e.title) eventos
    from events e join event_checkins ec on ec.event_id=e.id join sub_events se on se.id=ec.sub_event_id
    where e.event_type='charla' group by 1 having count(distinct e.title) > 1`)
  console.log(`\n>>> sub-eventos con el MISMO nombre en varios eventos: ${dup.rowCount}`)
  dup.rows.forEach(x => console.log(`    "${x.name}" aparece en ${x.eventos} eventos distintos`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
