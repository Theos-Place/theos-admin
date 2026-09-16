const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const cc = await c.query(`select column_name from information_schema.columns where table_name='donations' and table_schema='public' order by ordinal_position`)
  console.log('columnas: ' + cc.rows.map(r=>r.column_name).join(', '))

  const d = await c.query(`select donation_date, count(*) n, count(distinct member_id) p,
    min(amount) min_monto, max(amount) max_monto, count(distinct import_batch_id) lotes
    from donations group by 1 order by 1 desc limit 10`)
  console.log('\n=== por fecha exacta (últimas 10) ===')
  d.rows.forEach(x => console.log(`  ${x.donation_date.toISOString().slice(0,10)}  ${String(x.n).padStart(5)} filas · ${String(x.p).padStart(4)} personas · montos ${Number(x.min_monto)}–${Number(x.max_monto)} · ${x.lotes} lote(s)`))

  const s = await c.query(`select * from donations order by donation_date desc limit 2`)
  console.log('\n=== dos filas de ejemplo ===')
  s.rows.forEach(x => { console.log('  ---'); for (const [k,v] of Object.entries(x)) if(v!==null&&v!=='') console.log(`    ${k}: ${JSON.stringify(v)}`) })

  try {
    const b = await c.query(`select id, source, status, total_rows, created_at, notes from import_batches order by created_at desc limit 6`)
    console.log('\n=== lotes de importación ===')
    b.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  } catch (e) { console.log('\nimport_batches: ' + e.message) }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
