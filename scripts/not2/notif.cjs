const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const cc = await c.query(`select column_name, data_type from information_schema.columns where table_name='internal_notifications' and table_schema='public' order by ordinal_position`)
  console.log('columnas: ' + cc.rows.map(r=>`${r.column_name}`).join(', '))
  const t = await c.query(`select type, count(*) n from internal_notifications group by 1 order by 2 desc limit 10`)
  console.log('\ntipos en uso:'); t.rows.forEach(x => console.log(`  ${x.type}: ${x.n}`))
  const s = await c.query(`select * from internal_notifications order by created_at desc limit 1`)
  console.log('\nejemplo:'); if (s.rowCount) { for (const [k,v] of Object.entries(s.rows[0])) console.log(`  ${k}: ${JSON.stringify(v)}`) }
  const ch = await c.query(`select con.conname, pg_get_constraintdef(con.oid) d from pg_constraint con
    join pg_class cl on cl.oid=con.conrelid where cl.relname='internal_notifications' and con.contype='c'`)
  console.log('\nchecks:'); ch.rows.forEach(x => console.log(`  ${x.d}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
