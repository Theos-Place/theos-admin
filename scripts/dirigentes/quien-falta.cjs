const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const COMITE = `select distinct v.member_id from volunteers v
  join service_positions sp on sp.id=v.position_id join areas ar on ar.id=sp.area_id
  where ar.name='Comité Dirigentes' and v.status='active' and unaccent(lower(sp.title)) like 'dirigente%'`
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select m.first_name||' '||m.last_name nom, sl.availability_status, sl.is_active,
           mad.not_recommended_to_lead_studies no_rec
    from (${COMITE}) x join members m on m.id=x.member_id
      left join study_leaders sl on sl.member_id=m.id
      left join member_admin_data mad on mad.member_id=m.id
    where coalesce(sl.availability_status,'')='en_revision' or coalesce(mad.not_recommended_to_lead_studies,false)`)
  console.log(`en el comité pero con bandera que impide activarlos: ${r.rowCount}`)
  r.rows.forEach(x => console.log(`  ${x.nom} · ${x.availability_status}${x.no_rec?' · NO RECOMENDADO':''}`))
  await c.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
