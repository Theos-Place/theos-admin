/**
 * Comparativo CCB ↔ sistema, después de la sincronización y la depuración.
 *   node scripts/depuracion-2026-09-12/comparativo-ccb.cjs
 *
 * Una fila por asignación del CCB de hoy. El puesto de CCB se traduce al nombre
 * oficial 2026 con la misma tabla que usó la Etapa 2 (madre + correcciones del
 * usuario), y se busca si esa persona lo tiene ACTIVO en ese comité.
 *
 * Segunda hoja: lo que está activo en el sistema y no viene en el CCB — que no
 * es un error, son los agregados a mano después del kick-off.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs'); const XLSX = require('xlsx')

function leerCSV(t) {
  const F = []; let i = 0, f = '', r = [], q = false
  while (i < t.length) { const ch = t[i]
    if (q) { if (ch === '"') { if (t[i+1] === '"') { f += '"'; i += 2; continue } q = false; i++; continue } f += ch; i++; continue }
    if (ch === '"') { q = true; i++; continue }
    if (ch === ',') { r.push(f); f = ''; i++; continue }
    if (ch === '\n') { r.push(f); F.push(r); r = []; f = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    f += ch; i++ }
  if (f.length || r.length) { r.push(f); F.push(r) }
  const h = F.shift().map(x => x.replace(/^﻿/, '').replace(/^"|"$/g, ''))
  return F.filter(x => x.length === h.length).map(x => Object.fromEntries(h.map((k, j) => [k, x[j]])))
}

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const ccb = leerCSV(fs.readFileSync('data-import/puestos-ccb-actual-2026-09-12.csv', 'utf8'))

  const { rows: com } = await c.query(`select id, name from areas where area_type='committee'`)
  const idx = L.indiceComites(com.map(x => ({ ...x, is_active: true })))
  const resolverComite = t => {
    const limpio = L.sinParentesis(t)
    for (const cand of [t, limpio, 'Sede ' + limpio]) {
      const d = L.PERSONAS_A_SISTEMA[L.norm(cand)] ?? L.COMITE_MADRE_A_SISTEMA[L.norm(cand)] ?? cand
      const hit = (idx.get(L.norm(d)) ?? [])[0]; if (hit) return hit
    }
    return null
  }

  /**
   * Puesto CCB → oficial 2026, con la llave (nombre + COMITÉ) igual que la
   * Etapa 2. Por nombre solo no alcanza: "Colaborador", "Encargado",
   * "Encargado de comité" y "Asistente Encargado" van a un puesto distinto en
   * cada comité. La primera versión de este comparativo usó solo el nombre y
   * mandó los 123 "Colaborador" del sistema entero a "Colaborador Campamentos".
   */
  const PE = L.hoja('Personas').filter(r => String(r['Puesto oficial 2026']).trim())
  const corr = L.correccionesDifusas()
  const corrCom = new Map(L.CORRECCIONES_POR_COMITE.map(x => [`${L.norm(x.ccb)}|${L.norm(x.comite)}`, x.oficial]))
  const porNombreYComite = new Map(), porNombre = new Map()
  for (const r of PE) {
    const k = L.norm(r['Puesto como está en CCB'])
    const of = corrCom.get(`${k}|${L.norm(r['Comité'])}`) ?? corr.get(k) ?? String(r['Puesto oficial 2026']).trim()
    const cs = resolverComite(r['Comité'])
    if (cs) porNombreYComite.set(`${k}|${cs.id}`, of)
    if (!porNombre.has(k)) porNombre.set(k, of)
  }
  const oficialDe = (nombreCcb, cs) => {
    const k = L.norm(nombreCcb)
    return (cs && porNombreYComite.get(`${k}|${cs.id}`)) ?? porNombre.get(k) ?? String(nombreCcb).trim()
  }

  // Asignaciones ACTIVAS del sistema.
  const { rows: act } = await c.query(`select m.external_id, m.first_name||' '||m.last_name persona,
      sp.title, a.name comite, a.id comite_id, coalesce(p.name,'') area
    from volunteers v join members m on m.id=v.member_id
    join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
    left join areas p on p.id=a.parent_id
    where v.status='active' and sp.is_active and a.name not like '[prueba]%'`)
  const porPersona = new Map()
  for (const r of act) { const k = String(r.external_id); if (!porPersona.has(k)) porPersona.set(k, []); porPersona.get(k).push(r) }

  const filas = [], usadas = new Set()
  let si = 0, no = 0
  for (const r of ccb) {
    const ext = String(r['Individual ID']).trim()
    const cs = resolverComite(r['Team Name'])
    const oficial = oficialDe(r['Position Name'], cs)
    const suyas = porPersona.get(ext) ?? []
    const calce = cs ? suyas.find(x => x.comite_id === cs.id && L.norm(x.title) === L.norm(oficial)) : null
    const enElComite = cs ? suyas.filter(x => x.comite_id === cs.id) : []
    if (calce) { si++; usadas.add(`${ext}|${calce.comite_id}|${L.norm(calce.title)}`) } else no++
    filas.push({
      'Persona': `${r['First Name']} ${r['Last Name']}`.trim(),
      'Ind ID': ext,
      'Comité (CCB)': r['Team Name'],
      'Puesto (CCB)': r['Position Name'],
      'Puesto oficial 2026': oficial,
      'Comité en el sistema': cs?.name ?? '(ese equipo no es un comité)',
      'Puesto(s) que tiene ahí': enElComite.map(x => x.title).join(' · ') || '(ninguno)',
      'Calza': calce ? 'Sí' : 'NO',
      'Qué pasa': calce ? ''
        : !cs ? 'El equipo del CCB es un área, no un comité'
        : enElComite.length === 0 ? 'No tiene ningún puesto activo en ese comité'
        : 'Está en el comité pero con otro puesto',
    })
  }

  const soloSistema = act.filter(x => !usadas.has(`${String(x.external_id)}|${x.comite_id}|${L.norm(x.title)}`))
    .map(x => ({
      'Persona': x.persona, 'Ind ID': x.external_id, 'Área': x.area,
      'Comité': x.comite, 'Puesto': x.title,
    }))
    .sort((a, b) => a['Comité'].localeCompare(b['Comité'], 'es') || a['Persona'].localeCompare(b['Persona'], 'es'))

  console.log(`CCB: ${ccb.length} asignaciones`)
  console.log(`   calzan con el sistema: ${si}  (${(si * 100 / ccb.length).toFixed(1)}%)`)
  console.log(`   NO calzan:             ${no}`)
  const m = new Map(); filas.filter(f => f.Calza === 'NO').forEach(f => m.set(f['Qué pasa'], (m.get(f['Qué pasa']) ?? 0) + 1))
  ;[...m].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`      ${String(n).padStart(4)}  ${k}`))
  console.log(`\nactivas en el sistema que NO vienen en el CCB: ${soloSistema.length}`)

  const wb = XLSX.utils.book_new()
  const h1 = XLSX.utils.json_to_sheet(filas)
  h1['!cols'] = [{ wch: 30 }, { wch: 9 }, { wch: 28 }, { wch: 30 }, { wch: 30 }, { wch: 28 }, { wch: 42 }, { wch: 7 }, { wch: 40 }]
  h1['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 8, r: filas.length } }) }
  h1['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, h1, 'CCB vs sistema')
  const h2 = XLSX.utils.json_to_sheet(soloSistema)
  h2['!cols'] = [{ wch: 30 }, { wch: 9 }, { wch: 20 }, { wch: 28 }, { wch: 30 }]
  h2['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 4, r: soloSistema.length } }) }
  h2['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, h2, 'Solo en el sistema')
  const out = 'data-import/comparativo-ccb-vs-sistema-2026-09-12.xlsx'
  XLSX.writeFile(wb, out)
  console.log('\n→', out)
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
