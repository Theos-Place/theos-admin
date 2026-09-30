/**
 * REP-12 · DRY-RUN: quién recibe el rol `reportes` por encabezar el Comité de
 * Planificación. No escribe nada.
 *
 *   node scripts/rep12/dry-run.cjs
 *
 * Por qué hace falta un backfill y no alcanza con la regla: el sync de roles
 * por puesto (`position-role-sync`) corre cuando alguien TOCA una asignación.
 * Quien ya tiene el puesto desde antes no dispara nada, así que sin la
 * migración la regla nueva no le llega a nadie hasta que alguien lo reasigne.
 *
 * Lo que hay que mirar:
 *
 *  1. Que la lista sea corta y sean quienes se espera. Si aparecen 26
 *     personas, la regla se está aplicando por TÍTULO y no por comité:
 *     `Encargado Comité` existe en 23 comités.
 *  2. Que nadie de la lista tenga ya el rol a mano — si lo tiene, el backfill
 *     no debe pisarle el `origen='manual'`, o al perder el puesto se le
 *     revocaría algo que alguien le dio a propósito.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
const sinArt = s => norm(s).replace(/\b(de|del|la|el|los|las)\b/g, ' ').replace(/\s+/g, ' ').trim()
/** Espejo de `esPuestoDeEncargado`. */
const esEncargado = t => { const x = sinArt(t); return x === 'encargado' || x.startsWith('encargado ') }

async function main() {
  const c = await nuevoCliente()
  await c.connect()
  try {
    const { rows } = await c.query(`
      select v.member_id, m.first_name || ' ' || m.last_name as persona,
             sp.id as position_id, sp.title, a.name as area,
             exists (select 1 from member_roles mr
                      where mr.member_id = v.member_id and mr.role = 'reportes' and mr.is_active) as ya_activo,
             (select mr.origen from member_roles mr
               where mr.member_id = v.member_id and mr.role = 'reportes' limit 1) as origen_actual
        from volunteers v
        join service_positions sp on sp.id = v.position_id and sp.is_active
        join areas a on a.id = sp.area_id and a.is_active and a.area_type = 'committee'
        join members m on m.id = v.member_id
       where v.status = 'active'
         and unaccent(lower(a.name)) like '%planificacion%'`)

    const reciben = rows.filter(r => esEncargado(r.title))
    const quedanFuera = rows.filter(r => !esEncargado(r.title))

    console.log(`\nPuestos activos en el Comité de Planificación: ${rows.length}`)
    console.log(`  · reciben el rol reportes: ${reciben.length}`)
    console.log(`  · quedan fuera (no son encargado): ${quedanFuera.length}\n`)

    console.log('=== RECIBEN EL ROL ===')
    console.table(reciben.map(r => ({
      persona: r.persona,
      puesto: `${r.title} — ${r.area}`,
      'ya lo tenía': r.ya_activo ? `sí (${r.origen_actual})` : 'no',
    })))

    if (quedanFuera.length) {
      console.log('\n=== NO LO RECIBEN (no encabezan el comité) ===')
      console.table(quedanFuera.map(r => ({ persona: r.persona, puesto: r.title })))
    }

    // El control que importa: la regla NO puede pegarle a los otros comités.
    const { rows: otros } = await c.query(`
      select count(distinct v.member_id)::int as n
        from volunteers v
        join service_positions sp on sp.id = v.position_id and sp.is_active
        join areas a on a.id = sp.area_id and a.is_active and a.area_type = 'committee'
       where v.status = 'active'
         and unaccent(lower(sp.title)) in ('encargado comite', 'encargado de comite')
         and unaccent(lower(a.name)) not like '%planificacion%'`)
    console.log(`\nCONTROL · personas con «Encargado Comité» en OTROS comités: ${otros[0].n}`)
    console.log('Ninguna debe recibir el rol. Si la migración las toca, la regla')
    console.log('está mirando el título y no el comité.')

    const pisaManual = reciben.filter(r => r.ya_activo && r.origen_actual === 'manual')
    if (pisaManual.length) {
      console.log(`\n⚠ ${pisaManual.length} ya tienen el rol a MANO. El backfill no debe pisarles`)
      console.log('  el origen, o al perder el puesto se les revoca algo que alguien les dio.')
      process.exitCode = 1
    }
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
