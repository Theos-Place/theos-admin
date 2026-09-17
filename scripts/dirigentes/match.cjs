/** SOLO LECTURA: ¿coinciden la lista de dirigentes activos y el Comité de Dirigentes? */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  const a = await c.query(`select id, name from areas where area_type='committee' and name = 'Comité Dirigentes'`)
  console.log('comité: ' + JSON.stringify(a.rows[0] ?? 'NO EXISTE'))
  if (!a.rowCount) { await c.end(); return }
  const areaId = a.rows[0].id

  const q = async (t, sql, p=[]) => { const r = await c.query(sql,p); console.log(`  ${t.padEnd(56)} ${r.rows[0].n}`) }
  console.log('\n=== CONTEOS ===')
  await q('A · voluntarios ACTIVOS del comité (pantalla servidores)', `
    select count(distinct v.member_id) n from volunteers v
    join service_positions sp on sp.id=v.position_id
    where sp.area_id=$1 and v.status='active'`, [areaId])
  await q('B · study_leaders con is_active = true (pantalla dirigentes)', `select count(*) n from study_leaders where is_active`)
  await q('C · miembros con el rol "dirigente"', `select count(*) n from member_roles where role='dirigente' and is_active`)

  console.log('\n=== DESAJUSTES ===')
  const soloComite = await c.query(`
    select m.first_name||' '||m.last_name nom, sl.is_active, sl.availability_status
    from volunteers v join service_positions sp on sp.id=v.position_id
      join members m on m.id=v.member_id
      left join study_leaders sl on sl.member_id=v.member_id
    where sp.area_id=$1 and v.status='active' and (sl.member_id is null or sl.is_active is not true)
    order by 1`, [areaId])
  console.log(`\nEn el COMITÉ activos pero NO activos en dirigentes: ${soloComite.rowCount}`)
  soloComite.rows.forEach(x => console.log(`  ${x.nom.padEnd(34)} study_leaders: ${x.is_active === null ? 'NO EXISTE la ficha de dirigente' : 'is_active='+x.is_active+' · '+x.availability_status}`))

  const soloLista = await c.query(`
    select m.first_name||' '||m.last_name nom, sl.availability_status
    from study_leaders sl join members m on m.id=sl.member_id
    where sl.is_active and not exists (
      select 1 from volunteers v join service_positions sp on sp.id=v.position_id
      where v.member_id=sl.member_id and sp.area_id=$1 and v.status='active')
    order by 1`, [areaId])
  console.log(`\nActivos en DIRIGENTES pero no en el comité: ${soloLista.rowCount}`)
  soloLista.rows.forEach(x => console.log(`  ${x.nom.padEnd(34)} ${x.availability_status}`))
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
