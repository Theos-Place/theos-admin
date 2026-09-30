/**
 * REP-11 · DRY-RUN: quién pierde el rol `reportes` y qué gana a cambio.
 *
 * Se corre ANTES de aplicar la migración `20260930140000`, que es la regla de
 * la casa para todo cambio de permisos que toque a gente con nombre y
 * apellido. No escribe nada.
 *
 *   node scripts/rep11/dry-run.cjs
 *
 * Lo que hay que mirar en la salida:
 *
 *  1. Que TODAS las que pierden el rol sean anfitrionas. Si aparece alguien
 *     sin puesto de anfitrión, el `origen='automatico'` está mintiendo y la
 *     migración le quitaría el acceso a quien no debía.
 *  2. Que las manuales queden intactas (la migración las excluye por `origen`).
 *  3. Que las que pierden el rol SÍ recuperen Crecimiento y Personas Nuevas
 *     por su puesto — o sea, que la columna «recupera» diga sí para todas.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
const sinArt = s => norm(s).replace(/\b(de|del|la|el|los|las)\b/g, ' ').replace(/\s+/g, ' ').trim()
// Espejo de PUESTOS_QUE_ABREN_REPORTES. Si las dos se separan, este dry-run
// deja de decir la verdad — por eso la lista va acá arriba y con este nombre.
const ABREN = new Set(['anfitrion', 'anfitrion 1', 'encargado logistica'])

async function main() {
  const c = await nuevoCliente()
  await c.connect()
  try {
    const { rows: puestos } = await c.query(`
      select v.member_id, sp.title, a.name as area, ap.name as padre
        from volunteers v
        join service_positions sp on sp.id = v.position_id and sp.is_active
        join areas a on a.id = sp.area_id and a.is_active and a.area_type = 'committee'
        left join areas ap on ap.id = a.parent_id
       where v.status = 'active'`)

    const esSede = r => norm(r.padre ?? '') === 'sedes' || norm(r.area).startsWith('sede ')
    const abrePorPuesto = new Map()
    for (const r of puestos) {
      if (!esSede(r) || !ABREN.has(sinArt(r.title))) continue
      if (!abrePorPuesto.has(r.member_id)) abrePorPuesto.set(r.member_id, [])
      abrePorPuesto.get(r.member_id).push(`${r.title} — ${r.area}`)
    }

    const { rows } = await c.query(`
      select mr.member_id, m.first_name || ' ' || m.last_name as persona, mr.origen,
             exists (select 1 from member_role_position_grants g
                      where g.member_id = mr.member_id and g.role = 'reportes') as tiene_grant
        from member_roles mr
        join members m on m.id = mr.member_id
       where mr.role = 'reportes' and mr.is_active
       order by 2`)

    const pierden = rows.filter(r => r.origen === 'automatico')
    const quedan = rows.filter(r => r.origen !== 'automatico')

    console.log(`\nCon el rol \`reportes\` activo hoy: ${rows.length}`)
    console.log(`  · pierden el rol (origen automatico): ${pierden.length}`)
    console.log(`  · NO se tocan (origen manual):        ${quedan.length}\n`)

    console.log('=== PIERDEN EL ROL ===')
    console.table(pierden.map(r => ({
      persona: r.persona,
      puesto: (abrePorPuesto.get(r.member_id) ?? []).join('; ') || '(NINGUNO — REVISAR)',
      'recupera Crecimiento y Personas Nuevas': abrePorPuesto.has(r.member_id) ? 'sí' : 'NO — REVISAR',
      'tiene grant por puesto': r.tiene_grant ? 'sí' : 'no',
    })))

    console.log('\n=== NO SE TOCAN ===')
    console.table(quedan.map(r => ({ persona: r.persona, origen: r.origen })))

    const huerfanas = pierden.filter(r => !abrePorPuesto.has(r.member_id))
    if (huerfanas.length) {
      console.log(`\n⚠ ${huerfanas.length} persona(s) pierden el rol y NO lo recuperan por puesto.`)
      console.log('  Revisar antes de aplicar la migración.')
      process.exitCode = 1
    } else {
      console.log('\n✓ Todas las que pierden el rol lo recuperan acotado por su puesto.')
    }

    // Lo que se GANA: gente con el puesto que hoy no tiene el rol.
    const conRol = new Set(rows.map(r => r.member_id))
    const nuevas = [...abrePorPuesto.keys()].filter(id => !conRol.has(id))
    console.log(`\n=== GANAN ACCESO (tienen el puesto y hoy no ven ningún reporte): ${nuevas.length} ===`)
    if (nuevas.length) {
      const { rows: nombres } = await c.query(
        'select id, first_name || \' \' || last_name as persona from members where id = any($1)', [nuevas])
      console.table(nombres.map(n => ({
        persona: n.persona, puesto: (abrePorPuesto.get(n.id) ?? []).join('; '),
      })))
    }
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
