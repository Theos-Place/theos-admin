/**
 * Los puestos ACTIVOS que hoy no tienen a nadie, revisados uno por uno.
 *   npx tsx --env-file=.env.local scripts/servidores-2026-09-15/puestos-vacios.cjs
 *
 * Solo lee. La pregunta que importa no es "¿está vacío?" sino "¿debería estarlo?",
 * y eso lo contesta CCB: si el export de activos tiene gente en ese puesto, el
 * vacío es un hueco del sistema y no una vacante.
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
const comite = s => norm(s).replace(/^(sede|comite|subcomite)\s+/,'')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const ccb = leerCSV(fs.readFileSync('data-import/puestos-ccb-activos-2026-09-15.csv','utf8'))

  const { rows } = await c.query(`
    select sp.title, a.name area,
           count(v.id)::int historicos,
           max(v.end_date)::text ultimo_fin
    from service_positions sp
    join areas a on a.id = sp.area_id
    left join volunteers v on v.position_id = sp.id
    where sp.is_active and a.name not like '[prueba]%'
    group by sp.id, sp.title, a.name
    having count(*) filter (where v.status = 'active') = 0
    order by a.name, sp.title`)

  // ¿CCB tiene gente activa en ese puesto+comité?
  const enCCB = (title, area) => ccb.filter(r =>
    norm(r['Position Name']) === norm(title) &&
    comite(r['Team Name'] || r['Category Name']) === comite(area))

  const hueco = [], vaciado = [], nunca = []
  for (const r of rows) {
    const gente = enCCB(r.title, r.area)
    if (gente.length) hueco.push({ ...r, gente })
    else if (r.historicos > 0) vaciado.push(r)
    else nunca.push(r)
  }

  console.log(`puestos activos sin nadie: ${rows.length}\n`)
  console.log('═'.repeat(72))
  console.log(`a) CCB SÍ TIENE GENTE AHÍ → es un hueco del sistema: ${hueco.length}`)
  console.log('═'.repeat(72))
  hueco.forEach(r => {
    console.log(`   ${r.area} · «${r.title}»  (${r.historicos} en el historial)`)
    r.gente.forEach(g => console.log(`        CCB: ${g['First Name']} ${g['Last Name']} (${String(g['Individual ID']).trim()})`))
  })

  console.log(`\nb) TUVO GENTE Y SE VACIÓ, y CCB tampoco tiene: ${vaciado.length}`)
  vaciado.forEach(r => console.log(`   ${r.area.padEnd(32)} «${r.title}»  ${r.historicos} en el historial, último fin ${r.ultimo_fin ?? '—'}`))

  console.log(`\nc) NUNCA TUVO A NADIE (puesto creado y sin llenar): ${nunca.length}`)
  nunca.forEach(r => console.log(`   ${r.area.padEnd(32)} «${r.title}»`))
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
