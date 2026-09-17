const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  for (const t of ['service_positions','volunteers']) {
    const r = await c.query(`select column_name from information_schema.columns where table_name=$1 and table_schema='public' order by ordinal_position`,[t])
    console.log(`${t}: ` + r.rows.map(x=>x.column_name).join(', '))
  }
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
