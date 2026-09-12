/**
 * Consolidar puestos sueltos en su puesto oficial.
 *   node scripts/madre-2026-09/consolidar-puestos.cjs [--aplicar]
 *
 * Para los que el madre no mencionaba y por eso la Etapa 2 no tocó. La lista se
 * amplía a mano: cada línea es una decisión del usuario, no una inferencia.
 *
 * El movimiento respeta la única (member_id, position_id) de volunteers:
 *  · si la persona YA tiene fila en el destino, se le reactiva esa (solo si la
 *    del puesto viejo estaba activa) y se le cierra la vieja;
 *  · el resto se mueve tal cual.
 * Las dos mitades importan: sin la primera salta un 23505, y sin la condición
 * "solo si la vieja estaba activa" se reviven asignaciones muertas.
 */
const L = require('./lib.cjs')
const aplicar = process.argv.includes('--aplicar')

/** [comité, título viejo, título oficial] */
const CONSOLIDAR = [
  // Usuario 2026-09-11: las tres son la charla de una sede, como el resto de
  // los "Orador <sede>" que el madre ya había mandado a Orador Sede.
  ['Comité Oración', 'Orador Theos Oeste',   'Orador Sede'],
  ['Comité Oración', 'Orador Theos Cartago', 'Orador Sede'],
  ['Comité Oración', 'Orador Theos Liberia', 'Orador Sede'],
]

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const puesto = async (comite, title) => (await c.query(
    `select sp.id, (select count(*) from volunteers v where v.position_id=sp.id and v.status='active')::int act
     from service_positions sp join areas a on a.id=sp.area_id where a.name=$1 and sp.title=$2 and sp.is_active`,
    [comite, title])).rows[0]

  await c.query('begin')
  let movidas = 0, hechos = 0
  for (const [comite, viejo, oficial] of CONSOLIDAR) {
    const de = await puesto(comite, viejo), a = await puesto(comite, oficial)
    if (!de) { console.log(`   «${viejo}» ya no existe en ${comite} — nada que hacer`); continue }
    if (!a) { console.error(`ABORTA — no existe «${oficial}» en ${comite}`); process.exit(1) }
    const { rows: choque } = await c.query(
      `select v.id, v.status from volunteers v where v.position_id=$1
        and exists (select 1 from volunteers w where w.position_id=$2 and w.member_id=v.member_id)`, [de.id, a.id])
    const activos = choque.filter(x => x.status === 'active').map(x => x.id)
    if (activos.length) {
      await c.query(`update volunteers set status='active', end_date=null, updated_at=now()
        where position_id=$2 and status <> 'active' and member_id in (select member_id from volunteers where id = any($1))`,
        [activos, a.id])
    }
    if (choque.length) {
      await c.query(`update volunteers set status='inactive', end_date=coalesce(end_date,current_date), updated_at=now()
        where id = any($1)`, [choque.map(x => x.id)])
    }
    const { rowCount } = await c.query(`update volunteers set position_id=$2, updated_at=now() where position_id=$1 and id <> all($3)`,
      [de.id, a.id, choque.map(x => x.id)])
    await c.query(`update service_positions set is_active=false, updated_at=now() where id=$1`, [de.id])
    movidas += rowCount + activos.length; hechos++
    console.log(`   ${comite}: «${viejo}» (${de.act}) → «${oficial}» (${a.act})`)
  }
  const { rowCount: borrados } = await c.query(`delete from service_positions sp
    where not sp.is_active and not exists (select 1 from volunteers v where v.position_id=sp.id)
      and not exists (select 1 from member_role_position_grants g where g.position_id=sp.id)
      and not exists (select 1 from vacancies vc where vc.position_id=sp.id)
      and not exists (select 1 from position_requests pr where pr.created_position_id=sp.id)`)
  const { rows: q } = await c.query(`select sp.title, (select count(*) from volunteers v where v.position_id=sp.id and v.status='active')::int act
    from service_positions sp join areas a on a.id=sp.area_id where a.name='Comité Oración' and sp.is_active order by act desc`)
  console.log(`\nconsolidados: ${hechos}   asignaciones movidas: ${movidas}   puestos vacíos borrados: ${borrados}`)
  console.log('Comité Oración queda:'); q.forEach(x => console.log(`   ${String(x.act).padStart(3)}  «${x.title}»`))
  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
