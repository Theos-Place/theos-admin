const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select con.conname, pg_get_constraintdef(con.oid) d from pg_constraint con
    join pg_class cl on cl.oid=con.conrelid where cl.relname='volunteers' and con.contype='f'`)
  r.rows.forEach(x => console.log(`  ${x.d}`))
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
