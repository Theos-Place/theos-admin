const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  try {
    const r = await c.query(`
      select round(mean_exec_time) ms_prom, calls, round(total_exec_time/1000) seg_total,
             left(regexp_replace(query, '\\s+', ' ', 'g'), 100) q
      from pg_stat_statements
      where calls > 3
      order by total_exec_time desc limit 12`)
    console.log('=== por tiempo TOTAL acumulado ===')
    r.rows.forEach(x => console.log(`  ${String(x.seg_total).padStart(6)}s tot · ${String(x.ms_prom).padStart(6)}ms prom · ${String(x.calls).padStart(7)} llamadas · ${x.q}`))
    const m = await c.query(`
      select round(mean_exec_time) ms_prom, calls, left(regexp_replace(query, '\\s+', ' ', 'g'), 100) q
      from pg_stat_statements where calls > 3 order by mean_exec_time desc limit 8`)
    console.log('\n=== las más lentas por llamada ===')
    m.rows.forEach(x => console.log(`  ${String(x.ms_prom).padStart(7)}ms · ${String(x.calls).padStart(6)} llamadas · ${x.q}`))
  } catch (e) { console.log('pg_stat_statements: ' + e.message) }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
