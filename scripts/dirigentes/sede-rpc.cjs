const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select pg_get_functiondef(oid) d from pg_proc where proname='report_charla_attendance'`)
  console.log(r.rows[0].d)
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
