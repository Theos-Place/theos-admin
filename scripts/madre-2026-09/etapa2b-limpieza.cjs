/**
 * ETAPA 2b · Desactivar los puestos que el madre dejó sin uso.
 *   node scripts/madre-2026-09/etapa2b-limpieza.cjs            # DRY RUN
 *   node scripts/madre-2026-09/etapa2b-limpieza.cjs --aplicar
 *
 * DESACTIVA, no borra (regla del repo y del brief): es reversible y no toca las
 * filas de volunteers, así que el histórico de quién sirvió dónde queda intacto.
 *
 * Entran solo los puestos que cumplen TODO:
 *   · están activos y no son [prueba];
 *   · su nombre NO es un nombre oficial 2026 (ni del canon ni de las
 *     correcciones) — si lo es, se queda aunque esté vacío: es el catálogo;
 *   · NADIE los está sirviendo hoy.
 * Decisión del usuario 2026-09-11: se incluyen también los que solo tienen gente
 * inactiva (histórico), porque esas filas no se tocan.
 */
const L = require('./lib.cjs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const oficiales = new Set(L.hoja('Puestos madre').map(r => L.norm(r['Puesto oficial 2026'])))
  for (const v of L.correccionesDifusas().values()) oficiales.add(L.norm(v))
  for (const x of L.CORRECCIONES_POR_COMITE) oficiales.add(L.norm(x.oficial))

  const { rows } = await c.query(`select sp.id, sp.title, a.name comite,
      (select count(*) from volunteers v where v.position_id=sp.id and v.status='active')::int act,
      (select count(*) from volunteers v where v.position_id=sp.id)::int tot
    from service_positions sp join areas a on a.id=sp.area_id
    where sp.is_active and a.name not like '[prueba]%'`)
  const objetivo = rows.filter(r => r.act === 0 && !oficiales.has(L.norm(r.title)))
  const vacios = objetivo.filter(r => r.tot === 0), historicos = objetivo.filter(r => r.tot > 0)
  console.log(`puestos a desactivar: ${objetivo.length}`)
  console.log(`   nunca tuvieron a nadie: ${vacios.length}`)
  console.log(`   solo con gente inactiva: ${historicos.length}  (${historicos.reduce((s, r) => s + r.tot, 0)} filas de historia, NO se tocan)`)
  // Guardia dura: si alguno tiene gente activa, algo se calculó mal.
  const conGente = objetivo.filter(r => r.act > 0)
  if (conGente.length) { console.error('ABORTA — hay puestos con gente activa en la lista:', conGente); process.exit(1) }

  await c.query('begin')
  const { rowCount } = await c.query(`update service_positions set is_active=false, updated_at=now() where id = any($1)`,
    [objetivo.map(r => r.id)])
  const { rows: [q] } = await c.query(`select count(*) filter (where is_active)::int activos,
      count(*) filter (where not is_active)::int inactivos from service_positions`)
  const { rows: [v] } = await c.query(`select count(*) filter (where status='active')::int activas from volunteers`)
  console.log(`\ndesactivados: ${rowCount}`)
  console.log(`puestos quedan: ${q.activos} activos / ${q.inactivos} inactivos`)
  console.log(`asignaciones activas: ${v.activas}  (no debe cambiar)`)
  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
