/**
 * Importa la CAPACITACIÓN DE DIRIGENTES 2019 de la campaña "¿Para qué estoy
 * aquí en la tierra?" como un grupo de DOBLE PROPÓSITO (study_group con
 * is_leader_training = true), modelando un solo grupo con ambas modalidades
 * (larga + corta) y guardando la modalidad por persona en notes.
 *
 * Fuente: scripts/data/campanas.csv. SOLO procesa las filas con Queue Name en
 * ('Capacitación Larga Dirigentes 2019', 'Capacitación Corta Dirigentes 2019')
 * — 155 personas. Las DEMÁS campañas (Transformados, Tiempo para Soñar, Una Fe
 * Audaz, (RE) Descubriendo, ¿Para qué estoy aquí? como estudiantes) NO se tocan
 * acá (las maneja el flujo de campañas) para no duplicar.
 *
 * Qué hace por cada persona (todas completaron, son participantes, no leaders):
 *   1) study_enrollment al grupo: status 'completed', fecha = Due, notes con la
 *      modalidad (larga/corta).
 *   2) Formación de dirigente: agrega 'PQET' a study_leaders.qualified_study_codes
 *      (queda capacitada para DAR esa campaña). Es el resultado de la capacitación.
 * Ambas inserciones son idempotentes (no duplican al re-correr).
 *
 * Match de personas: "Ind ID" → members.external_id (= Individual ID de PCO).
 * Privacidad: CSV en scripts/data/ (gitignored); logs solo conteos; sin match →
 * scripts/output/ (solo Ind IDs, nunca nombres).
 *
 * Dry-run (no escribe nada):  npx tsx scripts/seed-campaigns.ts --dry-run
 * Ejecución real:             npx tsx scripts/seed-campaigns.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'
import { qualifyLeadersForStudy } from './lib/leader-training'

const DRY_RUN = process.argv.includes('--dry-run')
const FILE = new URL('./data/campanas.csv', import.meta.url)
const CAMPAIGN_CODE = 'PQET' // ¿Para qué estoy aquí en la tierra? (level campanas)
const GROUP_NAME = '¿Para qué estoy aquí en la tierra? — Capacitación de Dirigentes 2019'
const QUEUE_LARGA = 'Capacitación Larga Dirigentes 2019'
const QUEUE_CORTA = 'Capacitación Corta Dirigentes 2019'
const LEADER_NOTE = 'Capacitación dirigentes 2019'

for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

const str = (v: unknown): string => (v == null ? '' : String(v).trim())
const extId = (v: unknown): string => str(v).replace(/\.0$/, '')
const toDate = (v: unknown): string | null => { const m = str(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null }

async function fetchAll<T>(table: string, select: string, build?: (q: any) => any): Promise<T[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(select).order('member_id').range(from, from + 999)
    if (build) q = build(q)
    const { data, error } = await q
    if (error) throw error
    out.push(...(data as T[])); if (!data || data.length < 1000) break
  }
  return out
}

async function main() {
  if (!existsSync(FILE)) { console.error(`Falta ${FILE.pathname} (gitignored).`); process.exit(1) }
  const recs: Record<string, string>[] = parse(readFileSync(FILE, 'utf8'), { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true })

  // Solo las dos queries de capacitación de dirigentes 2019.
  const cap = recs.filter(r => [QUEUE_LARGA, QUEUE_CORTA].includes(str(r['Queue Name'])))
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Filas de capacitación dirigentes 2019: ${cap.length}`)

  // Una persona por Ind ID (puede aparecer en ambas modalidades → se combinan).
  type Person = { ind: string; modalities: Set<string>; due: string | null }
  const byInd = new Map<string, Person>()
  let badId = 0
  for (const r of cap) {
    const ind = extId(r['Ind ID'])
    if (!/^\d+$/.test(ind)) { badId++; continue }
    const modality = str(r['Queue Name']) === QUEUE_LARGA ? 'larga' : 'corta'
    const due = toDate(r['Due'])
    const p = byInd.get(ind) ?? { ind, modalities: new Set<string>(), due: null }
    p.modalities.add(modality)
    if (due && (!p.due || due < p.due)) p.due = due // Due más temprano de la persona
    byInd.set(ind, p)
  }
  const dues = cap.map(r => toDate(r['Due'])).filter(Boolean).sort() as string[]
  const groupStart = dues[0] ?? '2019-01-01' // Due representativa = primera sesión
  console.log(`Personas distintas: ${byInd.size} · solo larga ${[...byInd.values()].filter(p => p.modalities.size === 1 && p.modalities.has('larga')).length} · solo corta ${[...byInd.values()].filter(p => p.modalities.size === 1 && p.modalities.has('corta')).length} · ambas ${[...byInd.values()].filter(p => p.modalities.size === 2).length}`)

  // Plan de la campaña.
  const { data: plan, error: pErr } = await supabase.from('study_plans').select('id').eq('code', CAMPAIGN_CODE).maybeSingle()
  if (pErr) throw pErr
  if (!plan) { console.error(`No existe el plan ${CAMPAIGN_CODE} en study_plans.`); process.exit(1) }
  const planId = (plan as { id: string }).id

  // Grupo (idempotente por nombre + is_leader_training).
  const { data: existingGroup } = await supabase.from('study_groups').select('id').eq('name', GROUP_NAME).eq('is_leader_training', true).maybeSingle()
  let groupId = (existingGroup as { id: string } | null)?.id ?? null
  const groupReused = !!groupId

  // Miembros: external_id → uuid (paginado, orden por id).
  const extToId = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('members').select('id, external_id').not('external_id', 'is', null).order('id').range(from, from + 999)
    if (error) throw error
    for (const m of data as Array<{ id: string; external_id: string }>) extToId.set(String(m.external_id), m.id)
    if (data.length < 1000) break
  }

  // Resolver matches.
  const matched: Array<{ person: Person; memberId: string }> = []
  const noMatch: string[] = []
  for (const p of byInd.values()) {
    const mid = extToId.get(p.ind)
    if (!mid) { noMatch.push(p.ind); continue }
    matched.push({ person: p, memberId: mid })
  }

  // ── Inscripciones existentes del grupo (dedup) ──
  const existingEnroll = new Set<string>()
  if (groupId) {
    const rows = await fetchAll<{ member_id: string }>('study_enrollments', 'member_id', q => q.eq('group_id', groupId))
    for (const r of rows) existingEnroll.add(r.member_id)
  }

  // Plan de inscripciones. Formación de dirigente: lógica compartida (helper).
  const matchedIds = matched.map(m => m.memberId)
  const enrollToInsert = matched.filter(m => !existingEnroll.has(m.memberId))
  const enrollDupes = matched.length - enrollToInsert.length
  const fPreview = await qualifyLeadersForStudy(supabase, matchedIds, CAMPAIGN_CODE, true)

  console.log('\n── Plan ──')
  console.log(`  Grupo:                 ${groupReused ? 'REUSAR existente' : 'CREAR'} ("${GROUP_NAME}", inicio ${groupStart})`)
  console.log(`  Inscripciones a crear: ${enrollToInsert.length} (duplicadas saltadas: ${enrollDupes})`)
  console.log(`  Formación dirigente (PQET): nuevas filas ${fPreview.nuevos} · actualizar ${fPreview.actualizados} · ya capacitados ${fPreview.yaCapacitados}`)
  console.log(`  Sin match (Ind ID):    ${noMatch.length}${badId ? ` · Ind ID inválido: ${badId}` : ''}`)

  if (noMatch.length) {
    mkdirSync(new URL('./output/', import.meta.url), { recursive: true })
    writeFileSync(new URL('./output/campaigns-leader-training-no-match.csv', import.meta.url), ['ind_id', ...noMatch].join('\n'))
    console.log('  → sin match en scripts/output/campaigns-leader-training-no-match.csv (solo Ind IDs)')
  }

  if (DRY_RUN) { console.log('\n[DRY-RUN] No se escribió nada.'); return }

  // ── Crear grupo si no existe ──
  if (!groupId) {
    const { data, error } = await supabase.from('study_groups').insert({
      plan_id: planId, name: GROUP_NAME, status: 'finalizado',
      starts_at: groupStart, is_leader_training: true, training_modality: null, current_week: 0,
    }).select('id').single()
    if (error) { console.error(`✗ creando grupo: ${error.message}`); process.exit(1) }
    groupId = (data as { id: string }).id
    console.log(`✓ grupo creado`)
  }

  // ── Inscripciones (batches de 200) ──
  let enrolled = 0, eErr = 0
  const rows = enrollToInsert.map(m => ({
    group_id: groupId, plan_id: planId, member_id: m.memberId, status: 'completed',
    enrolled_at: m.person.due ?? groupStart, completed_at: m.person.due ?? groupStart,
    notes: `${LEADER_NOTE} — modalidad: ${[...m.person.modalities].sort().join('+')}`,
  }))
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200)
    const { error } = await supabase.from('study_enrollments').insert(batch)
    if (error) { eErr += batch.length; console.error(`✗ batch enroll ${i / 200 + 1}: ${error.message} — continuando…`); continue }
    enrolled += batch.length
  }

  // ── Formación de dirigente: agregar PQET a study_leaders (helper compartido) ──
  const f = await qualifyLeadersForStudy(supabase, matchedIds, CAMPAIGN_CODE, false)

  console.log('\n── Resumen ──')
  console.log(`  Grupo:                 ${groupReused ? 'reusado' : 'creado'}`)
  console.log(`  Inscripciones creadas: ${enrolled} (duplicadas saltadas: ${enrollDupes}${eErr ? `, errores ${eErr}` : ''})`)
  console.log(`  Formación PQET:        nuevas ${f.nuevos} · actualizadas ${f.actualizados} · ya capacitados ${f.yaCapacitados}${f.errores ? ` · errores ${f.errores}` : ''}`)
  console.log(`  Sin match:             ${noMatch.length}`)
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
