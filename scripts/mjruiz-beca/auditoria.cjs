const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select id, actor_id, action, entity_type, entity_id, old_data, new_data, created_at
    from audit_log
    where created_at > now() - interval '5 hours'
      and (entity_id::text like '0099e13a%' or entity_id::text like '11abab86%'
           or entity_id::text like 'ef96537e%' or entity_type ilike '%scholar%')
    order by created_at`)
  console.log(`cambios recientes: ${r.rowCount}`)
  r.rows.forEach(x => console.log(JSON.stringify(x)))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
