/**
 * FAM-2 · Parte A, paso 1 · DIAGNÓSTICO. Solo lee.
 *   npx tsx --env-file=.env.local scripts/familias-2026-09-15/diagnostico.cjs
 *
 * De las familias reales de CCB, cuántas están completas hoy, cuántas a medias
 * y cuántas no existen. Ese número dice el tamaño real del problema que la
 * gente reporta ("las familias ya no salen").
 *
 * El match es por external_id y, desde el 15-set, también por los external_id
 * que una ficha absorbió al fusionarse (member_por_external_id). Sin eso, la
 * gente fusionada parece no existir.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')

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

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const filas = leerCSV(fs.readFileSync('data-import/familias-ccb-2026-09-14.csv', 'utf8'))

  const familias = new Map()
  for (const f of filas) {
    const k = String(f.family_id).trim()
    if (!familias.has(k)) familias.set(k, [])
    familias.get(k).push(f)
  }
  console.log(`CCB: ${familias.size} familias · ${filas.length} personas\n`)

  // external_id → ficha (mirando también los absorbidos en una fusión)
  const exts = [...new Set(filas.map(f => String(f.external_id).trim()).filter(Boolean))]
  const ficha = new Map()
  for (let i = 0; i < exts.length; i += 500) {
    const { rows } = await c.query(
      `select e.ext, member_por_external_id(e.ext) id from unnest($1::text[]) e(ext)`, [exts.slice(i, i + 500)])
    for (const r of rows) if (r.id) ficha.set(r.ext, r.id)
  }
  console.log(`personas de CCB con ficha: ${ficha.size} de ${exts.length}  (sin ficha: ${exts.length - ficha.size})`)

  // unidad familiar actual de cada ficha
  const { rows: fm } = await c.query(`select member_id, family_unit_id from family_members`)
  const unidadDe = new Map(fm.map(r => [r.member_id, r.family_unit_id]))

  const estado = { completa: [], parcial: [], ausente: [], repartida: [], sin_fichas: [] }
  for (const [famId, gente] of familias) {
    const ids = gente.map(g => ficha.get(String(g.external_id).trim())).filter(Boolean)
    if (ids.length < 2) { estado.sin_fichas.push({ famId, gente, ids }); continue }
    const unidades = new Set(ids.map(id => unidadDe.get(id)).filter(Boolean))
    const conUnidad = ids.filter(id => unidadDe.has(id)).length
    if (unidades.size > 1) estado.repartida.push({ famId, gente, ids, unidades: unidades.size })
    else if (conUnidad === 0) estado.ausente.push({ famId, gente, ids })
    else if (conUnidad === ids.length) estado.completa.push({ famId, gente, ids })
    else estado.parcial.push({ famId, gente, ids, conUnidad })
  }

  const n = a => String(a.length).padStart(5)
  const p = a => String(a.reduce((s, x) => s + x.ids.length, 0)).padStart(5)
  console.log(`\n  ya están juntos, completa:        ${n(estado.completa)} familias · ${p(estado.completa)} personas`)
  console.log(`  PARCIAL (faltan integrantes):     ${n(estado.parcial)} familias · ${p(estado.parcial)} personas`)
  console.log(`  AUSENTE (ninguno en familia):     ${n(estado.ausente)} familias · ${p(estado.ausente)} personas`)
  console.log(`  REPARTIDA en dos o más unidades:  ${n(estado.repartida)} familias · ${p(estado.repartida)} personas`)
  console.log(`  menos de 2 con ficha (no aplica): ${n(estado.sin_fichas)} familias`)

  const aTocar = estado.parcial.length + estado.ausente.length + estado.repartida.length
  console.log(`\n  → HAY QUE ARREGLAR ${aTocar} familias de ${familias.size}`)

  console.log('\n── muestra de AUSENTES:')
  estado.ausente.slice(0, 5).forEach(f => console.log(`   familia ${f.famId}: ${f.gente.map(g => `${g.first_name} ${g.last_name} (${g.family_position})`).join(' · ')}`))
  console.log('\n── muestra de REPARTIDAS (las que hay que fusionar):')
  estado.repartida.slice(0, 5).forEach(f => console.log(`   familia ${f.famId} en ${f.unidades} unidades: ${f.gente.map(g => `${g.first_name} ${g.last_name}`).join(' · ')}`))
  console.log('\n── muestra de PARCIALES:')
  estado.parcial.slice(0, 5).forEach(f => console.log(`   familia ${f.famId} (${f.conUnidad}/${f.ids.length} ubicados): ${f.gente.map(g => `${g.first_name} ${g.last_name}`).join(' · ')}`))

  console.log('\n── posiciones que trae CCB:')
  const pos = new Map()
  for (const f of filas) pos.set(f.family_position, (pos.get(f.family_position) ?? 0) + 1)
  ;[...pos].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(5)}  ${k || '(vacío)'}`))
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
