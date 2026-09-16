const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const f = await c.query(`select pg_get_functiondef(oid) as def from pg_proc where proname='log_changes'`)
  console.log(f.rows[0].def)
  const fk = await c.query(`select con.conname, pg_get_constraintdef(con.oid) as def from pg_constraint con
    join pg_class cl on cl.oid=con.conrelid where cl.relname='audit_log'`)
  console.log('\n=== constraints de audit_log ===')
  fk.rows.forEach(x => console.log(`  ${x.conname}: ${x.def}`))
  const n = await c.query(`select count(*) total, count(actor_id) con_actor from audit_log`)
  console.log(`\nfilas en audit_log: ${n.rows[0].total} · con actor: ${n.rows[0].con_actor}`)
  const t = await c.query(`select count(distinct c.relname) n from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where not t.tgisinternal and t.tgfoid = (select oid from pg_proc where proname='log_changes')`)
  console.log(`tablas con el trigger de auditoría: ${t.rows[0].n}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
