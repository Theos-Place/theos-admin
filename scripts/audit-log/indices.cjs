const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const i = await c.query(`select indexdef from pg_indexes where tablename='audit_log'`)
  console.log('=== índices ==='); i.rows.forEach(x=>console.log('  '+x.indexdef))
  const u = await c.query(`select indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) tam
    from pg_stat_user_indexes where relname='audit_log' order by idx_scan desc`)
  console.log('\n=== uso de cada índice ==='); u.rows.forEach(x=>console.log(`  ${x.indexrelname.padEnd(20)} ${String(x.idx_scan).padStart(8)} escaneos · ${x.tam}`))
  const e = await c.query(`explain (analyze, buffers) select old_data, new_data from audit_log
    where entity_id = (select entity_id from audit_log limit 1) order by created_at desc limit 5`)
  console.log('\n=== plan de la consulta que se usa en la app ===')
  e.rows.forEach(x=>console.log('  '+x['QUERY PLAN']))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
