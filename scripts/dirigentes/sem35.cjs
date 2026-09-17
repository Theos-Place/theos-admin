const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select e.title evento, se.name sub, count(*) n,
           min(ec.checked_in_at at time zone 'America/Costa_Rica')::date dia
    from events e join event_checkins ec on ec.event_id=e.id
      left join sub_events se on se.id=ec.sub_event_id
    where e.event_type='charla' and ec.checked_in_at is not null
      and extract(isoyear from ec.checked_in_at at time zone 'America/Costa_Rica')=2026
      and extract(week from ec.checked_in_at at time zone 'America/Costa_Rica')=35
    group by 1,2 order by 3 desc`)
  console.log('=== TODO lo de la semana 35 (24–30 ago) ===')
  r.rows.forEach(x => console.log(`  ${String(x.evento).padEnd(34)} ${String(x.sub ?? '—').padEnd(10)} ${String(x.n).padStart(4)}  ${x.dia.toISOString().slice(0,10)}`))
  const ev = await c.query(`
    select e.title, count(*) n, min(ec.checked_in_at at time zone 'America/Costa_Rica')::date desde,
           max(ec.checked_in_at at time zone 'America/Costa_Rica')::date hasta
    from events e join event_checkins ec on ec.event_id=e.id
    where e.event_type='charla' and unaccent(lower(e.title)) like '%cartago%youth%'
    group by 1`)
  console.log('\n=== historia del evento "Cartago Youth" ===')
  ev.rows.forEach(x => console.log(`  ${x.title}: ${x.n} check-ins, del ${x.desde.toISOString().slice(0,10)} al ${x.hasta.toISOString().slice(0,10)}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
