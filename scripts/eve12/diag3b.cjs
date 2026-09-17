const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const t = await c.query(`
    select e.event_type,
           count(*) n,
           count(*) filter (where exists (select 1 from event_organizing_committees o where o.event_id=e.id)) con_comite
    from events e where e.starts_at > now() - interval '3 months' group by 1 order by 2 desc`)
  console.log('=== por tipo de evento (últimos 3 meses + futuros) ===')
  t.rows.forEach(x => console.log(`  ${String(x.event_type).padEnd(16)} ${String(x.n).padStart(4)} eventos · ${x.con_comite} con comité`))

  // ¿Quién tiene el rol automático y de qué comités?
  const r = await c.query(`
    select ar.name comite, count(distinct v.member_id) personas
    from member_roles mr
      join volunteers v on v.member_id = mr.member_id and v.status='active'
      join service_positions sp on sp.id = v.position_id
      join areas ar on ar.id = sp.area_id
    where mr.role='encargado_eventos' and mr.is_active and mr.origen='automatico'
    group by 1 order by 2 desc limit 12`)
  console.log(`\n=== comités de los 184 encargados automáticos (top 12) ===`)
  r.rows.forEach(x => console.log(`  ${String(x.comite).padEnd(34)} ${x.personas}`))

  const sin = await c.query(`
    select count(*) n from member_roles mr where mr.role='encargado_eventos' and mr.is_active and mr.origen='automatico'
      and not exists (select 1 from volunteers v join service_positions sp on sp.id=v.position_id
                      where v.member_id=mr.member_id and v.status='active')`)
  console.log(`\nautomáticos SIN ningún puesto activo (perderían todo): ${sin.rows[0].n}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
