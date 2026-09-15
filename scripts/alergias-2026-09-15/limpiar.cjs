/**
 * DAT-7 · Limpiar members.allergies.
 *   npx tsx --env-file=.env.local scripts/alergias-2026-09-15/limpiar.cjs [--aplicar]
 *
 * Solo se borra lo que NO DICE NADA ("No", "Ninguna", "none"), y los datos que
 * se colaron de otro campo únicamente si ya están guardados donde van. Las
 * restricciones alimenticias se dejan tal cual las escribieron — decisión del
 * usuario: "Gluten" puede ser celiaquía o alergia y esa diferencia le importa a
 * quien cocina, así que la traducción no se hace sola.
 *
 * La regla vive en src/lib/members/limpieza-de-alergias.ts, con tests.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const { clasificarAlergia, sePuedeDescartar } = await import('../../src/lib/members/limpieza-de-alergias.ts')
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  const { rows } = await c.query(`
    select id, first_name||' '||last_name persona, allergies, email, phone, cedula_normalized
    from members where allergies is not null and btrim(allergies) <> ''`)

  const grupos = { alergia: [], restriccion: [], vacio: [], otro_campo: [] }
  for (const r of rows) grupos[clasificarAlergia(r.allergies)]?.push(r)

  const descartables = grupos.otro_campo.filter(r => sePuedeDescartar(r.allergies, r))
  const aRevisar = grupos.otro_campo.filter(r => !sePuedeDescartar(r.allergies, r))
  const aBorrar = [...grupos.vacio, ...descartables]

  console.log(`con algo escrito en alergias: ${rows.length}\n`)
  console.log(`  alergia real          → se queda:   ${String(grupos.alergia.length).padStart(3)}`)
  console.log(`  restricción a mano    → se queda:   ${String(grupos.restriccion.length).padStart(3)}   (decisión del usuario)`)
  console.log(`  no dice nada          → SE BORRA:   ${String(grupos.vacio.length).padStart(3)}`)
  console.log(`  de otro campo, ya guardado → BORRA: ${String(descartables.length).padStart(3)}`)
  console.log(`  de otro campo, es lo único que hay → A MANO: ${aRevisar.length}`)

  console.log('\n── SE BORRA (no dice nada):')
  const cuenta = new Map()
  for (const r of grupos.vacio) cuenta.set(r.allergies.trim(), (cuenta.get(r.allergies.trim()) ?? 0) + 1)
  ;[...cuenta].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`   ${String(n).padStart(3)}  ${JSON.stringify(t)}`))

  if (descartables.length) {
    console.log('\n── SE BORRA (de otro campo, pero el dato ya está en su lugar):')
    descartables.forEach(r => console.log(`   ${r.persona} — ${JSON.stringify(r.allergies)}  (ya lo tiene en su ficha)`))
  }

  console.log('\n── A MANO (borrarlo perdería el dato):')
  aRevisar.forEach(r => console.log(`   ${r.persona}\n      escribió: ${JSON.stringify(r.allergies)}\n      ficha: email=${r.email ?? '—'} phone=${r.phone ?? '—'} cédula=${r.cedula_normalized ?? '—'}`))

  const { rowCount } = await c.query(
    `update members set allergies = null, updated_at = now() where id = any($1)`,
    [aBorrar.map(r => r.id)])
  console.log(`\nlimpiados: ${rowCount}`)

  const { rows: [q] } = await c.query(
    `select count(*)::int n from members where allergies is not null and btrim(allergies) <> ''`)
  console.log(`quedan con texto en alergias: ${q.n}  (todas con contenido real)`)

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
