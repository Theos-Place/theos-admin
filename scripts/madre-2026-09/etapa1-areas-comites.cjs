/**
 * ETAPA 1 · Áreas y comités contra el Excel Madre.
 *   node scripts/madre-2026-09/etapa1-areas-comites.cjs            # DRY RUN
 *   node scripts/madre-2026-09/etapa1-areas-comites.cjs --aplicar
 */
const L = require('./lib.cjs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const PM = L.hoja('Puestos madre')
  const { areas, comites } = await L.cargarSistema(c)
  const idxA = new Map(areas.map(a => [L.norm(a.name), a]))
  const idxC = L.indiceComites(comites)

  // ── Áreas ────────────────────────────────────────────────────────────
  const areasMadre = [...new Set(PM.map(r => String(r['Área']).trim()).filter(Boolean))].sort()
  console.log('══ ÁREAS\n')
  const crearAreas = []
  for (const a of areasMadre) {
    const hit = idxA.get(L.norm(a))
    console.log(`  ${a.padEnd(14)} → ${hit ? hit.name : '❌ NO EXISTE — se crearía'}`)
    if (!hit) crearAreas.push(a)
  }
  const sobranA = areas.filter(a => !areasMadre.some(m => L.norm(m) === L.norm(a.name)))
  console.log(`\n  áreas del sistema que el madre no menciona (NO se tocan): ${sobranA.map(a=>a.name).join(', ')}`)

  // ── Comités ──────────────────────────────────────────────────────────
  console.log('\n══ COMITÉS DE "Puestos madre"\n')
  const crearC = [], moverC = []
  for (const m of [...new Set(PM.map(r => String(r['Comité']).trim()))].sort()) {
    if (L.norm(m) === L.FAMILIA_SEDES) {
      console.log(`  ${m.padEnd(28)} → (catálogo de puestos de sede; se reparte en la Etapa 2, no es un comité)`)
      continue
    }
    const areaMadre = [...new Set(PM.filter(r => String(r['Comité']).trim() === m).map(r => String(r['Área']).trim()))].filter(Boolean)[0] ?? null
    const destino = L.COMITE_MADRE_A_SISTEMA[L.norm(m)]
    const hit = destino ? (idxC.get(L.norm(destino)) ?? [])[0] : (idxC.get(L.norm(m)) ?? [])[0]
    if (!hit) {
      const areaNueva = L.COMITES_NUEVOS[m] ?? areaMadre
      console.log(`  ${m.padEnd(28)} → ❌ NO EXISTE — se crearía en «${areaNueva}»`)
      crearC.push({ nombre: m, area: areaNueva }); continue
    }
    const congelada = L.AREA_CONGELADA.includes(hit.name)
    const cambia = !congelada && areaMadre && L.norm(hit.area ?? '') !== L.norm(areaMadre)
    if (congelada && areaMadre && L.norm(hit.area ?? '') !== L.norm(areaMadre)) {
      console.log(`  ${m.padEnd(28)} → ${hit.name.padEnd(34)}  (área ${hit.area} se conserva por decisión)`); continue
    }
    console.log(`  ${m.padEnd(28)} → ${hit.name.padEnd(34)}${cambia ? `  ⚠️ área ${hit.area} → ${areaMadre}` : ''}`)
    if (cambia) moverC.push({ id: hit.id, nombre: hit.name, de: hit.area, a: areaMadre })
  }

  console.log('\n══ RESUMEN')
  console.log(`  áreas a crear:    ${crearAreas.length}  ${crearAreas.join(', ')}`)
  console.log(`  comités a crear:  ${crearC.length}  ${crearC.map(x=>x.nombre).join(', ')}`)
  console.log(`  comités a mover de área: ${moverC.length}`)
  moverC.forEach(x => console.log(`     ${x.nombre.padEnd(24)} ${x.de} → ${x.a}`))

  if (!aplicar) { console.log('\n🔎 DRY RUN — no se escribió nada.'); await c.end(); return }
  await c.query('begin')
  for (const a of crearAreas) await c.query(`insert into areas (name, area_type, is_active) values ($1,'area',true)`, [a])
  const { rows: areas2 } = await c.query(`select id, name from areas where area_type='area'`)
  const idA = n => areas2.find(x => L.norm(x.name) === L.norm(n))?.id ?? null
  for (const x of crearC) await c.query(`insert into areas (name, area_type, parent_id, is_active) values ($1,'committee',$2,true)`, [x.nombre, idA(x.area)])
  for (const x of moverC) await c.query(`update areas set parent_id=$2, updated_at=now() where id=$1`, [x.id, idA(x.a)])
  await c.query('commit')
  console.log(`\n✅ APLICADO — ${crearAreas.length} áreas, ${crearC.length} comités, ${moverC.length} movidos`)
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
