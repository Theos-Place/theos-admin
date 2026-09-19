const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select a.name comite, m.first_name||' '||m.last_name persona, count(*) puestos,
           string_agg(sp.title, ' | ' order by sp.title) titulos
    from volunteers v
    join service_positions sp on sp.id = v.position_id and sp.is_active
    join areas a on a.id = sp.area_id and a.area_type='committee'
    join members m on m.id = v.member_id
    where v.status='active'
    group by a.id, a.name, m.id, m.first_name, m.last_name
    having count(*) > 1 order by 3 desc, 1 limit 25`)
  console.log(`personas con más de un puesto activo en el MISMO comité: ${r.rowCount}`)
  console.table(r.rows)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
