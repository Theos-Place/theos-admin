/**
 * INVENTARIO PREVIO · qué de esta migración YA está en la base.
 *
 * Solo lectura: no escribe una sola fila. Sirve para decidir el alcance real de
 * la corrida antes de tocar nada.
 *
 * Uso:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/ccb-migracion-2026-08/inventario.ts
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import {
  leerCsv, norm, planDe, inicioDe, esVirtual, nombreDerecho,
  esListaAdministrativa, esDirigenteInstitucional, DIRIGENTES_POR_EXTERNAL_ID,
} from './lib'

type Row = Record<string, string>
const admin = createAdminClient() as unknown as {
  from: (t: string) => any
}

async function todo<T>(tabla: string, select: string, filtro?: (q: any) => any): Promise<T[]> {
  const out: T[] = []
  for (let desde = 0; ; desde += 1000) {
    let q = admin.from(tabla).select(select).range(desde, desde + 999).order('id')
    if (filtro) q = filtro(q)
    const { data, error } = await q
    if (error) throw new Error(`${tabla}: ${error.message}`)
    out.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return out
}

async function main() {
  const grupos = leerCsv('ccb-grupos-abiertos-2026-08.csv')
  const parts = leerCsv('ccb-participantes-grupos-2026-08.csv')
  const grads = leerCsv('ccb-graduaciones-2026-08.csv')
  console.log(`archivos: ${grupos.length} grupos · ${parts.length} participantes · ${grads.length} graduaciones\n`)

  // ── Catálogos ──────────────────────────────────────────────────────────────
  const { data: planRows } = await admin.from('study_plans').select('id, code')
  const planPorCode = new Map<string, string>((planRows ?? []).map((p: any) => [p.code, p.id]))

  const miembros = await todo<any>('members', 'id, external_id, first_name, last_name, is_active')
  const porExternal = new Map<string, any>()
  const porNombre = new Map<string, any[]>()
  for (const m of miembros) {
    if (m.external_id) porExternal.set(String(m.external_id).trim(), m)
    const n = norm(`${m.first_name ?? ''} ${m.last_name ?? ''}`)
    if (n) porNombre.set(n, [...(porNombre.get(n) ?? []), m])
  }
  console.log(`base: ${miembros.length} miembros · ${porExternal.size} con external_id\n`)

  const gruposBd = await todo<any>('study_groups', 'id, name, plan_id, leader_id, starts_at, status, sede')
  const enrolls = await todo<any>('study_enrollments', 'id, member_id, group_id, plan_id, status')
  const porGrupoMiembro = new Set(enrolls.map(e => `${e.member_id}|${e.group_id}`))

  // ── A · GRUPOS ─────────────────────────────────────────────────────────────
  // ccb_group_id todavía no existe como columna, así que la única vía hoy es la
  // equivalencia: mismo plan + mismo dirigente + mismo mes de inicio.
  const claveEq = (planId: string, leaderId: string | null, inicio: string | null) =>
    `${planId}|${leaderId ?? '-'}|${(inicio ?? '').slice(0, 7)}`
  const eqBd = new Map<string, any[]>()
  for (const g of gruposBd) {
    if (!g.plan_id) continue
    const k = claveEq(g.plan_id, g.leader_id, g.starts_at)
    eqBd.set(k, [...(eqBd.get(k) ?? []), g])
  }

  let yaPorEq = 0, sinDirigente = 0, sinPlan = 0, aCrear = 0
  const detalleSinDirigente: string[] = []
  const detalleEq: string[] = []
  for (const g of grupos) {
    const code = planDe(g.group_name)
    if (!code || !planPorCode.has(code)) { sinPlan++; continue }
    const nombreLider = norm(`${g.leader_first} ${g.leader_last}`)
    // Primero la tabla explícita de los seis que no calzan por nombre; después
    // el match normal. En ese orden: el override manda.
    const forzado = DIRIGENTES_POR_EXTERNAL_ID[nombreLider]
    const cands = porNombre.get(nombreLider) ?? []
    const lider = (forzado ? porExternal.get(forzado) : null)
      ?? cands.find(m => m.is_active) ?? cands[0] ?? null
    if (!lider) { sinDirigente++; detalleSinDirigente.push(`${g.group_name} → «${g.leader_first} ${g.leader_last}»`); continue }
    const hit = eqBd.get(claveEq(planPorCode.get(code)!, lider.id, inicioDe(g.group_name)))
    if (hit?.length) { yaPorEq++; detalleEq.push(`${g.group_name}  ≡  ${hit[0].name} [${hit[0].status}]`) }
    else aCrear++
  }

  console.log('══ A · GRUPOS (102 abiertos) ══')
  console.log(`  ya existen por equivalencia (plan+dirigente+mes): ${yaPorEq}`)
  console.log(`  a crear:                                          ${aCrear}`)
  console.log(`  sin dirigente encontrado:                         ${sinDirigente}`)
  console.log(`  sin plan resuelto:                                ${sinPlan}`)
  if (detalleEq.length) {
    console.log('\n  equivalentes encontrados (se ENLAZAN, no se duplican):')
    for (const d of detalleEq.slice(0, 15)) console.log(`    · ${d}`)
    if (detalleEq.length > 15) console.log(`    … y ${detalleEq.length - 15} más`)
  }
  if (detalleSinDirigente.length) {
    console.log('\n  SIN DIRIGENTE (reporte, no se crean):')
    for (const d of detalleSinDirigente) console.log(`    · ${d}`)
  }

  // ── B · PARTICIPANTES ──────────────────────────────────────────────────────
  const members = parts.filter(p => p.rol === 'Member')
  const leaders = parts.filter(p => p.rol === 'Leader')
  const listas = new Set(parts.filter(p => esListaAdministrativa(p.group_name)).map(p => p.group_name))
  let sinPersona = 0, yaMatriculado = 0, aMatricular = 0
  const detalleSinPersona: string[] = []
  for (const p of members) {
    if (esListaAdministrativa(p.group_name)) continue
    const m = porExternal.get(p.external_id)
    if (!m) { sinPersona++; if (detalleSinPersona.length < 12) detalleSinPersona.push(`${p.external_id} · ${p.name}`); continue }
    const code = planDe(p.group_name)
    const planId = code ? planPorCode.get(code) : null
    const nombreGrupo = p.group_name
    // ¿Ya tiene matrícula en un grupo EQUIVALENTE a ese nombre?
    const inicio = inicioDe(nombreGrupo)
    const posibles = gruposBd.filter(g =>
      g.plan_id === planId && (g.starts_at ?? '').slice(0, 7) === (inicio ?? '').slice(0, 7))
    const ya = posibles.some(g => porGrupoMiembro.has(`${m.id}|${g.id}`))
    if (ya) yaMatriculado++; else aMatricular++
  }
  console.log('\n══ B · PARTICIPANTES ══')
  console.log(`  filas 'Member':            ${members.length}`)
  console.log(`  filas 'Leader' (no se matriculan): ${leaders.length}`)
  console.log(`  ya matriculados (grupo equivalente): ${yaMatriculado}`)
  console.log(`  a matricular:                        ${aMatricular}`)
  console.log(`  sin persona por external_id:         ${sinPersona}`)
  if (detalleSinPersona.length) for (const d of detalleSinPersona) console.log(`    · ${d}`)
  if (listas.size) {
    console.log(`\n  listas administrativas detectadas por nombre: ${listas.size}`)
    for (const l of [...listas].slice(0, 10)) console.log(`    · ${l}`)
  }

  // ── C · GRADUACIONES ───────────────────────────────────────────────────────
  const done = grads.filter(g => g.status === 'Done')
  const notStarted = grads.filter(g => g.status === 'Not Started')
  const otros = grads.filter(g => g.status !== 'Done' && g.status !== 'Not Started')
  let sinPersonaG = 0, yaCerrada = 0, conAbierta = 0, ninguna = 0, varias = 0
  const porMiembro = new Map<string, any[]>()
  for (const e of enrolls) porMiembro.set(e.member_id, [...(porMiembro.get(e.member_id) ?? []), e])

  for (const g of done) {
    const m = porExternal.get(g.external_id)
    if (!m) { sinPersonaG++; continue }
    const code = planDe(g.queue_name)
    const planId = code ? planPorCode.get(code) : null
    if (!planId) continue // colas genéricas (Reprueba Nivel 1-4) — se cuentan aparte
    const suyas = (porMiembro.get(m.id) ?? []).filter(e => e.plan_id === planId)
    const cerradas = suyas.filter(e => e.status === 'completed' || e.status === 'reprobado')
    const abiertas = suyas.filter(e => e.status === 'enrolled')
    if (cerradas.length && !abiertas.length) yaCerrada++
    else if (abiertas.length === 1) conAbierta++
    else if (abiertas.length > 1) varias++
    else ninguna++
  }
  const genericas = done.filter(g => !planDe(g.queue_name)).length
  console.log('\n══ C · GRADUACIONES ══')
  console.log(`  status Done:        ${done.length}`)
  console.log(`  status Not Started: ${notStarted.length}  (anomalía del export — se excluyen)`)
  if (otros.length) console.log(`  otros status:       ${otros.length} → ${[...new Set(otros.map(o => o.status))].join(', ')}`)
  console.log(`\n  de las Done, con cola de plan reconocible:`)
  console.log(`    ya cerradas en la base (NO se tocan):  ${yaCerrada}`)
  console.log(`    con UNA matrícula abierta (aplicables): ${conAbierta}`)
  console.log(`    con VARIAS abiertas (revisión manual):  ${varias}`)
  console.log(`    sin ninguna matrícula (grupo cerrado no migrado): ${ninguna}`)
  console.log(`    sin persona por external_id:            ${sinPersonaG}`)
  console.log(`  colas genéricas sin nivel (Reprueba…):    ${genericas}`)
  console.log('\n  NOTA: este conteo es PREVIO a la Etapa 2. Después de matricular, las')
  console.log('  matrículas nuevas quedan EXCLUIDAS del universo de candidatas (regla de oro).')
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
