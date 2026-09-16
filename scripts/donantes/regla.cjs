const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const f = await c.query(`
    select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and p.pronargs >= 0
      and pg_get_functiondef(p.oid) ilike '%is_donor%'`)
  console.log(`=== funciones que tocan is_donor (${f.rowCount}) ===`)
  f.rows.forEach(x => console.log(`\n----- ${x.proname} -----\n${x.def}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
