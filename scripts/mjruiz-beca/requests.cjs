const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select * from finance_requests where id = any($1) order by created_at`,
    [['ddd517e9-256b-44b6-a94f-e45abe4404d3','c6a88154-a7d0-479e-99ce-7da4831262c5']])
  r.rows.forEach(x => { console.log('---'); for (const [k,v] of Object.entries(x)) if (v !== null && v !== '') console.log(`  ${k}: ${JSON.stringify(v)}`) })
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
