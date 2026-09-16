const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const t = await c.query(`select table_name from information_schema.tables where table_schema='public' and (table_name like '%scholar%' or table_name like '%beca%') order by 1`)
  console.log('tablas: ' + t.rows.map(r=>r.table_name).join(', '))
  for (const tb of t.rows.map(r=>r.table_name)) {
    const cc = await c.query(`select column_name from information_schema.columns where table_name=$1 and table_schema='public' order by ordinal_position`, [tb])
    console.log(`\n=== ${tb} ===\n` + cc.rows.map(r=>r.column_name).join(', '))
  }
  const st = await c.query(`select status, count(*) from scholarships group by 1 order by 2 desc`)
  console.log('\nestados en scholarships: ' + st.rows.map(x=>`${x.status}(${x.count})`).join(', '))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
