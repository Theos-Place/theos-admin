/**
 * Aplica la sincronización. SIN --commit no escribe nada.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/sync-servidores-2026-08/aplicar.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/sync-servidores-2026-08/aplicar.ts --commit
 *
 * IDEMPOTENTE: corrérlo dos veces seguidas no crea un solo registro nuevo la
 * segunda vez. Todo lo que escribe consulta primero si ya está.
 *
 * NO TOCA DATOS PERSONALES: `Mobile` y `Email` del export solo se usan para
 * matchear. Tampoco crea miembros: quien no resuelve se reporta.
 */
import { cargarEnv, norm, clave, leerCsv, todo, esAjeno, COMITES_AJENOS, AREAS_A_CREAR, RENOMBRES } from './lib'

cargarEnv()
const COMMIT = process.argv.includes('--commit')
const CSV = process.env.CSV_SERVIDORES ?? 'data-import/servidores-2026-08-26.csv'

/** Áreas padre a crear cuando la categoría del export no existe entre las
 *  nuestras. Aprobado: "Dirección" entra como área nueva. */
const CATEGORIAS_A_CREAR: Record<string, string> = { 'Dirección': 'Dirección' }

type Area = { id: string; name: string; area_type: string; parent_id: string | null }
type Puesto = { id: string; area_id: string; title: string; is_active: boolean | null }
type Vol = { member_id: string; position_id: string; status: string; start_date: string | null }

async function main() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { syncRolesOnAssign, syncRolesOnRemove } = await import('@/lib/supabase/queries/position-role-sync')
  const db = createAdminClient()
  const hoyCR = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10)

  const filas = leerCsv(CSV).filter(f => !esAjeno(f.comite))
  const miembros = await todo<{ id: string; external_id: string | null; first_name: string | null; last_name: string | null }>(
    (a, b) => db.from('members').select('id,external_id,first_name,last_name').range(a, b))
  let areas = await todo<Area>((a, b) => db.from('areas').select('id,name,area_type,parent_id').range(a, b))
  const puestos = await todo<Puesto>((a, b) => db.from('service_positions').select('id,area_id,title,is_active').range(a, b))
  const vols = await todo<Vol>((a, b) => db.from('volunteers').select('member_id,position_id,status,start_date').range(a, b))

  const nom = new Map(miembros.map(m => [m.id, `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()]))
  const porExt = new Map(miembros.filter(m => m.external_id).map(m => [String(m.external_id).trim(), m]))
  let simulados = 0
  const paso = (s: string) => console.log(COMMIT ? `  ${s}` : `  [dry] ${s}`)

  // ── 1. renombres de área ────────────────────────────────────────────────
  // Decidido: los nombres de comité/área se toman como los manda CCB. Las 12
  // sedes NO se renombran (viven en ALIAS_COMITE, así que acá ya llegan con
  // nuestro nombre y nunca aparecen como diferencia).
  const hallarArea = (n: string) =>
    areas.find(a => norm(a.name) === norm(n)) ?? areas.find(a => clave(a.name) === clave(n))
  const comitesCsv = [...new Set(filas.map(f => f.comite))]
  console.log(`\n── 1. RENOMBRES DE ÁREA ──`)

  /**
   * SEGURO. La regla de `encargado_eventos` exige que el área padre del comité
   * de sede se llame "Área Espiritual" (comparado sin acentos ni mayúsculas).
   * Hoy el renombre a "Area Espiritual" pasa esa comparación por casualidad. Si
   * un export futuro manda "Area de Espiritual" o "Espiritual", el renombre se
   * aplicaría callado y TODAS las sedes dejarían de otorgar ese rol. Acá se
   * corta antes de escribir.
   */
  const CRITICAS = ['Área Espiritual']
  const pares: Array<[Area, string]> = []
  for (const [viejo, nuevo] of Object.entries(RENOMBRES)) {
    const a = hallarArea(viejo)
    if (a && a.name !== nuevo) pares.push([a, nuevo])
  }
  for (const c of comitesCsv) {
    const a = hallarArea(c)
    if (a && a.name !== c && !pares.some(([x]) => x.id === a.id)) pares.push([a, c])
  }
  for (const [a, nuevo] of pares) {
    if (CRITICAS.some(cn => norm(cn) === norm(a.name)) && norm(nuevo) !== norm(a.name)) {
      throw new Error(
        `ABORTADO: renombrar "${a.name}" → "${nuevo}" cambia el nombre normalizado de un área ` +
        `de la que dependen las reglas de rol (position-roles.ts). Las sedes dejarían de otorgar ` +
        `encargado_eventos. Si el cambio es a propósito, hay que actualizar la regla primero.`)
    }
  }
  for (const [a, c] of pares) {
    paso(`renombrar "${a.name}" → "${c}"`)
    if (COMMIT) {
      const { error } = await db.from('areas').update({ name: c }).eq('id', a.id)
      if (error) throw new Error(`renombrando ${a.name}: ${error.message}`)
    }
    a.name = c
  }

  // ── 2. áreas nuevas ─────────────────────────────────────────────────────
  console.log(`\n── 2. ÁREAS NUEVAS ──`)
  const catDe = new Map<string, string>()
  for (const f of filas) if (f.categoria && !catDe.has(f.comite)) catDe.set(f.comite, f.categoria)

  const crearArea = async (nombre: string, tipo: 'area' | 'committee', padreId: string | null) => {
    const ya = hallarArea(nombre)
    if (ya) { paso(`ya existe "${nombre}" — no se crea`); return ya }
    paso(`CREAR ${tipo} "${nombre}"${padreId ? ` bajo "${areas.find(a => a.id === padreId)?.name}"` : ''}`)
    // En dry-run se SIMULA la creación con un id falso. Sin esto, las filas del
    // CSV que apuntan a un área nueva no resuelven y el reporte miente: informa
    // 141 "sin resolver" y cuenta de menos las altas y las fechas heredadas.
    if (!COMMIT) {
      const falsa: Area = { id: `nueva-${simulados++}`, name: nombre, area_type: tipo, parent_id: padreId }
      areas.push(falsa); return falsa
    }
    const { data, error } = await db.from('areas')
      .insert({ name: nombre, area_type: tipo, parent_id: padreId, is_active: true })
      .select('id,name,area_type,parent_id').single()
    if (error) throw new Error(`creando área ${nombre}: ${error.message}`)
    areas.push(data as Area)
    return data as Area
  }

  for (const c of comitesCsv) {
    if (hallarArea(c)) continue
    const plan = AREAS_A_CREAR[c]
    if (hallarArea(c)) continue
    const nombre = c
    let padre = plan ? hallarArea(plan.padre) : (catDe.get(c) ? hallarArea(catDe.get(c)!) : null)
    if (!padre) {
      const cat = catDe.get(c) ?? ''
      const aCrear = CATEGORIAS_A_CREAR[cat]
      if (!aCrear) { console.log(`  ⚠ SALTADO: "${c}" — su categoría "${cat}" no existe y no está aprobada para crearse`); continue }
      padre = await crearArea(aCrear, 'area', null)
      if (!padre && COMMIT) throw new Error(`no se pudo crear el área padre ${aCrear}`)
    }
    await crearArea(nombre, 'committee', padre?.id ?? null)
  }
  if (COMMIT) areas = await todo<Area>((a, b) => db.from('areas').select('id,name,area_type,parent_id').range(a, b))
  // el índice de puestos se rearma con las áreas nuevas ya presentes


  // ── 3. puestos nuevos ───────────────────────────────────────────────────
  const clavePuesto = (aid: string, t: string) => `${aid}|${norm(t)}`
  const idxPuesto = () => {
    const m = new Map<string, Puesto>()
    for (const p of puestos) {
      m.set(clavePuesto(p.area_id, p.title), p)
      const k = `${p.area_id}|~${clave(p.title)}`
      if (!m.has(k)) m.set(k, p)
    }
    return m
  }
  let idx = idxPuesto()
  const hallarPuesto = (aid: string, t: string) => idx.get(clavePuesto(aid, t)) ?? idx.get(`${aid}|~${clave(t)}`)

  console.log(`\n── 3. PUESTOS NUEVOS ──`)
  const faltantes = new Map<string, { areaId: string; titulo: string }>()
  for (const f of filas) {
    const a = hallarArea(f.comite); if (!a) continue
    if (hallarPuesto(a.id, f.puesto)) continue
    faltantes.set(`${a.id}|${norm(f.puesto)}`, { areaId: a.id, titulo: f.puesto })
  }
  for (const { areaId, titulo } of faltantes.values()) {
    paso(`CREAR puesto "${titulo}" en "${areas.find(a => a.id === areaId)?.name}"`)
    // OJO con el id simulado: NO puede contener "|". Las llaves del diff son
    // `miembro|puesto` y se parten con split('|'), así que un id con pipe
    // adentro se partía mal y la herencia de fechas medía cualquier cosa (daba
    // 24 cuando eran 117). Los uuid reales no traen pipe; los falsos tampoco.
    if (!COMMIT) puestos.push({ id: `nuevo-${simulados++}`, area_id: areaId, title: titulo, is_active: true })
    if (COMMIT) {
      const { data, error } = await db.from('service_positions')
        .insert({ area_id: areaId, title: titulo, is_active: true }).select('id,area_id,title,is_active').single()
      if (error) throw new Error(`creando puesto ${titulo}: ${error.message}`)
      puestos.push(data as Puesto)
    }
  }
  idx = idxPuesto()

  // ── 4. diff ─────────────────────────────────────────────────────────────
  const deseado = new Set<string>()
  const sinResolver: string[] = []
  for (const f of filas) {
    const m = porExt.get(f.externalId)
    const a = hallarArea(f.comite)
    const p = a ? hallarPuesto(a.id, f.puesto) : undefined
    if (!m || !a || !p) { sinResolver.push(`línea ${f.linea}: ${f.nombre} · ${f.comite} › ${f.puesto}`); continue }
    deseado.add(`${m.id}|${p.id}`)
  }
  const activos = vols.filter(v => v.status === 'active')
  const actual = new Set(activos.map(v => `${v.member_id}|${v.position_id}`))
  const areaDePuesto = new Map(puestos.map(p => [p.id, p.area_id]))
  const areasDelCsv = new Set(comitesCsv.map(c => hallarArea(c)?.id).filter(Boolean) as string[])

  const altas = [...deseado].filter(k => !actual.has(k))
  const bajas = [...actual].filter(k => {
    if (deseado.has(k)) return false
    const aid = areaDePuesto.get(k.split('|')[1])
    return aid ? areasDelCsv.has(aid) : false
  })

  /**
   * PRESERVAR LA ANTIGÜEDAD. CCB repuestó por sede ("Orador Este" → "Orador
   * Antares"), y de 26 puestos nuevos solo 6 son renombres limpios 1:1: los
   * otros 15 son splits, así que renombrar el puesto no sirve. Se hereda a
   * nivel de PERSONA: si alguien entra a un puesto nuevo y en ESA MISMA área
   * está saliendo de otro, se le pasa la fecha de inicio más vieja. Sin esto,
   * ~190 personas quedarían como que empezaron a servir hoy.
   */
  const inicioActual = new Map(activos.map(v => [`${v.member_id}|${v.position_id}`, v.start_date]))
  const tituloDe = new Map(puestos.map(p => [p.id, p.title]))

  /**
   * Dos vías de herencia, en este orden. La primera sola no alcanzaba: cubría
   * 24 de 288 altas, porque la sede nueva (Meridiano Miércoles) se lleva gente
   * de Meridiano Martes, que es OTRA área.
   *
   *   a) MISMO PUESTO, otra área. "Colaborador Comida" en Martes →
   *      "Colaborador Comida" en Miércoles: es el mismo trabajo que se mudó de
   *      día. La antigüedad viaja con la persona.
   *   b) MISMA ÁREA, otro puesto. Cubre los splits de Oración: "Orador Este" →
   *      "Orador Antares", donde el comité es el mismo y solo cambió la zona.
   *
   * Lo que NO se hereda: cambiar de comité Y de puesto a la vez. Ahí sí es un
   * servicio nuevo y la fecha es hoy.
   */
  const bajasDe = new Map<string, Array<{ areaId: string; titulo: string; inicio: string | null }>>()
  for (const k of bajas) {
    const [mid, pid] = k.split('|')
    const aid = areaDePuesto.get(pid); if (!aid) continue
    const l = bajasDe.get(mid) ?? []
    l.push({ areaId: aid, titulo: tituloDe.get(pid) ?? '', inicio: inicioActual.get(k) ?? null })
    bajasDe.set(mid, l)
  }
  const masVieja = (fs: Array<string | null>) => fs.filter(Boolean).sort()[0] ?? null
  const fechaHeredada = (mid: string, pid: string): { fecha: string | null; via: string } => {
    const l = bajasDe.get(mid) ?? []
    if (l.length === 0) return { fecha: null, via: '' }
    const aid = areaDePuesto.get(pid)
    const titulo = tituloDe.get(pid) ?? ''
    const mismoPuesto = masVieja(l.filter(b => clave(b.titulo) === clave(titulo)).map(b => b.inicio))
    if (mismoPuesto) return { fecha: mismoPuesto, via: 'mismo puesto' }
    const mismaArea = masVieja(l.filter(b => b.areaId === aid).map(b => b.inicio))
    if (mismaArea) return { fecha: mismaArea, via: 'misma área' }
    return { fecha: null, via: '' }
  }

  console.log(`\n── 4. ALTAS ──`)
  const vias: Record<string, number> = {}
  for (const k of altas) {
    const [mid, pid] = k.split('|')
    const { fecha: heredo, via } = fechaHeredada(mid, pid)
    if (via) vias[via] = (vias[via] ?? 0) + 1
    if (COMMIT) {
      const { error } = await db.from('volunteers').upsert(
        { member_id: mid, position_id: pid, status: 'active', start_date: heredo ?? hoyCR, end_date: null },
        { onConflict: 'member_id,position_id' })
      if (error) throw new Error(`alta ${nom.get(mid)}: ${error.message}`)
      await syncRolesOnAssign(mid, pid)
    }
  }
  // diagnóstico: separar "no hereda porque no tiene de dónde" de "no hereda por la regla"
  const conBaja = altas.filter(k => (bajasDe.get(k.split('|')[0]) ?? []).length > 0)
  const conBajaConFecha = conBaja.filter(k => (bajasDe.get(k.split('|')[0]) ?? []).some(b => b.inicio))
  paso(`de las ${altas.length} altas: ${conBaja.length} son de gente que TIENE alguna baja · ${conBajaConFecha.length} con fecha en esa baja`)
  if (process.env.VER_BLOQUEADAS) {
    for (const k of conBajaConFecha) {
      const [mid, pid] = k.split('|')
      if (fechaHeredada(mid, pid).via) continue
      const de = (bajasDe.get(mid) ?? []).map(b => `${areas.find(a => a.id === b.areaId)?.name} › ${b.titulo} (${b.inicio})`)
      console.log(`  BLOQUEADA  ${nom.get(mid)}  →  ${areas.find(a => a.id === areaDePuesto.get(pid))?.name} › ${tituloDe.get(pid)}`)
      console.log(`             venía de: ${de.join(' | ')}`)
    }
  }
  const heredadas = Object.values(vias).reduce((a, b) => a + b, 0)
  paso(`${altas.length} altas · ${heredadas} heredan fecha (${JSON.stringify(vias)}) · ${altas.length - heredadas} desde hoy (${hoyCR})`)

  console.log(`\n── 5. BAJAS ──`)
  for (const k of bajas) {
    const [mid, pid] = k.split('|')
    if (COMMIT) {
      const { error } = await db.from('volunteers')
        .update({ status: 'inactive', end_date: hoyCR }).eq('member_id', mid).eq('position_id', pid)
      if (error) throw new Error(`baja ${nom.get(mid)}: ${error.message}`)
      await syncRolesOnRemove(mid, pid)
    }
  }
  paso(`${bajas.length} bajas (status inactive + end_date, igual que la app)`)

  // ── CSV para revisar ────────────────────────────────────────────────────
  // Se exportan desde ACÁ y no del reporte aparte, porque este script es el que
  // simula las creaciones: el otro contaba 153 altas donde son 288, porque sin
  // los puestos nuevos la mitad de las filas no resolvía.
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync('scripts/output', { recursive: true })
  const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
  const areaNom = new Map(areas.map(a => [a.id, a.name]))
  const desc = (k: string) => {
    const [mid, pid] = k.split('|')
    return [nom.get(mid) ?? mid, areaNom.get(areaDePuesto.get(pid) ?? '') ?? '', tituloDe.get(pid) ?? '']
  }
  writeFileSync('scripts/output/bajas-servidores-2026-08-26.csv', '\uFEFF' +
    ['nombre,comite,puesto'].concat(bajas.map(k => desc(k).map(esc).join(','))).join('\n'), 'utf8')
  writeFileSync('scripts/output/altas-servidores-2026-08-26.csv', '\uFEFF' +
    ['nombre,comite,puesto,fecha_inicio,origen_de_la_fecha'].concat(altas.map(k => {
      const [mid, pid] = k.split('|')
      const h = fechaHeredada(mid, pid)
      return [...desc(k), h.fecha ?? hoyCR, h.via || 'nueva (hoy)'].map(esc).join(',')
    })).join('\n'), 'utf8')
  console.log(`\n  → scripts/output/bajas-servidores-2026-08-26.csv (${bajas.length})`)
  console.log(`  → scripts/output/altas-servidores-2026-08-26.csv (${altas.length})`)

  console.log(`\n── SIN RESOLVER (${sinResolver.length}) ──`)
  for (const s of sinResolver.slice(0, 20)) console.log(`  ${s}`)
  if (sinResolver.length > 20) console.log(`  … y ${sinResolver.length - 20} más`)

  console.log(`\n${COMMIT ? '═══ APLICADO ═══' : '═══ DRY-RUN: nada escrito. Agregá --commit ═══'}`)
  console.log(`Fuera de alcance por diseño: ${COMITES_AJENOS.join(', ')}\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
