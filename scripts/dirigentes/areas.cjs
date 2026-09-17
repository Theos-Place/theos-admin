const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select id, name, area_type, is_active, parent_id from areas
    where unaccent(lower(name)) like '%dirigent%' order by name`)
  console.log(`=== áreas/comités con "dirigent" (${r.rowCount}) ===`)
  r.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  const t = await c.query(`select area_type, count(*) n from areas group by 1`)
  console.log('\ntipos de área: ' + t.rows.map(x=>`${x.area_type}=${x.n}`).join(', '))
  const c2 = await c.query(`select id, name, is_active from areas where area_type='committee' order by name`)
  console.log(`\n=== todos los comités (${c2.rowCount}) ===`)
  c2.rows.forEach(x => console.log(`  ${x.name}${x.is_active ? '' : '  (inactivo)'}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
