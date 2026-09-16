const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select * from study_requests where member_id='736684e1-7c94-4ff4-a3bf-7a7f22e31e2e' order by created_at desc limit 3`)
  console.log(`solicitudes: ${r.rowCount}`)
  r.rows.forEach(x => { console.log('---'); for (const [k,v] of Object.entries(x)) if(v!==null&&v!=='') console.log(`  ${k}: ${JSON.stringify(v)}`) })
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
