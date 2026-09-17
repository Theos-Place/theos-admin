const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const cc = await c.query(`select column_name, is_nullable, column_default, data_type
    from information_schema.columns where table_name='areas' and table_schema='public' order by ordinal_position`)
  console.log('areas:'); cc.rows.forEach(x => console.log(`  ${x.column_name.padEnd(18)} ${x.data_type.padEnd(26)} null=${x.is_nullable} def=${x.column_default ?? '—'}`))
  const s = await c.query(`select * from areas where name='Sede Cartago'`)
  console.log('\nejemplo (Sede Cartago):'); for (const [k,v] of Object.entries(s.rows[0])) console.log(`  ${k}: ${JSON.stringify(v)}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
