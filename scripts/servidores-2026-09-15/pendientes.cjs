/**
 * Lo que queda por revisar después de la decisión del 15-set: los servicios de
 * SEDE MADRID se editaron a mano en el sistema nuevo y esos son los correctos —
 * ahí el CCB es el que está viejo, así que Madrid no entra.
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
const norm = s => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,' ').trim().toLowerCase()
const esMadrid = s => norm(s).includes('madrid')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const ccb = leerCSV(fs.readFileSync('data-import/puestos-ccb-activos-2026-09-15.csv','utf8'))
  // Una ficha se resuelve por su external_id O por los que absorbió al
  // fusionarse: el merge deja el del duplicado en external_id_fusionados y NO
  // se lo copia al principal (está en merge_no_copia). Sin esto, una persona
  // fusionada parece "sin ficha" aunque esté sirviendo — así reporté de más a
  // Dylana Vincenti y a María José Céspedes el 15-set.
  const { rows: sis } = await c.query(`
    select coalesce(m.external_id, f.ext) ext, m.first_name||' '||m.last_name persona,
           v.status, v.end_date, sp.title puesto, a.name comite
    from members m
    left join lateral unnest(coalesce(m.external_id_fusionados, array[]::text[])) f(ext) on true
    join volunteers v on v.member_id = m.id
    join service_positions sp on sp.id = v.position_id
    join areas a on a.id = sp.area_id
    where a.name not like '[prueba]%'
      and (m.external_id is not null or f.ext is not null)`)
  const pp = new Map()
  for (const r of sis) { if (!pp.has(r.ext)) pp.set(r.ext, []); pp.get(r.ext).push(r) }
  const par = (a,b) => a===b || a.startsWith(b) || b.startsWith(a)

  const cerradas = [], sinFicha = []
  // "Sin ficha" se pregunta contra members, no contra el join con volunteers:
  // alguien con ficha y CERO servicios no es alguien sin ficha.
  const { rows: fichas } = await c.query(`
    select coalesce(m.external_id, f.ext) ext from members m
    left join lateral unnest(coalesce(m.external_id_fusionados, array[]::text[])) f(ext) on true
    where m.external_id is not null or f.ext is not null`)
  const extEnSistema = new Set(fichas.map(r => r.ext))
  for (const r of ccb) {
    const ext = String(r['Individual ID']).trim()
    const equipo = r['Team Name'] || r['Category Name']
    if (!extEnSistema.has(ext)) {
      if (!sinFicha.some(x => x.ext === ext)) sinFicha.push({ ext, nombre: `${r['First Name']} ${r['Last Name']}`, puesto: `${r['Position Name'].trim()} · ${equipo}` })
      continue
    }
    if (esMadrid(equipo)) continue                    // Madrid: el sistema manda
    const t = norm(r['Position Name'])
    const filas = pp.get(ext) ?? []
    if (filas.some(f => f.status === 'active' && par(norm(f.puesto), t))) continue
    const cerr = filas.filter(f => f.status !== 'active' && par(norm(f.puesto), t) && !esMadrid(f.comite))
    if (cerr.length) cerradas.push({ ccb: r, sis: cerr, otrasActivas: filas.filter(f => f.status === 'active') })
  }

  console.log(`PENDIENTES (Madrid excluido)\n`)
  console.log(`1) Servicios cerrados que CCB tiene activos: ${cerradas.length}`)
  for (const x of cerradas) {
    console.log(`   ${(x.ccb['First Name']+' '+x.ccb['Last Name']).padEnd(32)} «${x.ccb['Position Name'].trim()}» ${x.ccb['Team Name']||x.ccb['Category Name']}`)
    x.sis.forEach(f => console.log(`        cerrado: «${f.puesto}» ${f.comite}  ${f.end_date?String(f.end_date).slice(0,10):'(sin fecha)'}`))
    console.log(`        activo hoy: ${x.otrasActivas.length ? x.otrasActivas.map(f => `«${f.puesto}» ${f.comite}`).join(' | ') : '— NADA —'}`)
  }
  console.log(`\n2) Personas de CCB sin ficha: ${sinFicha.length}`)
  sinFicha.forEach(p => console.log(`   ${p.nombre} (${p.ext})  —  ${p.puesto}`))
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
