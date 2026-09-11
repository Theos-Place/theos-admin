/**
 * ETAPA 4b · Borrar los puestos inactivos que no arrastran nada.
 *   node scripts/madre-2026-09/etapa4b-borrar-puestos.cjs            # DRY RUN
 *   node scripts/madre-2026-09/etapa4b-borrar-puestos.cjs --aplicar
 *
 * El usuario pidió BORRAR y no desactivar (2026-09-11), en contra de la regla
 * del repo. Se acota a lo que se puede borrar sin destruir nada:
 * volunteers.position_id y member_role_position_grants.position_id son
 * ON DELETE CASCADE, así que borrar un puesto con historial se lleva por delante
 * el registro de quién sirvió ahí. Por eso solo entran los que tienen CERO
 * referencias en las cuatro tablas que apuntan a service_positions.
 *
 * Los que sí tienen historial quedan desactivados — igual no se ven en la
 * pantalla, que ahora filtra por activos.
 */
const L = require('./lib.cjs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const { rows } = await c.query(`select sp.id, sp.title, a.name comite,
      (select count(*) from volunteers v where v.position_id=sp.id)::int vol,
      (select count(*) from member_role_position_grants g where g.position_id=sp.id)::int grants,
      (select count(*) from vacancies vc where vc.position_id=sp.id)::int vac,
      (select count(*) from position_requests pr where pr.created_position_id=sp.id)::int reqs
    from service_positions sp join areas a on a.id=sp.area_id
    where not sp.is_active and a.name not like '[prueba]%'`)
  const limpios = rows.filter(r => r.vol === 0 && r.grants === 0 && r.vac === 0 && r.reqs === 0)
  const conRef = rows.filter(r => !(r.vol === 0 && r.grants === 0 && r.vac === 0 && r.reqs === 0))
  console.log(`puestos inactivos: ${rows.length}`)
  console.log(`  A BORRAR (cero referencias): ${limpios.length}`)
  console.log(`  se quedan desactivados (tienen historial): ${conRef.length}  —  ${conRef.reduce((s,r)=>s+r.vol,0)} filas de volunteers, ${conRef.reduce((s,r)=>s+r.grants,0)} grants`)

  await c.query('begin')
  // Guardia dura DENTRO de la transacción: se borra solo lo que sigue sin
  // referencias en este instante, no lo que estaba limpio cuando se listó.
  const { rowCount } = await c.query(`delete from service_positions sp
    where sp.id = any($1) and not sp.is_active
      and not exists (select 1 from volunteers v where v.position_id=sp.id)
      and not exists (select 1 from member_role_position_grants g where g.position_id=sp.id)
      and not exists (select 1 from vacancies vc where vc.position_id=sp.id)
      and not exists (select 1 from position_requests pr where pr.created_position_id=sp.id)`,
    [limpios.map(r => r.id)])
  const { rows: [q] } = await c.query(`select count(*) filter (where is_active)::int activos,
      count(*) filter (where not is_active)::int inactivos, count(*)::int total from service_positions`)
  const { rows: [v] } = await c.query(`select count(*)::int n from volunteers`)
  console.log(`\nborrados: ${rowCount}`)
  console.log(`puestos: ${q.activos} activos / ${q.inactivos} inactivos / ${q.total} total`)
  console.log(`filas de volunteers: ${v.n}  (no debe cambiar)`)
  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
