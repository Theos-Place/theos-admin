const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const cc = await c.query(`select column_name from information_schema.columns where table_name='message_broadcasts' and table_schema='public' order by ordinal_position`)
  const cols = cc.rows.map(r=>r.column_name)
  console.log('columnas: ' + cols.join(', '))
  if (cols.includes('scheduled_at')) {
    const s = await c.query(`select count(*) total, count(*) filter (where scheduled_at is not null) programados,
      count(*) filter (where scheduled_at > now()) pendientes from message_broadcasts`)
    console.log('\nbroadcasts: ' + JSON.stringify(s.rows[0]))
    const u = await c.query(`select status, count(*) n, max(created_at) ultimo from message_broadcasts
      where scheduled_at is not null group by 1`)
    console.log('programados por estado:'); u.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  }
  const q = await c.query(`select count(*) n from message_queue where status='pending'`).catch(()=>({rows:[{n:'(sin tabla)'}]}))
  console.log('\ncorreos en cola pendientes: ' + q.rows[0].n)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
