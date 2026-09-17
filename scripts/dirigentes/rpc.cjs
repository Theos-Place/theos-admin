const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select pg_get_functiondef(oid) as d from pg_proc where proname='approve_applications'`)
  const d = r.rows[0]?.d ?? ''
  console.log(d.split('\n').filter(l => /volunteer/i.test(l)).join('\n') || '(no toca volunteers)')
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
