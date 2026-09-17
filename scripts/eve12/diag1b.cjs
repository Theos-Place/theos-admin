const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const o = await c.query(`select origen, count(*) n from member_roles group by 1 order by 2 desc`)
  console.log('valores de `origen`:'); o.rows.forEach(x => console.log(`  ${x.origen}: ${x.n}`))
  const e = await c.query(`select origen, is_active, count(*) n from member_roles where role='encargado_eventos' group by 1,2 order by 1,2`)
  console.log('\nencargado_eventos por origen:'); e.rows.forEach(x => console.log(`  ${String(x.origen).padEnd(10)} activo=${x.is_active}  ${x.n}`))
  const ck = await c.query(`select pg_get_constraintdef(con.oid) d from pg_constraint con join pg_class cl on cl.oid=con.conrelid
    where cl.relname='member_roles' and con.contype='c'`)
  console.log('\nchecks:'); ck.rows.forEach(x => console.log('  ' + x.d))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
