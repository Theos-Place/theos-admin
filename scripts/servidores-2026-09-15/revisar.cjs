/**
 * REVISIÓN · ¿Siguen activos en el sistema todos los servidores activos de CCB?
 *   npx tsx --env-file=.env.local scripts/servidores-2026-09-15/revisar.cjs
 *
 * Solo lee y reporta. El match es por external_id, nunca por nombre.
 * Fuente: data-import/puestos-ccb-activos-2026-09-15.csv (export de CCB del 15
 * de setiembre, ya solo con los activos).
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
const norm = s => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const ccb = leerCSV(fs.readFileSync('data-import/puestos-ccb-activos-2026-09-15.csv', 'utf8'))
  const personasCCB = new Set(ccb.map(r => String(r['Individual ID']).trim()))
  console.log(`CCB (activos, 15-set): ${ccb.length} asignaciones · ${personasCCB.size} personas\n`)

  // Todas las filas de volunteers de esas personas, activas o no.
  const { rows: sis } = await c.query(`
    select m.external_id ext, m.first_name||' '||m.last_name persona, m.is_active persona_activa,
           v.id, v.status, v.end_date, sp.title puesto, a.name comite
    from members m
    join volunteers v on v.member_id = m.id
    join service_positions sp on sp.id = v.position_id
    join areas a on a.id = sp.area_id
    where a.name not like '[prueba]%' and m.external_id = any($1)`,
    [[...personasCCB]])

  const porPersona = new Map()
  for (const r of sis) {
    if (!porPersona.has(r.ext)) porPersona.set(r.ext, [])
    porPersona.get(r.ext).push(r)
  }

  // ── 1. Personas del CCB que en el sistema no tienen NINGÚN servicio activo ──
  const sinNadaActivo = [], sinFicha = [], inactivasComoPersona = []
  for (const ext of personasCCB) {
    const filas = porPersona.get(ext)
    const dato = ccb.find(r => String(r['Individual ID']).trim() === ext)
    const nombre = `${dato['First Name']} ${dato['Last Name']}`.trim()
    if (!filas) { sinFicha.push({ ext, nombre }); continue }
    if (!filas.some(f => f.status === 'active')) {
      sinNadaActivo.push({ ext, nombre, filas })
    }
    if (filas[0].persona_activa === false) inactivasComoPersona.push({ ext, nombre })
  }

  console.log('═'.repeat(70))
  console.log(`1) PERSONAS ACTIVAS EN CCB SIN NINGÚN SERVICIO ACTIVO EN EL SISTEMA: ${sinNadaActivo.length}`)
  console.log('═'.repeat(70))
  for (const p of sinNadaActivo.slice(0, 40)) {
    const puestosCCB = ccb.filter(r => String(r['Individual ID']).trim() === p.ext)
      .map(r => `${r['Position Name'].trim()} · ${r['Team Name'] || r['Category Name']}`)
    console.log(`\n  ${p.nombre} (${p.ext})`)
    console.log(`     CCB dice:  ${puestosCCB.join(' | ')}`)
    console.log(`     Sistema:   ${p.filas.map(f => `«${f.puesto}» ${f.comite} → ${f.status}${f.end_date ? ' ' + String(f.end_date).slice(0,10) : ''}`).join('\n                ')}`)
  }
  if (sinNadaActivo.length > 40) console.log(`\n  … y ${sinNadaActivo.length - 40} más`)

  console.log(`\n\n2) PERSONAS DEL CCB SIN FICHA EN EL SISTEMA: ${sinFicha.length}`)
  sinFicha.slice(0, 20).forEach(p => console.log(`   ${p.nombre} (${p.ext})`))

  console.log(`\n3) PERSONAS DEL CCB MARCADAS COMO INACTIVAS EN SU FICHA: ${inactivasComoPersona.length}`)
  inactivasComoPersona.slice(0, 20).forEach(p => console.log(`   ${p.nombre} (${p.ext})`))

  // ── 4. Asignación por asignación: puesto de CCB sin fila activa que le corresponda ──
  const { rows: act } = await c.query(`
    select count(*)::int asignaciones, count(distinct v.member_id)::int personas
    from volunteers v join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
    where v.status='active' and a.name not like '[prueba]%'`)
  console.log(`\n\n4) TOTALES`)
  console.log(`   Sistema hoy: ${act[0].asignaciones} asignaciones activas · ${act[0].personas} personas`)
  console.log(`   CCB activo:  ${ccb.length} asignaciones · ${personasCCB.size} personas`)

  fs.writeFileSync('data-import/servidores-a-reactivar-2026-09-15.csv',
    [['Persona','external_id','Puestos en CCB','Estado en el sistema'],
     ...sinNadaActivo.map(p => [p.nombre, p.ext,
       ccb.filter(r => String(r['Individual ID']).trim() === p.ext).map(r => `${r['Position Name'].trim()} · ${r['Team Name'] || r['Category Name']}`).join(' | '),
       p.filas.map(f => `${f.puesto}/${f.comite}=${f.status}`).join(' | ')])]
      .map(f => f.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n'))
  console.log('\nCSV: data-import/servidores-a-reactivar-2026-09-15.csv')
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
