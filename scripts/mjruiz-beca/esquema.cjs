const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const fk = await c.query(`
    select con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con join pg_class cl on cl.oid=con.conrelid
    where cl.relname='scholarships' order by con.contype desc`)
  fk.rows.forEach(r => console.log(`${r.conname}: ${r.def}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
