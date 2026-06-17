/**
 * Importa PROCESOS DE ESTUDIO HISTÓRICOS SIN GRUPO desde process_detail.csv.
 * Son los (Ind ID, tipo de estudio) que NO quedaron representados por ningún
 * study_enrollment tras el reseed de grupos (scripts/reimport-studies.ts):
 * personas que llevaron/aprobaron un estudio cuyo grupo no existe en el sistema
 * (muchos pre-2014, pero pueden ser de cualquier año).
 *
 * Crea inscripciones DIRECTAS: study_enrollments con group_id = NULL y plan_id
 * directo (migración 032), status 'completed', completed_at = Due real, notes
 * "Proceso histórico sin grupo registrado".
 *
 * Mapeo Queue Name → plan:
 *  - Estudios normales → plan, status 'completed'.
 *  - "Reprueba Nivel 1 - 4" / "Reprueba Capacitación" → marcan reprobados, pero
 *    son GENÉRICOS (no dicen el nivel) → no se puede inferir el plan → se LOGUEAN
 *    (no se crea enrollment). Su ubicación/log la maneja el reseed de grupos
 *    (reprobaciones-sin-ubicar.csv), que sí tiene grupos para cruzar.
 *  - "¿Adónde va este bus?" (BUS) → charla introductoria no curricular → EXCLUIR.
 *  - Por invitación (CDEB, CDC, HER) → importar como completados (sus planes existen).
 *  - Queues sin plan en el catálogo (Pasantía como Dirigente, Movimiento de
 *    Discípulos Multiplicadores) → LOGUEAR scripts/output/process-sin-mapeo.csv,
 *    NO inventar planes.
 *
 * Idempotencia (crítico): antes de insertar, NO crear si la persona ya tiene un
 * enrollment de ese plan. Regla de duplicado:
 *  - Planes de CAMPAÑA (level 'campanas'): por member + plan + AÑO de la fecha.
 *    Una campaña pudo repetirse en años distintos (Transformados 2017 y 2025) y
 *    queremos AMBOS enrollments; solo se salta si ya existe ese plan en el MISMO año.
 *  - Resto de planes: por member + plan (cualquier año) — si ya está representado
 *    (con o sin grupo), se salta.
 *  NOTA: este criterio por año es EXCLUSIVO de este import histórico (datos viejos
 *  sin granularidad de mes confiable). El flujo de campañas futuras NO usa dedup
 *  por año: cada edición es un study_group propio (ej. "Transformados 2027").
 *
 * Match de personas: "Ind ID" → members.external_id. Sin match → scripts/output/.
 * Privacidad: CSV en scripts/data/ (gitignored); logs solo conteos.
 *
 * Dry-run (no escribe nada):  npx tsx scripts/import-historical-processes.ts --dry-run
 * Ejecución real:             npx tsx scripts/import-historical-processes.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const FILE = new URL('./data/process_detail.csv', import.meta.url)
const NOTE = 'Proceso histórico sin grupo registrado'

for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

const str = (v: unknown): string => (v == null ? '' : String(v).trim())
const extId = (v: unknown): string => str(v).replace(/\.0$/, '')
const toDate = (v: unknown): string | null => {
  const m = str(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  // Rechaza fechas inválidas del CSV (p.ej. "0000-00-00").
  if (m[1] === '0000' || m[2] === '00' || m[3] === '00') return null
  return `${m[1]}-${m[2]}-${m[3]}`
}
const yearOf = (d: string | null): string => d ? d.slice(0, 4) : '?'

// Queue Name → código de plan (mismo mapeo del reseed + planes archivados que
// ya existen en el catálogo).
const QUEUE_MAP: Record<string, string> = {
  'Nivel 1': 'N1', 'Nivel 2': 'N2', 'Nivel 3': 'N3', 'Nivel 4': 'N4', 'Sirviendo como Jesús': 'SCJ',
  'Discípulos 1': 'DIS1', 'Discípulos 2': 'DIS2', 'Discipulos 3': 'DIS3', 'Discípulos 3': 'DIS3',
  'Panorama': 'PAN', 'Administrando el Dinero': 'AED', 'Matrimonios': 'MAT', 'Religiones del Mundo': 'RDM',
  'Evangelismo': 'EVM', '¿Cómo interpretar la Biblia? (Hermenéutica)': 'HER', 'Evangelios': 'EVA', 'Hechos': 'HCH',
  'Defendiendo la Fe (Apologética)': 'DLF', 'Cómo Tomar Buenas Desiciones (Viviendo en Integri)': 'CTBD',
  'Pre Matrimonial': 'PREMAT', 'Hebreos': 'HEB', 'Romanos': 'ROM', 'Amor sin Fronteras': 'ASF',
  'Efesios': 'EFE', 'Galatas': 'GAL', 'Gálatas': 'GAL', 'Apocalipsis': 'APO', '¿Adónde va este bus?': 'BUS',
  'Bienestar Integral': 'CTBD', '¿Cómo dar Estudios Bíblicos?': 'CDEB', '¿Cómo dar Charlas?': 'CDC',
  '¿Quien es Jesús?': 'QEJ', '¿Quién es Jesús?': 'QEJ', 'Lecturas con Propósito': 'LECTPROP',
  'Seminario - Teologia AT - Esepa': 'TEOAT', // curso externo (plan TEOAT existe, archivado)
}
const REPRUEBA = new Set(['Reprueba Nivel 1 - 4', 'Reprueba Capacitación'])
const EXCLUDE_CODES = new Set(['BUS']) // charla introductoria no curricular

async function main() {
  if (!existsSync(FILE)) { console.error(`Falta ${FILE.pathname} (gitignored).`); process.exit(1) }
  const recs: Record<string, string>[] = parse(readFileSync(FILE, 'utf8'), { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true })
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}process_detail: ${recs.length.toLocaleString('es-CR')} filas`)

  // Planes: code → {id, level}
  const { data: plans, error: pErr } = await supabase.from('study_plans').select('id, code, level')
  if (pErr) throw pErr
  const planByCode = new Map<string, { id: string; level: string }>()
  for (const p of plans as Array<{ id: string; code: string | null; level: string }>) if (p.code) planByCode.set(p.code, { id: p.id, level: p.level })

  // Miembros: external_id → uuid (paginado)
  const extToId = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('members').select('id, external_id').not('external_id', 'is', null).order('id').range(from, from + 999)
    if (error) throw error
    for (const m of data as Array<{ id: string; external_id: string }>) extToId.set(String(m.external_id), m.id)
    if (data.length < 1000) break
  }
  console.log(`Miembros con external_id: ${extToId.size.toLocaleString('es-CR')}`)

  // Enrollments existentes → sets de dedup. Resuelve plan_id (grupo o directo) y año.
  const groupPlan = new Map<string, string>() // group_id → plan_id
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('study_groups').select('id, plan_id').order('id').range(from, from + 999)
    if (error) throw error
    for (const g of data as Array<{ id: string; plan_id: string }>) groupPlan.set(g.id, g.plan_id)
    if (data.length < 1000) break
  }
  const existPlan = new Set<string>()      // `${member}|${planId}`  (no-campaña)
  const existPlanYear = new Set<string>()  // `${member}|${planId}|${year}` (campaña)
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('study_enrollments')
      .select('member_id, group_id, plan_id, completed_at, enrolled_at, dropped_at').order('id').range(from, from + 999)
    if (error) throw error
    const rows = data as Array<{ member_id: string; group_id: string | null; plan_id: string | null; completed_at: string | null; enrolled_at: string | null; dropped_at: string | null }>
    for (const e of rows) {
      const planId = e.group_id ? groupPlan.get(e.group_id) : e.plan_id
      if (!e.member_id || !planId) continue
      existPlan.add(`${e.member_id}|${planId}`)
      const y = yearOf(toDate(e.completed_at) ?? toDate(e.enrolled_at) ?? toDate(e.dropped_at))
      existPlanYear.add(`${e.member_id}|${planId}|${y}`)
    }
    if (rows.length < 1000) break
  }
  console.log(`Enrollments existentes indexados: ${existPlan.size.toLocaleString('es-CR')} (member+plan)`)

  // Candidatos desde process_detail.
  type Cand = { memberId: string; planId: string; due: string | null; campaign: boolean }
  const candByKey = new Map<string, Cand>() // dedupe interno
  const noMatch = new Set<string>()
  const sinMapeo = new Map<string, number>()   // queue → count
  let excluded = 0, reproveCnt = 0

  for (const r of recs) {
    const queue = str(r['Queue Name'])
    const ind = extId(r['Ind ID'])
    const due = toDate(r['Due'])
    // Reprobaciones genéricas: NO se pueden ubicar sin grupo+año → no se crea nada
    // acá. Su ubicación/log lo maneja el reseed (reprobaciones-sin-ubicar.csv).
    if (REPRUEBA.has(queue)) { reproveCnt++; continue }
    const code = QUEUE_MAP[queue]
    if (!code) { sinMapeo.set(queue, (sinMapeo.get(queue) ?? 0) + 1); continue }
    if (EXCLUDE_CODES.has(code)) { excluded++; continue }
    const plan = planByCode.get(code)
    if (!plan) { sinMapeo.set(`${queue} (sin plan ${code})`, (sinMapeo.get(queue) ?? 0) + 1); continue }
    if (!/^\d+$/.test(ind)) continue
    const memberId = extToId.get(ind)
    if (!memberId) { noMatch.add(ind); continue }

    const campaign = plan.level === 'campanas'
    const key = campaign ? `${memberId}|${plan.id}|${yearOf(due)}` : `${memberId}|${plan.id}`
    const prev = candByKey.get(key)
    // Conserva la fecha Due más reciente como completado representativo.
    if (!prev || (due ?? '') > (prev.due ?? '')) candByKey.set(key, { memberId, planId: plan.id, due, campaign })
  }

  // Filtrar los que ya existen.
  const toInsert: Cand[] = []
  let dupes = 0
  for (const c of candByKey.values()) {
    const exists = c.campaign
      ? existPlanYear.has(`${c.memberId}|${c.planId}|${yearOf(c.due)}`)
      : existPlan.has(`${c.memberId}|${c.planId}`)
    if (exists) { dupes++; continue }
    toInsert.push(c)
  }

  // Conteo por plan (código)
  const idToCode = new Map<string, string>(); for (const [code, p] of planByCode) idToCode.set(p.id, code)
  const byPlan = new Map<string, number>()
  for (const c of toInsert) byPlan.set(idToCode.get(c.planId) ?? '?', (byPlan.get(idToCode.get(c.planId) ?? '?') ?? 0) + 1)

  console.log('\n── Plan ──')
  console.log(`  Inscripciones directas a crear: ${toInsert.length.toLocaleString('es-CR')} (todas 'completed')`)
  console.log(`  Duplicados saltados (ya existían): ${dupes.toLocaleString('es-CR')}`)
  console.log(`  Excluidos (BUS, no curricular): ${excluded.toLocaleString('es-CR')}`)
  console.log(`  Reprobaciones genéricas ignoradas (las ubica/loguea el reseed): ${reproveCnt.toLocaleString('es-CR')}`)
  console.log(`  Sin mapeo de plan (logueados): ${[...sinMapeo.values()].reduce((a, b) => a + b, 0)} filas / ${sinMapeo.size} queues`)
  console.log(`  Sin match de Ind ID: ${noMatch.size.toLocaleString('es-CR')}`)
  console.log(`  Por plan: ${JSON.stringify(Object.fromEntries([...byPlan.entries()].sort((a, b) => b[1] - a[1])))}`)

  mkdirSync(new URL('./output/', import.meta.url), { recursive: true })
  if (noMatch.size) writeFileSync(new URL('./output/process-no-match.csv', import.meta.url), ['ind_id', ...noMatch].join('\n'))
  if (sinMapeo.size) writeFileSync(new URL('./output/process-sin-mapeo.csv', import.meta.url), ['queue,filas', ...[...sinMapeo].map(([q, n]) => `"${q.replace(/"/g, '""')}",${n}`)].join('\n'))
  console.log('  → reportes en scripts/output/process-{no-match,sin-mapeo}.csv (solo Ind IDs/queues)')

  if (DRY_RUN) { console.log('\n[DRY-RUN] No se escribió nada.'); return }

  // Insertar en batches de 200.
  let inserted = 0, errors = 0
  const rows = toInsert.map(c => ({
    member_id: c.memberId, plan_id: c.planId, group_id: null, status: 'completed',
    completed_at: c.due, enrolled_at: c.due, notes: NOTE,
  }))
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200)
    const { error } = await supabase.from('study_enrollments').insert(batch)
    if (error) { errors += batch.length; console.error(`✗ batch ${i / 200 + 1}: ${error.message} — continuando…`); continue }
    inserted += batch.length
    if (inserted % 4000 < 200 || inserted >= rows.length - 200) console.log(`  ✓ insertados: ${inserted.toLocaleString('es-CR')} / ${rows.length.toLocaleString('es-CR')}`)
  }

  console.log('\n── Resumen ──')
  console.log(`  Inscripciones directas creadas: ${inserted.toLocaleString('es-CR')} (errores ${errors})`)
  console.log(`  Duplicados saltados: ${dupes.toLocaleString('es-CR')} · excluidos BUS: ${excluded} · reprobados logueados: ${reproveCnt} · sin mapeo: ${[...sinMapeo.values()].reduce((a, b) => a + b, 0)} · sin match: ${noMatch.size}`)
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
