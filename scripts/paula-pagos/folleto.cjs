/** SOLO LECTURA: ¿hay una solicitud de folleto real detrás del cobro pendiente? */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const P='736684e1-7c94-4ff4-a3bf-7a7f22e31e2e', ENR='b214049f-eba2-4dc1-a652-f114c92857a5'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const t = await c.query(`select table_name from information_schema.tables where table_schema='public' and table_name like '%folleto%'`)
  console.log('tablas de folletos: ' + t.rows.map(r=>r.table_name).join(', '))
  for (const tb of t.rows.map(r=>r.table_name)) {
    const cc = await c.query(`select column_name from information_schema.columns where table_name=$1 and table_schema='public' order by ordinal_position`,[tb])
    const cols = cc.rows.map(r=>r.column_name)
    if (cols.includes('member_id')) {
      const r = await c.query(`select * from ${tb} where member_id=$1 order by created_at desc limit 5`,[P])
      console.log(`\n=== ${tb} de Paula (${r.rowCount}) ===`)
      r.rows.forEach(x => { console.log('---'); for (const [k,v] of Object.entries(x)) if(v!==null&&v!=='') console.log(`  ${k}: ${JSON.stringify(v)}`) })
    }
  }
  const a = await c.query(`
    select action, entity_type, entity_id, old_data, new_data, created_at from audit_log
    where entity_id::text in ('74bf41ed-069b-44bc-9109-abd1ee5bb781','6025c32c-31f6-497a-a0c8-fc84c22d3c28','${ENR}')
    order by created_at`)
  console.log(`\n=== AUDITORÍA (${a.rowCount}) ===`)
  a.rows.forEach(x => console.log(`${x.created_at.toISOString()} ${x.action} ${x.entity_type} ${x.entity_id}\n   new: ${JSON.stringify(x.new_data)}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
