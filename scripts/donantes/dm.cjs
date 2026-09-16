const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const f = await c.query(`select pg_get_functiondef(oid) as def from pg_proc where proname='get_dm_flags'`)
  const def = f.rows[0].def
  const i = def.indexOf('dona')
  console.log(def.split('\n').filter(l => /dona|donation/i.test(l)).join('\n'))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
