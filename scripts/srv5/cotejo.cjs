/** SOLO LECTURA: areas.leader_id vs ocupantes de puestos "Encargado*" (SRV-5). */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    with enc as (
      select a.id, string_agg(distinct m.first_name||' '||m.last_name, ' | ' order by m.first_name||' '||m.last_name) por_puesto
      from areas a
      join service_positions sp on sp.area_id = a.id and lower(unaccent(sp.title)) ~ '^encargado'
      join volunteers v on v.position_id = sp.id and v.status = 'active'
      join members m on m.id = v.member_id
      where a.area_type='committee' group by a.id
    )
    select a.name comite,
           coalesce(l.first_name||' '||l.last_name, '—') leader_id,
           coalesce(enc.por_puesto, '—') por_puesto,
           case when a.leader_id is null and enc.por_puesto is null then 'sin encargado'
                when a.leader_id is null then 'solo puesto'
                when enc.por_puesto is null then 'solo leader_id'
                when enc.por_puesto like '%'||l.first_name||' '||l.last_name||'%' then 'coinciden'
                else 'DISCREPAN' end estado
    from areas a left join members l on l.id = a.leader_id left join enc on enc.id = a.id
    where a.area_type='committee' and a.is_active
    order by 4, 1`)
  console.table(r.rows)
  const resumen = await c.query(`select 1`)
  const conteo = r.rows.reduce((a,x)=>{a[x.estado]=(a[x.estado]||0)+1;return a},{})
  console.log('\nResumen:', conteo)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
