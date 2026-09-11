/**
 * ETAPA 5 · Verificación: se regenera la comparación por persona contra la BASE,
 * con la misma forma que data-import/comparacion-por-persona-2026-09-11.xlsx
 * (833 match / 1.176 sin match antes de esta sincronización).
 *
 *   node scripts/madre-2026-09/etapa5-verificacion.cjs
 */
const L = require('./lib.cjs'); const fs = require('fs')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const PE = L.hoja('Personas').filter(r => String(r['Puesto oficial 2026']).trim())
  const correcciones = L.correccionesDifusas()
  const correcPorComite = new Map(L.CORRECCIONES_POR_COMITE.map(x => [`${L.norm(x.ccb)}|${L.norm(x.comite)}`, x.oficial]))
  const oficialDe = r => correcPorComite.get(`${L.norm(r['Puesto como está en CCB'])}|${L.norm(r['Comité'])}`)
    ?? correcciones.get(L.norm(r['Puesto como está en CCB'])) ?? String(r['Puesto oficial 2026']).trim()

  const { rows: asg } = await c.query(`select v.member_id, m.external_id, m.first_name||' '||m.last_name persona,
      sp.title, a.name comite
    from volunteers v join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id
    join members m on m.id=v.member_id
    where v.status='active' and sp.is_active and a.name not like '[prueba]%'`)
  const porExt = new Map()
  for (const r of asg) { const k = String(r.external_id); if (!porExt.has(k)) porExt.set(k, []); porExt.get(k).push(r) }

  const filas = [], vistos = new Set()
  let si = 0, no = 0, ignorados = 0
  for (const r of PE) {
    const com = String(r['Comité']).trim()
    const ext = String(r['Individual ID']).trim()
    const oficial = oficialDe(r)
    if (L.IGNORAR.includes(com)) { ignorados++; continue }
    vistos.add(`${ext}|${L.norm(oficial)}`)
    const suyas = porExt.get(ext) ?? []
    const match = suyas.some(x => L.norm(x.title) === L.norm(oficial))
    match ? si++ : no++
    filas.push([String(r['Nombre']).trim(), String(r['Puesto como está en CCB']).trim(), oficial,
      suyas.map(x => x.title).join(' · ') || '(no está activo en el sistema)', match ? 'Sí' : 'NO', com])
  }
  // Gente activa en el sistema que el madre no menciona (no se tocó, por regla).
  let extra = 0
  for (const [ext, lista] of porExt) for (const x of lista) {
    if (vistos.has(`${ext}|${L.norm(x.title)}`)) continue
    extra++
    filas.push([x.persona, '(no está en CCB/madre)', '', x.title, 'NO', x.comite])
  }

  console.log('══ ETAPA 5 · COMPARACIÓN POR PERSONA, REGENERADA\n')
  console.log(`  filas del madre comparadas: ${si + no}`)
  console.log(`     MATCH (la persona tiene ese puesto activo):  ${si}   ${(si*100/(si+no)).toFixed(1)}%`)
  console.log(`     sin match:                                   ${no}`)
  console.log(`  ignoradas (Bautizos / Life Este):               ${ignorados}`)
  console.log(`  asignaciones activas que el madre no menciona:  ${extra}   (no se tocaron, por la regla de no dar de baja)`)
  console.log(`\n  ANTES de la sincronización: 833 match / 1.176 sin match`)
  console.log(`  AHORA:                      ${si} match / ${no} sin match`)

  if (no) {
    const u = new Map()
    for (const f of filas.filter(f => f[4] === 'NO' && f[1] !== '(no está en CCB/madre)')) {
      const k = `${f[5]}|${f[2]}`; u.set(k, (u.get(k) ?? 0) + 1)
    }
    console.log('\n── LOS QUE SIGUEN SIN MATCH, por comité y puesto:')
    ;[...u].sort((a, b) => b[1] - a[1]).forEach(([k, n]) =>
      console.log(`   ${String(n).padStart(3)}  ${k.split('|')[0].padEnd(26)} «${k.split('|')[1]}»`))
  }
  const cab = ['Persona', 'Puesto en CCB (original)', 'Puesto oficial 2026 (madre)', 'Puesto(s) activo(s) en el sistema', 'Match', 'Comité']
  fs.writeFileSync('data-import/comparacion-por-persona-despues-2026-09-11.csv',
    [cab, ...filas].map(f => f.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'))
  console.log('\nCSV: data-import/comparacion-por-persona-despues-2026-09-11.csv')
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
