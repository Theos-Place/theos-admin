/** Reproduce LITERAL lo que hace getActiveDirigentes(). */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  // Paso 1, tal cual el código: .eq('area_type','committee').ilike('name','Comité de Dirigentes')
  const a = await c.query(`select id from areas where area_type='committee' and name ilike 'Comité de Dirigentes'`)
  console.log(`paso 1 · buscar el área "Comité de Dirigentes": ${a.rowCount} resultado(s)`)
  if (!a.rowCount) {
    console.log('  → la función hace `if (!area) return []`')
    console.log('  → o sea: getActiveDirigentes() devuelve SIEMPRE lista vacía')
    console.log('  → y en buildDirigentes: status = activeMap.has(id) ? activo : inactivo')
    console.log('  → con activeMap vacío, TODOS quedan "inactivo"')
  }
  // Y con el nombre real, cuántos serían.
  const b = await c.query(`
    select count(distinct v.member_id) n from volunteers v
    join service_positions sp on sp.id=v.position_id
    join areas ar on ar.id=sp.area_id
    where ar.name='Comité Dirigentes' and v.status='active'`)
  console.log(`\ncon el nombre real ("Comité Dirigentes") serían: ${b.rows[0].n} activos`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
