/** EVE-12 · Etapa 1, punto 1: ¿se distingue un rol manual de uno por puesto? */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const cc = await c.query(`select column_name, data_type from information_schema.columns
    where table_name='member_roles' and table_schema='public' order by ordinal_position`)
  console.log('member_roles: ' + cc.rows.map(r=>`${r.column_name}`).join(', '))
  const s = await c.query(`select * from member_roles limit 2`)
  console.log('\nejemplo:'); s.rows.forEach(x => console.log('  ' + JSON.stringify(x)))
  const r = await c.query(`select role, count(*) n, count(*) filter (where is_active) activos
    from member_roles group by 1 order by 2 desc`)
  console.log('\nroles en uso:'); r.rows.forEach(x => console.log(`  ${String(x.role).padEnd(26)} ${x.n} (${x.activos} activos)`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
