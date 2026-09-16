const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`select con.conname, pg_get_constraintdef(con.oid) as def from pg_constraint con
    join pg_class cl on cl.oid=con.conrelid where cl.relname='payments' and con.contype='c'`)
  r.rows.forEach(x => console.log(`  ${x.conname}: ${x.def}`))
  const m = await c.query(`select payment_method, count(*) from payments group by 1 order by 2 desc`)
  console.log('\nmétodos en uso: ' + m.rows.map(x=>`${x.payment_method}(${x.count})`).join(', '))
  const n = await c.query(`select distinct notes from study_enrollments where notes is not null and notes like 'aprobado%' limit 5`)
  console.log('\nnotes de aprobados: ' + n.rows.map(x=>JSON.stringify(x.notes)).join(' | '))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
