const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select id, title, event_type, is_recurring, recurrence_rule,
    (starts_at at time zone 'America/Costa_Rica') inicio_cr, (ends_at at time zone 'America/Costa_Rica') fin_cr
    from events where id in ('3f012644-0000-0000-0000-000000000000') or id::text like '3f012644%'`)
  r.rows.forEach(x => { for (const [k,v] of Object.entries(x)) console.log(`  ${k}: ${JSON.stringify(v)}`) })
  const n = await c.query(`select count(*) n, count(distinct (checked_in_at at time zone 'America/Costa_Rica')::date) dias
    from event_checkins where event_id::text like '3f012644%'`)
  console.log('\ncheck-ins de ese evento: ' + JSON.stringify(n.rows[0]))
  const d = await c.query(`select (checked_in_at at time zone 'America/Costa_Rica')::date dia, count(*) n
    from event_checkins where event_id::text like '3f012644%' group by 1 order by 1 desc limit 8`)
  console.log('por día (hora CR):'); d.rows.forEach(x => console.log(`  ${x.dia.toISOString().slice(0,10)}  ${x.n}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
