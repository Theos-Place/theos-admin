/** ¿Cada PUESTO activo de CCB tiene su fila activa en el sistema? */
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

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const ccb = leerCSV(fs.readFileSync('data-import/puestos-ccb-activos-2026-09-15.csv','utf8'))
  const { rows: sis } = await c.query(`
    select m.external_id ext, m.first_name||' '||m.last_name persona,
           v.status, v.end_date, sp.title puesto, a.name comite
    from members m join volunteers v on v.member_id=m.id
    join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
    where a.name not like '[prueba]%' and m.external_id is not null`)

  const activas = new Map(), inactivas = new Map()
  for (const r of sis) {
    const k = `${r.ext}|${norm(r.puesto)}`
    ;(r.status === 'active' ? activas : inactivas).set(k, r)
  }
  // Índice laxo: mismo external_id, título del sistema que EMPIEZA por el de CCB
  // (o al revés). Cubre los renombres tipo "Abuelitos" → "Abuelitos GAM".
  const porPersona = new Map()
  for (const r of sis) {
    if (!porPersona.has(r.ext)) porPersona.set(r.ext, [])
    porPersona.get(r.ext).push(r)
  }
  const parecido = (a, b) => a === b || a.startsWith(b) || b.startsWith(a)

  const exacta = [], laxa = [], cerrada = [], sinRastro = []
  for (const r of ccb) {
    const ext = String(r['Individual ID']).trim()
    const t = norm(r['Position Name'])
    const k = `${ext}|${t}`
    if (activas.has(k)) { exacta.push(r); continue }
    const filas = porPersona.get(ext) ?? []
    const lax = filas.find(f => f.status === 'active' && parecido(norm(f.puesto), t))
    if (lax) { laxa.push({ ccb: r, sis: lax }); continue }
    const cerr = filas.filter(f => f.status !== 'active' && parecido(norm(f.puesto), t))
    if (cerr.length) { cerrada.push({ ccb: r, sis: cerr }); continue }
    sinRastro.push({ ccb: r, filas })
  }
  console.log(`CCB activo: ${ccb.length} asignaciones\n`)
  console.log(`  a) calzan exacto con una fila ACTIVA:        ${String(exacta.length).padStart(4)}`)
  console.log(`  b) calzan con nombre parecido, fila ACTIVA:  ${String(laxa.length).padStart(4)}   (renombres tipo "Abuelitos" → "Abuelitos GAM")`)
  console.log(`  c) el puesto existe pero está CERRADO:       ${String(cerrada.length).padStart(4)}   ← lo que hay que revisar`)
  console.log(`  d) no hay ninguna fila de ese puesto:        ${String(sinRastro.length).padStart(4)}`)

  console.log('\n── (c) PUESTOS DE CCB QUE EN EL SISTEMA ESTÁN CERRADOS:')
  for (const x of cerrada.slice(0, 50)) {
    console.log(`   ${(x.ccb['First Name']+' '+x.ccb['Last Name']).padEnd(32)} «${x.ccb['Position Name'].trim()}» ${x.ccb['Team Name']||x.ccb['Category Name']}`)
    x.sis.forEach(f => console.log(`        sistema: «${f.puesto}» ${f.comite} → ${f.status} ${f.end_date?String(f.end_date).slice(0,10):''}`))
  }
  if (cerrada.length > 50) console.log(`   … y ${cerrada.length - 50} más`)

  console.log('\n── (d) SIN NINGUNA FILA DE ESE PUESTO (muestra de 30):')
  const porComite = new Map()
  for (const x of sinRastro) {
    const k = `${x.ccb['Position Name'].trim()} · ${x.ccb['Team Name']||x.ccb['Category Name']}`
    porComite.set(k, (porComite.get(k) ?? 0) + 1)
  }
  ;[...porComite].sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([k,n]) => console.log(`   ${String(n).padStart(3)}  ${k}`))

  fs.writeFileSync('data-import/servidores-cerrados-2026-09-15.csv',
    [['Persona','external_id','Puesto en CCB','Equipo CCB','Fila del sistema','Estado','Fin'],
     ...cerrada.flatMap(x => x.sis.map(f => [
       `${x.ccb['First Name']} ${x.ccb['Last Name']}`, String(x.ccb['Individual ID']).trim(),
       x.ccb['Position Name'].trim(), x.ccb['Team Name']||x.ccb['Category Name'],
       `${f.puesto} · ${f.comite}`, f.status, f.end_date?String(f.end_date).slice(0,10):'']))]
      .map(f => f.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n'))
  console.log('\nCSV: data-import/servidores-cerrados-2026-09-15.csv')
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
