const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select a.name comite, sp.id, sp.title, sp.quantity, sp.max_volunteers, sp.is_active,
      (select count(*) from volunteers v where v.position_id=sp.id and v.status='active') ocupados
    from service_positions sp join areas a on a.id=sp.area_id
    where a.name in ('Comité Ayuda Social','Comité Contabilidad','Sede Madrid Home')
    order by 1, 3`)
  console.table(r.rows)
  const g = await c.query(`select pg_get_functiondef(oid) d from pg_proc where proname='grant_position_role'`)
  console.log(g.rows[0].d)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
