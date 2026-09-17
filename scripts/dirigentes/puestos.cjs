const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const r = await c.query(`
    select sp.id, sp.title, ar.name as comite,
           count(v.id) filter (where v.status='active') activos,
           count(v.id) filter (where v.status<>'active') otros
    from service_positions sp join areas ar on ar.id=sp.area_id
      left join volunteers v on v.position_id=sp.id
    where ar.name in ('Comité Dirigentes','Comité Dirigentes Administrativo')
    group by sp.id, sp.title, ar.name order by ar.name, 4 desc`)
  console.log('=== puestos de los comités de dirigentes ===')
  r.rows.forEach(x => console.log(`  ${x.comite.padEnd(34)} ${String(x.title).padEnd(28)} ${String(x.activos).padStart(4)} activos · ${x.otros} otros`))

  const q = async (t, sql) => { const x = await c.query(sql); console.log(`  ${t.padEnd(60)} ${x.rows[0].n}`) }
  console.log('\n=== la regla que acabás de dar ===')
  await q('activos en "Comité Dirigentes" / puesto "Dirigente CR"', `
    select count(distinct v.member_id) n from volunteers v
    join service_positions sp on sp.id=v.position_id join areas ar on ar.id=sp.area_id
    where ar.name='Comité Dirigentes' and sp.title='Dirigente CR' and v.status='active'`)
  await q('vs. study_leaders.is_active (la pantalla de dirigentes)', `select count(*) n from study_leaders where is_active`)
  await q('vs. el rol "dirigente"', `select count(*) n from member_roles where role='dirigente' and is_active`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
