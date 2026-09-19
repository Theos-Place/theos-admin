/** SOLO LECTURA: cómo se guarda hoy el encargado de un comité (SRV-5, etapa 1). */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const q = async (t, sql) => { const r = await c.query(sql); console.log(`\n=== ${t} ===`); console.table(r.rows.slice(0, 40)); return r.rows }

  await q('areas por tipo', `select area_type, count(*) total, count(leader_id) con_leader_id,
      count(*) filter (where is_active) activas from areas group by 1 order by 1`)

  await q('comités con leader_id', `select a.name comite, m.first_name||' '||m.last_name lider, m.is_active
      from areas a join members m on m.id = a.leader_id
      where a.area_type='committee' order by a.name`)

  await q('puestos "Encargado*" en comités (dan lider_comite hoy)', `
      select a.name comite, sp.title puesto, count(v.id) filter (where v.status='active') ocupantes
      from service_positions sp join areas a on a.id = sp.area_id
      left join volunteers v on v.position_id = sp.id
      where a.area_type='committee' and lower(unaccent(sp.title)) ~ '^encargado'
      group by 1,2 order by 1,2`)

  await q('rol lider_comite por origen', `select origen, count(*) from member_roles
      where role='lider_comite' and is_active group by 1`)

  await q('quiénes tienen lider_comite', `select m.first_name||' '||m.last_name persona, r.origen,
      string_agg(distinct a.name, ', ') comites_por_puesto
      from member_roles r join members m on m.id = r.member_id
      left join member_role_position_grants g on g.member_id = r.member_id and g.role = r.role
      left join service_positions sp on sp.id = g.position_id
      left join areas a on a.id = sp.area_id
      where r.role='lider_comite' and r.is_active group by 1,2 order by 1`)

  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
