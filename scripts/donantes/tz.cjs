const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select current_setting('TimeZone') tz, current_date fecha, now() ahora,
    (date_trunc('month', current_date) - interval '5 months')::date ventana`)
  console.log(JSON.stringify(r.rows[0]))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
