/** SOLO LECTURA: por qué los youth no salen separados en ciertas semanas. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select extract(week from ec.checked_in_at at time zone 'America/Costa_Rica')::int wk,
           e.title as evento,
           se.name as sub_evento,
           (ec.sub_event_id is null) as sin_sub,
           count(*) n
    from events e join event_checkins ec on ec.event_id=e.id
      left join sub_events se on se.id=ec.sub_event_id
    where e.event_type='charla' and ec.checked_in_at is not null
      and extract(isoyear from ec.checked_in_at at time zone 'America/Costa_Rica')=2026
      and extract(week from ec.checked_in_at at time zone 'America/Costa_Rica') in (35,36,37,38)
      and (unaccent(lower(e.title)) like '%youth%' or unaccent(lower(coalesce(se.name,''))) like '%youth%'
        or unaccent(lower(e.title)) like '%cartago%' or unaccent(lower(coalesce(se.name,''))) like '%cartago%')
    group by 1,2,3,4 order by 1,2,3`)
  console.log('sem  evento                              sub-evento                  sin_sub    n')
  r.rows.forEach(x => console.log(`${String(x.wk).padStart(3)}  ${String(x.evento).slice(0,34).padEnd(36)} ${String(x.sub_evento ?? '—').slice(0,26).padEnd(27)} ${x.sin_sub ? 'SÍ ' : '   '}  ${String(x.n).padStart(4)}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
