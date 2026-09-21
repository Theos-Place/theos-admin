/**
 * El "Encargado Sede" que la estrella creó sola en Sede Antares (2026-09-21).
 * Nadie lo pidió y quedó vacío; era el bug que reportó el Comité de Servidores.
 *
 * Solo ese: los "Encargado Sede" de las otras sedes son reales y tienen gente.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const objetivo = await c.query(`
      select sp.id, sp.title, a.name comite,
             (select count(*) from volunteers v where v.position_id=sp.id and v.status='active')::int activos,
             (select count(*) from volunteers v where v.position_id=sp.id)::int historicos
      from service_positions sp join areas a on a.id=sp.area_id
      where a.name = 'Sede Antares' and lower(unaccent(sp.title)) = 'encargado sede'
        and sp.created_at::date = '2026-09-21'`)
    if (objetivo.rowCount !== 1) throw new Error(`se esperaba 1 puesto, hay ${objetivo.rowCount}`)
    const p = objetivo.rows[0]
    console.log(`${p.comite} · ${p.title}: ${p.activos} activos, ${p.historicos} en total`)
    if (p.activos > 0) throw new Error('tiene gente activa — no se borra')
    // Las asignaciones inactivas del puesto se van con él: son del mismo error.
    await c.query('delete from volunteers where position_id=$1', [p.id])
    await c.query('delete from service_positions where id=$1', [p.id])

    const quedan = await c.query(`
      select sp.title, (select count(*) from volunteers v where v.position_id=sp.id and v.status='active')::int gente
      from service_positions sp join areas a on a.id=sp.area_id
      where a.name='Sede Antares' and sp.is_active order by 1`)
    console.table(quedan.rows)
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
