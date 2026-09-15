/**
 * FAM-2 · Parte A, paso 2 · Reconstruir las familias desde CCB.
 *   npx tsx --env-file=.env.local scripts/familias-2026-09-15/importar.cjs [--aplicar]
 *
 * REGLA DE ORO: este import AGREGA Y UNE, nunca separa. Nadie sale de la
 * familia que ya tiene; las separaciones son el flujo manual que ya existe.
 *
 * Tres casos, y cada uno reusa lo que ya hay:
 *  · Nadie de la familia está en una unidad → createFamily con todos.
 *  · Algunos ya están, todos en la MISMA unidad → se suman los que faltan.
 *  · Repartidos en dos unidades → linkFamilyMember, que FUSIONA los dos hogares
 *    enteros (regla "una persona = una familia", migración + fusion-familias.ts).
 *    El diagnóstico del 15-set no encontró ninguno, pero el caso queda cubierto
 *    porque entre el diagnóstico y la corrida alguien puede vincular a mano.
 *
 * El match es por external_id vía member_por_external_id, que también mira los
 * ids absorbidos en una fusión: sin eso la gente fusionada parece no existir.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')

function leerCSV(t) {
  const filas = []; let i = 0, f = '', r = [], q = false
  while (i < t.length) { const ch = t[i]
    if (q) { if (ch === '"') { if (t[i+1] === '"') { f += '"'; i += 2; continue } q = false; i++; continue } f += ch; i++; continue }
    if (ch === '"') { q = true; i++; continue }
    if (ch === ',') { r.push(f); f = ''; i++; continue }
    if (ch === '\n') { r.push(f); filas.push(r); r = []; f = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    f += ch; i++ }
  if (f.length || r.length) { r.push(f); filas.push(r) }
  const head = filas.shift().map(h => h.replace(/^﻿/, '').replace(/^"|"$/g, ''))
  return filas.filter(x => x.length === head.length).map(x => Object.fromEntries(head.map((h, j) => [h, x[j]])))
}

/** Posición de CCB → relation del sistema. Los valores del destino son los que
 *  ya usa family_members (Titular 1320, Hijo/a 1153, Cónyuge 718, Otro 270). */
const RELACION = {
  'primary contact': 'Titular',
  'spouse': 'Cónyuge',
  'child': 'Hijo/a',
  'other': 'Otro',
}
const relacionDe = p => RELACION[String(p ?? '').trim().toLowerCase()] ?? 'Otro'

/** Nombre de la unidad: el apellido del titular, como hace la app. */
function nombreDeFamilia(gente) {
  const titular = gente.find(g => relacionDe(g.family_position) === 'Titular') ?? gente[0]
  const apellido = String(titular.last_name ?? '').trim().split(/\s+/)[0]
  return apellido ? `Familia ${apellido}` : 'Familia'
}

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const filas = leerCSV(fs.readFileSync('data-import/familias-ccb-2026-09-14.csv', 'utf8'))
  const porFam = new Map()
  for (const f of filas) {
    const k = String(f.family_id).trim()
    if (!porFam.has(k)) porFam.set(k, [])
    porFam.get(k).push(f)
  }

  const exts = [...new Set(filas.map(f => String(f.external_id).trim()).filter(Boolean))]
  const ficha = new Map()
  for (let i = 0; i < exts.length; i += 500) {
    const { rows } = await c.query(
      `select e.ext, member_por_external_id(e.ext) id from unnest($1::text[]) e(ext)`, [exts.slice(i, i + 500)])
    for (const r of rows) if (r.id) ficha.set(r.ext, r.id)
  }

  const { rows: fm } = await c.query(`select member_id, family_unit_id from family_members`)
  const unidadDe = new Map(fm.map(r => [r.member_id, r.family_unit_id]))

  await c.query('begin')
  const plan = { creadas: 0, sumados: 0, fusiones: 0, intactas: 0, sinFicha: [], duplicados: [] }
  const ejemplos = []

  for (const [famId, gente] of porFam) {
    // Dos filas de CCB pueden resolver a la MISMA ficha: son dos registros de
    // la persona que después se fusionaron acá. Sin deduplicar, el insert
    // choca contra el único (family_unit_id, member_id) — que es justamente la
    // barrera que impide meter a alguien dos veces en su propia familia.
    // Se conserva la posición más específica: Titular gana sobre Otro.
    const PESO = { 'Titular': 3, 'Cónyuge': 2, 'Hijo/a': 1, 'Otro': 0 }
    const porMiembro = new Map()
    for (const g of gente) {
      const memberId = ficha.get(String(g.external_id).trim())
      if (!memberId) continue
      const previo = porMiembro.get(memberId)
      if (!previo) { porMiembro.set(memberId, { ...g, memberId }); continue }
      plan.duplicados.push({ famId, nombre: `${g.first_name} ${g.last_name}`.trim(), ids: [previo.external_id, g.external_id] })
      if (PESO[relacionDe(g.family_position)] > PESO[relacionDe(previo.family_position)]) {
        porMiembro.set(memberId, { ...g, memberId })
      }
    }
    const conFicha = [...porMiembro.values()]
    for (const g of gente) {
      if (!ficha.get(String(g.external_id).trim())) {
        plan.sinFicha.push({ famId, ext: g.external_id, nombre: `${g.first_name} ${g.last_name}`.trim() })
      }
    }
    if (conFicha.length < 2) continue

    const unidades = [...new Set(conFicha.map(g => unidadDe.get(g.memberId)).filter(Boolean))]

    if (unidades.length === 0) {
      // Familia nueva completa.
      const { rows: [u] } = await c.query(
        `insert into family_units (name) values ($1) returning id`, [nombreDeFamilia(gente)])
      await c.query(
        `insert into family_members (family_unit_id, member_id, relation)
         select $1, x.member_id, x.relation from jsonb_to_recordset($2::jsonb) as x(member_id uuid, relation text)`,
        [u.id, JSON.stringify(conFicha.map(g => ({ member_id: g.memberId, relation: relacionDe(g.family_position) })))])
      plan.creadas++
      for (const g of conFicha) unidadDe.set(g.memberId, u.id)
      if (ejemplos.length < 6) ejemplos.push(`CREAR   ${nombreDeFamilia(gente)}: ${conFicha.map(g => `${g.first_name} (${relacionDe(g.family_position)})`).join(', ')}`)

    } else if (unidades.length === 1) {
      // Sumar a los que faltan a la unidad que ya existe.
      const faltan = conFicha.filter(g => !unidadDe.has(g.memberId))
      if (faltan.length === 0) { plan.intactas++; continue }
      await c.query(
        `insert into family_members (family_unit_id, member_id, relation)
         select $1, x.member_id, x.relation from jsonb_to_recordset($2::jsonb) as x(member_id uuid, relation text)`,
        [unidades[0], JSON.stringify(faltan.map(g => ({ member_id: g.memberId, relation: relacionDe(g.family_position) })))])
      plan.sumados += faltan.length
      for (const g of faltan) unidadDe.set(g.memberId, unidades[0])
      if (ejemplos.length < 12) ejemplos.push(`SUMAR   a la familia de ${conFicha[0].last_name}: ${faltan.map(g => `${g.first_name} ${g.last_name}`).join(', ')}`)

    } else {
      // Repartidos: fusionar hogares con la regla que ya existe.
      const ancla = conFicha.find(g => unidadDe.get(g.memberId) === unidades[0])
      for (const g of conFicha) {
        if (g.memberId === ancla.memberId) continue
        await c.query(`select link_family_member($1, $2, $3, null)`,
          [ancla.memberId, g.memberId, relacionDe(g.family_position)])
      }
      plan.fusiones++
      if (ejemplos.length < 14) ejemplos.push(`FUSIONAR ${unidades.length} hogares: ${conFicha.map(g => g.first_name).join(', ')}`)
    }
  }

  console.log(`familias nuevas creadas:            ${plan.creadas}`)
  console.log(`personas sumadas a una familia:     ${plan.sumados}`)
  console.log(`hogares fusionados:                 ${plan.fusiones}`)
  console.log(`familias que ya estaban completas:  ${plan.intactas}`)
  console.log(`personas de CCB sin ficha (no se crean): ${plan.sinFicha.length}`)
  console.log(`filas de CCB que apuntan a una ficha ya contada (fusionadas): ${plan.duplicados.length}`)
  plan.duplicados.slice(0, 8).forEach(d => console.log(`   ${d.nombre} — external_id ${d.ids.join(' y ')} son la misma ficha`))
  console.log('\n── qué haría (muestra):')
  ejemplos.forEach(e => console.log('   ' + e))

  const { rows: [q] } = await c.query(`
    select (select count(*)::int from family_units) unidades,
           (select count(*)::int from family_members) integrantes`)
  console.log(`\nQUEDA: ${q.unidades} unidades familiares · ${q.integrantes} integrantes`)

  // Guardia: nadie puede quedar en DOS familias.
  const { rows: [dup] } = await c.query(`
    select count(*)::int n from (select member_id from family_members group by 1 having count(*) > 1) x`)
  console.log(`personas en más de una familia: ${dup.n}  ${dup.n === 0 ? '✓' : '⚠️  ABORTAR'}`)
  if (dup.n > 0) { await c.query('rollback'); console.log('\n❌ Rollback: la regla de una persona = una familia se rompió.'); await c.end(); return }

  fs.writeFileSync('data-import/familias-sin-ficha-2026-09-15.csv',
    [['family_id', 'external_id', 'Nombre'], ...plan.sinFicha.map(x => [x.famId, x.ext, x.nombre])]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'))
  console.log('CSV de los que no tienen ficha: data-import/familias-sin-ficha-2026-09-15.csv')

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
