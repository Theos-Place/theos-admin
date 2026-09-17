const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const COMITE = `
  select distinct v.member_id from volunteers v
  join service_positions sp on sp.id=v.position_id join areas ar on ar.id=sp.area_id
  where ar.name='Comité Dirigentes' and v.status='active'
    and unaccent(lower(sp.title)) like 'dirigente%'`
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select m.first_name||' '||m.last_name nom, g.name grupo, g.status,
           case when g.leader_id=m.id then 'dirigente' else 'co-dirigente' end rol
    from study_leaders sl join members m on m.id=sl.member_id
      join study_groups g on (g.leader_id=m.id or g.co_leader_id=m.id)
    where sl.is_active and m.id not in (${COMITE})
      and g.status in ('en_curso','en_matricula','programado')
    order by 1`)
  console.log(`de los 10 a desactivar, con grupo vivo: ${r.rowCount}`)
  r.rows.forEach(x => console.log(`  ${x.nom.padEnd(28)} ${x.rol.padEnd(13)} ${x.grupo} (${x.status})`))
  if (!r.rowCount) console.log('  ninguno dirige un grupo abierto o en curso')
  // Y al revés: de los 70 a activar, ¿alguno está marcado "no recomendado" o en revisión?
  const g = await c.query(`
    select m.first_name||' '||m.last_name nom, sl.availability_status,
           mad.not_recommended_to_lead_studies no_recomendado
    from (${COMITE}) x join members m on m.id=x.member_id
      left join study_leaders sl on sl.member_id=m.id
      left join member_admin_data mad on mad.member_id=m.id
    where (sl.member_id is null or sl.is_active is not true)
      and (mad.not_recommended_to_lead_studies or sl.availability_status in ('en_revision','en_pausa'))
    order by 1`)
  console.log(`\nde los 70 a activar, con bandera que normalmente lo impide: ${g.rowCount}`)
  g.rows.forEach(x => console.log(`  ${x.nom.padEnd(28)} ${x.no_recomendado ? 'NO RECOMENDADO' : x.availability_status}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
