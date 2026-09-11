/**
 * ETAPA 2 · Puestos: nombres oficiales + fichas del madre.
 *   node scripts/madre-2026-09/etapa2-puestos.cjs            # DRY RUN
 *   node scripts/madre-2026-09/etapa2-puestos.cjs --aplicar
 *
 * EL MAPEO viejo→oficial se deriva de la hoja Personas con la llave
 * (Puesto como está en CCB + Comité), no solo por el nombre: 4 nombres
 * genéricos —"Colaborador", "Encargado", "Encargado de comité", "Asistente
 * Encargado"— van a un puesto distinto según el comité. Con esa llave el mapeo
 * queda determinista: 339 combinaciones, 0 ambiguas.
 *
 * Las fichas (Descripción/Requisitos/Habilidades/Funciones/Perfil) salen de
 * "Puestos madre" y calzan 1 a 1 con las columnas de service_positions. El
 * comité del madre puede ser una FAMILIA: "Sedes" no es un comité sino el
 * catálogo de puestos que cada sede usa, así que su ficha aplica al puesto de
 * ese nombre en todas las sedes.
 */
const L = require('./lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const t = v => { const s = String(v ?? '').trim(); return s || null }

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const PM = L.hoja('Puestos madre')
  const PE = L.hoja('Personas').filter(r => String(r['Puesto oficial 2026']).trim())
                               .filter(r => !L.IGNORAR.includes(String(r['Comité']).trim()))
  const { comites, puestos } = await L.cargarSistema(c)
  const idxCom = L.indiceComites(comites)
  const comiteSistema = nombre => {
    const n = String(nombre).trim()
    const d = L.PERSONAS_A_SISTEMA[L.norm(n)] ?? L.COMITE_MADRE_A_SISTEMA[L.norm(n)] ?? n
    return (idxCom.get(L.norm(d)) ?? [])[0] ?? null
  }

  // ── Tabla (CCB + comité) → oficial, con las correcciones del usuario encima ──
  const correcciones = L.correccionesDifusas()
  const correcPorComite = new Map(L.CORRECCIONES_POR_COMITE.map(x => [`${L.norm(x.ccb)}|${L.norm(x.comite)}`, x.oficial]))
  const tabla = new Map()
  let corregidas = 0
  for (const r of PE) {
    const cs = comiteSistema(r['Comité']); if (!cs) continue
    const ccb = L.norm(r['Puesto como está en CCB'])
    const delMadre = String(r['Puesto oficial 2026']).trim()
    const fin = correcPorComite.get(`${ccb}|${L.norm(r['Comité'])}`) ?? correcciones.get(ccb) ?? delMadre
    if (L.norm(fin) !== L.norm(delMadre)) corregidas++
    tabla.set(`${ccb}|${cs.id}`, fin)
  }
  console.log(`(correcciones del usuario aplicadas sobre el madre: ${correcciones.size} mapeos, ${corregidas} filas cambian de destino)\n`)

  // ── Fichas del madre, por (comité del madre, puesto oficial) ─────────
  const ficha = new Map()
  for (const r of PM) {
    const k = `${L.norm(r['Comité'])}|${L.norm(r['Puesto oficial 2026'])}`
    ficha.set(k, { description: t(r['Descripción']), requirements: t(r['Requisitos']),
                   skills: t(r['Habilidades']), functions: t(r['Funciones']), profile: t(r['Perfil']) })
  }
  const esSede = nombre => /^sede /i.test(String(nombre))
  const fichaDe = (comiteNombre, oficial) =>
    ficha.get(`${L.norm(comiteNombre)}|${L.norm(oficial)}`)
    ?? (esSede(comiteNombre) ? ficha.get(`${L.FAMILIA_SEDES}|${L.norm(oficial)}`) : undefined)
    ?? [...ficha].find(([k]) => k.endsWith('|' + L.norm(oficial)))?.[1]

  // ── Plan ─────────────────────────────────────────────────────────────
  const porComite = new Map()
  for (const p of puestos) { if (!porComite.has(p.area_id)) porComite.set(p.area_id, []); porComite.get(p.area_id).push(p) }
  const renombrar = [], fusionar = [], crear = [], soloFicha = [], intactos = []

  for (const p of puestos) {
    if (p.comite.startsWith('[prueba]')) continue
    if (!p.is_active) continue   // ya fusionado en una corrida anterior
    const oficial = tabla.get(`${L.norm(p.title)}|${p.area_id}`)
    if (!oficial) { intactos.push(p); continue }
    if (L.norm(p.title) === L.norm(oficial)) { soloFicha.push({ p, oficial }); continue }
    // El "gemelo" es un puesto del mismo comité que YA se llama como el oficial…
    let gemelo = (porComite.get(p.area_id) ?? []).find(x => x.id !== p.id && L.norm(x.title) === L.norm(oficial))
    // …o uno que se va a renombrar a ese nombre en esta misma corrida. Sin esta
    // segunda mitad, dos puestos que colapsan en el mismo oficial y ninguno lo
    // lleva todavía se renombran los DOS y el comité queda con el título
    // duplicado. Pasó en Sede Madrid: «Colaborador Audiovisuales» y
    // «Coordinador Audiovisuales», los dos a «Colaborador PT sedes».
    if (!gemelo) {
      const yaPlanificado = renombrar.find(x => x.p.area_id === p.area_id && L.norm(x.oficial) === L.norm(oficial))
      if (yaPlanificado) gemelo = yaPlanificado.p
    }
    if (gemelo) fusionar.push({ de: p, a: gemelo, oficial })
    else renombrar.push({ p, oficial })
  }
  // Puestos oficiales que la gente necesita y no existen en su comité.
  // OJO: sale de `tabla` (ya corregida), no de la columna cruda del madre — si
  // no, se crearían los puestos de los mapeos que el usuario descartó
  // ("Encargado Mujeres" en Matrimonios, "Coordinador Información" en Oración).
  const necesarios = new Map()
  for (const r of PE) {
    const cs = comiteSistema(r['Comité']); if (!cs) continue
    const oficial = tabla.get(`${L.norm(r['Puesto como está en CCB'])}|${cs.id}`)
    if (!oficial) continue
    necesarios.set(`${cs.id}|${L.norm(oficial)}`, { cs, oficial })
  }
  for (const [k, v] of necesarios) {
    const yaEsta = (porComite.get(v.cs.id) ?? []).some(x => L.norm(x.title) === L.norm(v.oficial))
    const seVaARenombrar = renombrar.some(x => x.p.area_id === v.cs.id && L.norm(x.oficial) === L.norm(v.oficial))
    if (!yaEsta && !seVaARenombrar) crear.push(v)
  }

  console.log('══ ETAPA 2 · PLAN\n')
  console.log(`  RENOMBRAR (1→1):        ${renombrar.length}`)
  console.log(`  FUSIONAR (varios→1):    ${fusionar.length}`)
  console.log(`  CREAR (no existe):      ${crear.length}`)
  console.log(`  solo actualizar ficha:  ${soloFicha.length}`)
  console.log(`  NO se tocan (no están en el mapeo): ${intactos.length}`)
  const conFicha = [...renombrar.map(x=>x.oficial), ...soloFicha.map(x=>x.oficial), ...crear.map(x=>x.oficial)]
    .filter(o => { const f = fichaDe('', o); return f && f.description })
  console.log(`  de los anteriores, con descripción en el madre: ${conFicha.length}`)

  console.log('\n── FUSIONES (mueven gente; es lo más delicado)')
  for (const f of fusionar) console.log(`  ${f.de.comite.padEnd(28)} «${f.de.title}» (${f.de.activos} activos) → «${f.a.title}» (${f.a.activos})`)
  console.log('\n── RENOMBRES (primeros 40 de ' + renombrar.length + ')')
  renombrar.slice(0, 40).forEach(r => console.log(`  ${r.p.comite.padEnd(28)} «${r.p.title}» → «${r.oficial}»  (${r.p.activos} activos)`))
  console.log('\n── CREAR (primeros 40 de ' + crear.length + ')')
  crear.slice(0, 40).forEach(x => console.log(`  ${x.cs.name.padEnd(28)} «${x.oficial}»`))

  require('fs').writeFileSync('scripts/madre-2026-09/plan-etapa2.json', JSON.stringify({
    renombrar: renombrar.map(x=>({id:x.p.id, comite:x.p.comite, de:x.p.title, a:x.oficial, activos:x.p.activos})),
    fusionar: fusionar.map(x=>({de:x.de.id, deTitulo:x.de.title, a:x.a.id, aTitulo:x.a.title, comite:x.de.comite, mueve:x.de.activos, total:x.de.total})),
    crear: crear.map(x=>({comite:x.cs.name, comite_id:x.cs.id, titulo:x.oficial})),
    intactos: intactos.map(x=>({comite:x.comite, titulo:x.title, activos:x.activos})),
  }, null, 1))
  console.log('\n(plan completo en scripts/madre-2026-09/plan-etapa2.json)')
  if (!aplicar) { console.log('\n🔎 DRY RUN — no se escribió nada.'); await c.end(); return }

  await c.query('begin')
  const ficharSQL = `update service_positions set description=coalesce($2,description), requirements=coalesce($3,requirements),
      skills=coalesce($4,skills), functions=coalesce($5,functions), profile=coalesce($6,profile), updated_at=now() where id=$1`
  const fichar = async (id, comite, oficial) => {
    const f = fichaDe(comite, oficial); if (!f) return 0
    await c.query(ficharSQL, [id, f.description, f.requirements, f.skills, f.functions, f.profile]); return 1
  }

  // CREAR
  let nCrear = 0
  for (const x of crear) {
    const f = fichaDe(x.cs.name, x.oficial) ?? {}
    await c.query(`insert into service_positions (area_id, title, description, requirements, skills, functions, profile, is_active)
                   values ($1,$2,$3,$4,$5,$6,$7,true)`,
      [x.cs.id, x.oficial, f.description ?? null, f.requirements ?? null, f.skills ?? null, f.functions ?? null, f.profile ?? null])
    nCrear++
  }
  // RENOMBRAR
  let nRen = 0
  for (const r of renombrar) {
    await c.query(`update service_positions set title=$2, updated_at=now() where id=$1`, [r.p.id, r.oficial])
    await fichar(r.p.id, r.p.comite, r.oficial); nRen++
  }
  // FUSIONAR: mover la gente y desactivar el viejo. La llave única
  // (member_id, position_id) impide mover a quien YA está en el destino: a esos
  // se les deja la fila del destino y se les inactiva la del puesto viejo — no
  // pierden la asignación, deja de estar duplicada.
  let nFus = 0, movidos = 0, colisiones = 0
  for (const f of fusionar) {
    const { rows: choque } = await c.query(
      `select v.id from volunteers v where v.position_id=$1
        and exists (select 1 from volunteers w where w.position_id=$2 and w.member_id=v.member_id)`, [f.de.id, f.a.id])
    if (choque.length) {
      // El destino puede tener la fila INACTIVA: si solo se inactiva la del
      // puesto viejo, la persona se queda sin ninguna activa y PIERDE la
      // asignación. Pasó con 5 de Sede Madrid. Se reactiva el destino primero.
      await c.query(`update volunteers set status='active', end_date=null, updated_at=now()
                     where position_id=$2 and status <> 'active'
                       and member_id in (select member_id from volunteers where id = any($1))`,
        [choque.map(x => x.id), f.a.id])
      await c.query(`update volunteers set status='inactive', end_date=coalesce(end_date, current_date), updated_at=now()
                     where id = any($1)`, [choque.map(x => x.id)])
      colisiones += choque.length
    }
    const { rowCount } = await c.query(`update volunteers set position_id=$2, updated_at=now() where position_id=$1 and id <> all($3)`,
      [f.de.id, f.a.id, choque.map(x => x.id)])
    movidos += rowCount
    await c.query(`update service_positions set is_active=false, updated_at=now() where id=$1`, [f.de.id])
    await fichar(f.a.id, f.a.comite, f.oficial); nFus++
  }
  // SOLO FICHA
  let nFicha = 0
  for (const x of soloFicha) nFicha += await fichar(x.p.id, x.p.comite, x.oficial)
  await c.query('commit')

  console.log(`\n✅ APLICADO`)
  console.log(`   creados: ${nCrear}   renombrados: ${nRen}   fusionados: ${nFus}`)
  console.log(`   asignaciones movidas por fusión: ${movidos}   (${colisiones} ya estaban en el destino → su fila vieja queda inactiva)`)
  console.log(`   fichas actualizadas: ${nFicha}`)
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
