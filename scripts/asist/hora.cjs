const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select ec.checked_in_at utc,
           to_char(ec.checked_in_at at time zone 'America/Costa_Rica', 'YYYY-MM-DD HH24:MI') cr
    from event_checkins ec
    where ec.member_id='e139784e-30d9-4763-99a3-dd8e24fb22b6'
      and ec.checked_in_at > now() - interval '20 days' order by 1 desc`)
  console.log('sus check-ins recientes (texto, sin conversiones de node):')
  r.rows.forEach(x => console.log(`  UTC ${x.utc.toISOString()}  →  CR ${x.cr}`))
  const d = await c.query(`
    select to_char(checked_in_at at time zone 'America/Costa_Rica','YYYY-MM-DD') dia, count(*) n
    from event_checkins where event_id::text like '3f012644%' group by 1 order by 1 desc limit 5`)
  console.log('\ncheck-ins del evento por día CR (texto):')
  d.rows.forEach(x => console.log(`  ${x.dia}  ${x.n}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
