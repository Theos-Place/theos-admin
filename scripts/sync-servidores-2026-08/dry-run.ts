/**
 * Reporte de la sincronización de servidores. NO ESCRIBE NADA.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/sync-servidores-2026-08/dry-run.ts
 *
 * Lo que responde, en este orden, porque es el orden en que hay que aprobarlo:
 *   1. ¿resolví a toda la gente del CSV?
 *   2. ¿qué comités del CSV no existen — y cuáles son RENOMBRES de uno que sí?
 *   3. ¿qué puestos nuevos harían falta?
 *   4. ¿quién entra y quién sale?
 *   5. ¿a quién le cambia el ACCESO al sistema?
 */
import { cargarEnv, norm, normEmail, leerCsv, todo, esAjeno, COMITES_AJENOS, clave, claveSinTipo, AREAS_A_CREAR } from './lib'

cargarEnv()

const CSV = process.env.CSV_SERVIDORES ?? 'data-import/servidores-2026-08-26.csv'

type Miembro = { id: string; external_id: string | null; first_name: string | null; last_name: string | null; email: string | null }
type Area = { id: string; name: string; area_type: string; is_active: boolean | null; parent_id: string | null }
type Puesto = { id: string; area_id: string; title: string; is_active: boolean | null }
type Vol = { member_id: string; position_id: string; status: string }

const nombreDe = (m: Miembro) => `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()

async function main() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const db = createAdminClient()

  const todasLasFilas = leerCsv(CSV)
  // Dirigentes queda FUERA de esta sincronización (lo escribe el módulo de
  // estudios). Se filtra acá, en la entrada, para que no se cuele por ningún
  // lado: ni en renombres, ni en puestos nuevos, ni en el diff.
  const filas = todasLasFilas.filter(f => !esAjeno(f.comite))
  const excluidas = todasLasFilas.length - filas.length
  console.log(`\n═══ CSV: ${todasLasFilas.length} filas · ${excluidas} excluidas (${COMITES_AJENOS.join(', ')}) · se procesan ${filas.length} ═══`)

  const miembros = await todo<Miembro>((a, b) =>
    db.from('members').select('id,external_id,first_name,last_name,email').range(a, b))
  const areas = await todo<Area>((a, b) =>
    db.from('areas').select('id,name,area_type,is_active,parent_id').range(a, b))
  const puestos = await todo<Puesto>((a, b) =>
    db.from('service_positions').select('id,area_id,title,is_active').range(a, b))
  const vols = await todo<Vol>((a, b) =>
    db.from('volunteers').select('member_id,position_id,status').range(a, b))

  console.log(`BD: ${miembros.length} miembros · ${areas.length} áreas · ${puestos.length} puestos · ${vols.length} asignaciones`)

  // ── 1. gente ────────────────────────────────────────────────────────────
  const porExt = new Map<string, Miembro>()
  const porEmail = new Map<string, Miembro[]>()
  for (const m of miembros) {
    if (m.external_id) porExt.set(String(m.external_id).trim(), m)
    const e = normEmail(m.email ?? '')
    if (e) { const l = porEmail.get(e) ?? []; l.push(m); porEmail.set(e, l) }
  }

  const sinMatch: FilaSinMatch[] = []
  type FilaSinMatch = { linea: number; nombre: string; externalId: string; email: string; comite: string }
  const porCorreo: Array<{ nombre: string; email: string; padron: string }> = []
  const resuelto = new Map<number, Miembro>()

  for (const f of filas) {
    let m = f.externalId ? porExt.get(f.externalId) : undefined
    if (!m && f.email) {
      const cand = porEmail.get(f.email) ?? []
      if (cand.length === 1) {
        m = cand[0]
        porCorreo.push({ nombre: f.nombre, email: f.email, padron: nombreDe(m) })
      }
    }
    if (m) resuelto.set(f.linea, m)
    else sinMatch.push({ linea: f.linea, nombre: f.nombre, externalId: f.externalId, email: f.email, comite: f.comite })
  }

  const personasCsv = new Set([...resuelto.values()].map(m => m.id))
  console.log(`\n── 1. GENTE ──`)
  console.log(`  resueltas: ${personasCsv.size} personas distintas`)
  console.log(`  por external_id: ${filas.length - sinMatch.length - porCorreo.length} filas`)
  console.log(`  por correo (respaldo, REVISAR): ${porCorreo.length} filas`)
  for (const p of porCorreo.slice(0, 25)) console.log(`     ${p.nombre}  →  ${p.padron}   <${p.email}>`)
  if (porCorreo.length > 25) console.log(`     … y ${porCorreo.length - 25} más`)
  console.log(`  SIN MATCH (no se crean miembros): ${sinMatch.length} filas`)
  const sinMatchPersonas = new Map(sinMatch.map(s => [`${s.externalId}|${s.email}|${norm(s.nombre)}`, s]))
  console.log(`     = ${sinMatchPersonas.size} personas distintas`)
  for (const s of [...sinMatchPersonas.values()].slice(0, 40))
    console.log(`     línea ${s.linea}: ${s.nombre} (id ${s.externalId || '—'}) <${s.email || '—'}> · ${s.comite}`)
  if (sinMatchPersonas.size > 40) console.log(`     … y ${sinMatchPersonas.size - 40} más`)

  // ── 2. comités ──────────────────────────────────────────────────────────
  const porExacto = new Map(areas.map(a => [norm(a.name), a]))
  const porClave = new Map(areas.map(a => [clave(a.name), a]))
  const comitesCsv = [...new Set(filas.map(f => f.comite))].sort()

  /** comité del CSV → área de la BD. Se llena en capas; `renombre` marca las
   *  que hay que RENOMBRAR (el nombre de la BD difiere del nombre del CSV). */
  const mapeo = new Map<string, { area: Area; via: 'exacto' | 'equivalente' | 'solape'; renombre: boolean }>()
  const sinResolver: string[] = []
  for (const c of comitesCsv) {
    const ex = porExacto.get(norm(c))
    if (ex) { mapeo.set(c, { area: ex, via: 'exacto', renombre: false }); continue }
    const eq = porClave.get(clave(c))
    if (eq) { mapeo.set(c, { area: eq, via: 'equivalente', renombre: true }); continue }
    sinResolver.push(c)
  }
  const existentes = [...mapeo.entries()].map(([c, m]) => [c, m.area] as [string, Area])
  const nuevos = sinResolver
  /** Se llena en dos tiempos: capas 1-2 acá, capa 3 (solape) más abajo, en
   *  cuanto se resuelven los renombres. Armarlo antes de la capa 3 fue un error
   *  que hacía que 15 sedes no resolvieran: TODA su gente salía como baja y sus
   *  filas del CSV como "no convertibles". Los dos números eran el mismo
   *  fantasma. El orden importa. */
  const areaPorNombre = new Map<string, Area>()
  for (const [c, m] of mapeo) areaPorNombre.set(norm(c), m.area)

  // gente activa por área hoy, para detectar RENOMBRES por solape de personas
  const areaDePuesto = new Map(puestos.map(p => [p.id, p.area_id]))
  const genteHoy = new Map<string, Set<string>>()
  for (const v of vols) {
    if (v.status !== 'active') continue
    const aid = areaDePuesto.get(v.position_id); if (!aid) continue
    const s = genteHoy.get(aid) ?? new Set(); s.add(v.member_id); genteHoy.set(aid, s)
  }
  const genteCsvPorComite = new Map<string, Set<string>>()
  for (const f of filas) {
    const m = resuelto.get(f.linea); if (!m) continue
    const s = genteCsvPorComite.get(f.comite) ?? new Set(); s.add(m.id); genteCsvPorComite.set(f.comite, s)
  }

  console.log(`\n── 2. COMITÉS / SEDES ──`)
  console.log(`  el CSV menciona ${comitesCsv.length}; ya existen ${existentes.length}; NO existen ${nuevos.length}`)
  const nombreArea = new Map(areas.map(a => [a.id, a.name]))
  const usadasPorCsv = new Set(existentes.map(([, a]) => a.id))

  // ── capa 3: solape de personas, resuelto UNO A UNO ──────────────────────
  // Sin el uno-a-uno, "Meridiano Martes" y "Meridiano Miércoles" reclaman la
  // MISMA área y las dos "ganan": una de las dos se llevaría la gente de la
  // otra. Se ordena por evidencia y cada área se entrega una sola vez; lo que
  // queda sin área es un comité genuinamente NUEVO.
  const UMBRAL = 0.5
  type Cand = { csv: string; areaId: string; solape: number; pct: number; contiene: boolean }
  const cands: Cand[] = []
  for (const c of nuevos) {
    const suGente = genteCsvPorComite.get(c) ?? new Set<string>()
    if (suGente.size === 0) continue
    for (const [aid, hoy] of genteHoy) {
      if (usadasPorCsv.has(aid)) continue
      // un comité excluido tampoco puede ser DESTINO de un renombre: con una
      // sola persona en común, "Comité Liderando" se proponía como renombre de
      // Comité de Dirigentes, que es justo el que queremos no tocar.
      if (esAjeno(nombreArea.get(aid) ?? '')) continue
      let n = 0; for (const id of suGente) if (hoy.has(id)) n++
      if (n === 0) continue
      const nomA = nombreArea.get(aid) ?? ''
      const contiene = claveSinTipo(nomA).includes(claveSinTipo(c)) || claveSinTipo(c).includes(claveSinTipo(nomA))
      cands.push({ csv: c, areaId: aid, solape: n, pct: n / suGente.size, contiene })
    }
  }
  cands.sort((a, b) => (Number(b.contiene) - Number(a.contiene)) || (b.pct - a.pct) || (b.solape - a.solape))
  const renombreProp = new Map<string, Cand>()
  const areaTomada = new Set<string>()
  for (const cd of cands) {
    if (renombreProp.has(cd.csv) || areaTomada.has(cd.areaId)) continue
    if (cd.pct < UMBRAL && !cd.contiene) continue
    renombreProp.set(cd.csv, cd); areaTomada.add(cd.areaId); usadasPorCsv.add(cd.areaId)
  }

  console.log(`\n  RENOMBRES por nombre equivalente (seguros, ${[...mapeo.values()].filter(m => m.renombre).length}):`)
  for (const [c, m] of mapeo) if (m.renombre) console.log(`     "${m.area.name}"  →  "${c}"`)

  console.log(`\n  RENOMBRES propuestos por SOLAPE DE PERSONAS (${renombreProp.size}) — requieren tu ojo:`)
  for (const [c, cd] of renombreProp)
    console.log(`     "${nombreArea.get(cd.areaId)}"  →  "${c}"   ${cd.solape}/${genteCsvPorComite.get(c)!.size} personas en común (${Math.round(cd.pct * 100)}%)${cd.contiene ? ' · el nombre calza' : ''}`)

  // el diff de abajo asume que los renombres propuestos SE APRUEBAN
  for (const [c, cd] of renombreProp) {
    const a = areas.find(x => x.id === cd.areaId); if (a) areaPorNombre.set(norm(c), a)
  }

  const realmenteNuevos = nuevos.filter(c => !renombreProp.has(c))
  console.log(`\n  COMITÉS/SEDES A CREAR (${realmenteNuevos.length}) — sin área existente que les corresponda:`)
  // El padre sale de "Category Name" del export, no de una lista a mano: es el
  // dato que CCB ya trae. Si esa categoría no existe como área nuestra, se
  // reporta — crear un área padre es una decisión, no un efecto secundario.
  const catDeComite = new Map<string, string>()
  for (const f of filas) if (f.categoria && !catDeComite.has(f.comite)) catDeComite.set(f.comite, f.categoria)
  for (const c of realmenteNuevos) {
    const plan = AREAS_A_CREAR[c]
    const n = (genteCsvPorComite.get(c) ?? new Set()).size
    const cat = catDeComite.get(c) ?? ''
    const padre = plan?.padre ?? (cat ? (porClave.get(clave(cat))?.name ?? null) : null)
    const nombreFinal = c
    if (padre) console.log(`     "${c}" (${n} personas)  →  crear como "${nombreFinal}" bajo "${padre}"`)
    else console.log(`     "${c}" (${n} personas)  ⚠ su categoría "${cat}" NO existe como área nuestra — hay que decidir el padre`)
  }

  const conServidoresHoy = [...genteHoy.entries()].filter(([, s]) => s.size > 0)
  const noMencionadas = conServidoresHoy.filter(([aid]) => !usadasPorCsv.has(aid))
  console.log(`\n  ⚠ áreas CON servidores hoy que el CSV NO menciona: ${noMencionadas.length}`)
  for (const [aid, s] of noMencionadas.sort((x, y) => y[1].size - x[1].size))
    console.log(`     ${String(s.size).padStart(4)} servidores  ${nombreArea.get(aid)}${esAjeno(nombreArea.get(aid) ?? '') ? '   ← lo maneja OTRO módulo' : ''}`)

  // ── 3. puestos ──────────────────────────────────────────────────────────
  // El título del puesto también viene distinto: "Colaborador Act.Sociales" vs
  // "Colaborador Act. Sociales" (un espacio), "Colaboador Finanzas" (typo).
  // Sin equivalencia, cada variante se ve como puesto NUEVO y toda su gente
  // sale como baja del puesto viejo: churn inventado que además borra el
  // start_date de la persona en ese puesto.
  const puestoPorClave = new Map<string, Puesto>()
  for (const p of puestos) {
    puestoPorClave.set(`${p.area_id}|${norm(p.title)}`, p)
    const k = `${p.area_id}|~${clave(p.title)}`
    if (!puestoPorClave.has(k)) puestoPorClave.set(k, p)
  }
  const hallarPuesto = (areaId: string, titulo: string) =>
    puestoPorClave.get(`${areaId}|${norm(titulo)}`) ?? puestoPorClave.get(`${areaId}|~${clave(titulo)}`)
  const puestosNuevos = new Map<string, number>()
  for (const f of filas) {
    const a = areaPorNombre.get(norm(f.comite)); if (!a) continue
    if (!hallarPuesto(a.id, f.puesto)) puestosNuevos.set(`${f.comite} › ${f.puesto}`, (puestosNuevos.get(`${f.comite} › ${f.puesto}`) ?? 0) + 1)
  }
  console.log(`\n── 3. PUESTOS ──`)
  console.log(`  puestos que habría que crear (en áreas que YA existen): ${puestosNuevos.size}`)
  for (const [k, n] of [...puestosNuevos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40))
    console.log(`     ${String(n).padStart(3)} personas  ${k}`)
  if (puestosNuevos.size > 40) console.log(`     … y ${puestosNuevos.size - 40} más`)

  // ── 4. altas y bajas (solo en áreas que el CSV SÍ menciona) ─────────────
  const deseado = new Set<string>()
  let sinResolverPuesto = 0
  for (const f of filas) {
    const m = resuelto.get(f.linea); if (!m) continue
    const a = areaPorNombre.get(norm(f.comite)); if (!a) { sinResolverPuesto++; continue }
    const p = hallarPuesto(a.id, f.puesto); if (!p) { sinResolverPuesto++; continue }
    deseado.add(`${m.id}|${p.id}`)
  }
  const actual = new Set(vols.filter(v => v.status === 'active').map(v => `${v.member_id}|${v.position_id}`))
  const altas = [...deseado].filter(k => !actual.has(k))
  const bajasTodas = [...actual].filter(k => !deseado.has(k))
  const enAreaDelCsv = (k: string) => {
    const aid = areaDePuesto.get(k.split('|')[1]); return aid ? usadasPorCsv.has(aid) : false
  }
  const bajas = bajasTodas.filter(enAreaDelCsv)
  const bajasFuera = bajasTodas.filter(k => !enAreaDelCsv(k))

  const nom = new Map(miembros.map(m => [m.id, nombreDe(m)]))
  const tituloPuesto = new Map(puestos.map(p => [p.id, `${nombreArea.get(p.area_id)} › ${p.title}`]))
  console.log(`\n── 4. ALTAS Y BAJAS ──`)
  console.log(`  ALTAS: ${altas.length} asignaciones (${new Set(altas.map(k => k.split('|')[0])).size} personas)`)
  console.log(`  BAJAS dentro de comités que el CSV menciona: ${bajas.length} (${new Set(bajas.map(k => k.split('|')[0])).size} personas)`)
  console.log(`  bajas que quedarían FUERA de alcance (comités que el CSV no menciona): ${bajasFuera.length}`)
  console.log(`  filas del CSV que no pude convertir en asignación (falta área o puesto): ${sinResolverPuesto}`)
  console.log(`\n  primeras 30 bajas:`)
  for (const k of bajas.slice(0, 30)) {
    const [mid, pid] = k.split('|')
    console.log(`     ${nom.get(mid) ?? mid}  ·  ${tituloPuesto.get(pid)}`)
  }

  // ── 5. acceso al sistema ────────────────────────────────────────────────
  const { rolesGrantedByPosition } = await import('@/lib/servers/position-roles')
  const ctxDe = (pid: string) => {
    const p = puestos.find(q => q.id === pid); if (!p) return null
    const a = areas.find(x => x.id === p.area_id); if (!a) return null
    return {
      title: p.title, areaName: a.name,
      areaType: a.area_type as 'area' | 'committee',
      parentAreaName: a.parent_id ? (nombreArea.get(a.parent_id) ?? null) : null,
    }
  }
  const rolesDe = (pid: string) => { const c = ctxDe(pid); return c ? rolesGrantedByPosition(c) : [] }

  /**
   * Cuidado con contar "puestos de baja que otorgaban un rol": ese número está
   * INFLADO y no sirve para revisar. revoke_position_role solo retira el rol si
   * NINGÚN otro puesto lo respalda, así que quien coordina dos comités y sale de
   * uno conserva el rol por el otro. La pérdida real es
   *   roles de los puestos que pierde  −  roles de los puestos que le quedan.
   */
  const quedaDespues = new Map<string, Set<string>>()
  for (const k of deseado) {
    const [mid, pid] = k.split('|')
    const s2 = quedaDespues.get(mid) ?? new Set<string>(); for (const r of rolesDe(pid)) s2.add(r)
    quedaDespues.set(mid, s2)
  }
  // los puestos que NO están en el diff (comités fuera de alcance) también respaldan
  for (const k of actual) {
    if (bajas.includes(k) || deseado.has(k)) continue
    const [mid, pid] = k.split('|')
    const s2 = quedaDespues.get(mid) ?? new Set<string>(); for (const r of rolesDe(pid)) s2.add(r)
    quedaDespues.set(mid, s2)
  }

  type Perdida = { nombre: string; rol: string; puesto: string }
  const perdidas: Perdida[] = []
  const tocados = new Map<string, Set<string>>()
  for (const k of bajas) {
    const [mid, pid] = k.split('|')
    for (const r of rolesDe(pid)) {
      const s2 = tocados.get(mid) ?? new Set<string>(); s2.add(r); tocados.set(mid, s2)
    }
  }
  for (const [mid, rs] of tocados) {
    const sobreviven = quedaDespues.get(mid) ?? new Set<string>()
    for (const r of rs) {
      if (sobreviven.has(r)) continue
      const dondeLoTenia = bajas
        .filter(k => k.startsWith(mid + '|') && rolesDe(k.split('|')[1]).includes(r))
        .map(k => tituloPuesto.get(k.split('|')[1]) ?? '')
      perdidas.push({ nombre: nom.get(mid) ?? mid, rol: r, puesto: dondeLoTenia.join(' + ') })
    }
  }
  perdidas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  console.log(`\n── 5. ACCESO AL SISTEMA ──`)
  console.log(`  puestos de baja que otorgaban un rol: ${tocados.size} personas`)
  console.log(`  de esas, CONSERVAN el rol por otro puesto: ${tocados.size - new Set(perdidas.map(p => p.nombre)).size}`)
  console.log(`  ⚠ PIERDEN ACCESO DE VERDAD: ${new Set(perdidas.map(p => p.nombre)).size} personas · ${perdidas.length} roles`)
  const porRol: Record<string, number> = {}
  for (const p of perdidas) porRol[p.rol] = (porRol[p.rol] ?? 0) + 1
  console.log(`  por rol: ${JSON.stringify(porRol)}`)

  const salida = 'scripts/output/roles-que-se-pierden-2026-08-26.csv'
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync('scripts/output', { recursive: true })
  const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
  writeFileSync(salida, '\uFEFF' + ['nombre,rol,puesto_que_lo_daba']
    .concat(perdidas.map(p => [p.nombre, p.rol, p.puesto].map(esc).join(','))).join('\n'), 'utf8')
  console.log(`  → lista completa para revisar: ${salida}`)

  const filaCsv = (k: string) => {
    const [mid, pid] = k.split('|')
    const p = puestos.find(q => q.id === pid)
    return [nom.get(mid) ?? mid, nombreArea.get(p?.area_id ?? '') ?? '', p?.title ?? '']
  }
  for (const [archivo, claves] of [['bajas', bajas], ['altas', altas]] as Array<[string, string[]]>) {
    const ruta = `scripts/output/${archivo}-servidores-2026-08-26.csv`
    writeFileSync(ruta, '\uFEFF' + ['nombre,comite,puesto']
      .concat(claves.map(k => filaCsv(k).map(esc).join(','))).join('\n'), 'utf8')
    console.log(`  → ${ruta} (${claves.length})`)
  }

  console.log(`\n═══ NADA DE ESTO SE ESCRIBIÓ. Comités fuera de alcance por diseño: ${COMITES_AJENOS.join(', ')} ═══\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
