const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select m.id, m.first_name||' '||m.last_name nombre, m.cedula, m.is_active,
      m.deactivation_reason, m.external_id, m.created_at::date
    from members m where m.first_name ilike 'carolina' and m.last_name ilike 'salas%'
       or (m.first_name ilike 'melissa' and m.last_name ilike 'acon%')
       or (m.first_name ilike 'mar_a jos_' and m.last_name ilike 'escribano%')
    order by 2`)
  console.table(r.rows)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
