/**
 * Marca aprobado/reprobado en las inscripciones de grupos FINALIZADOS.
 * - aprobado (completed) = el miembro aparece en historico-estudios.csv para ese estudio
 * - reprobó (dropped)    = está en el grupo pero NO en el histórico de ese estudio
 * - estudios sin datos de aprobación en el histórico → se dejan como completed
 * Dry-run por defecto. Aplicar: --apply
 */
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

// Mismo mapeo que import-study-history (Queue Name → código). "Reprueba *" no mapea (no aprobó).
const QUEUE_MAP: Record<string, string> = {
  'Nivel 1': 'N1', 'Nivel 2': 'N2', 'Nivel 3': 'N3', 'Nivel 4': 'N4', 'Sirviendo como Jesús': 'SCJ',
  'Discípulos 1': 'DIS1', 'Discípulos 2': 'DIS2', 'Discipulos 3': 'DIS3', 'Discípulos 3': 'DIS3',
  'Panorama': 'PAN', 'Administrando el Dinero': 'AED', 'Matrimonios': 'MAT', 'Religiones del Mundo': 'RDM',
  'Evangelismo': 'EVM', '¿Cómo interpretar la Biblia? (Hermenéutica)': 'HER', 'Evangelios': 'EVA', 'Hechos': 'HCH',
  'Defendiendo la Fe (Apologética)': 'DLF', 'Cómo Tomar Buenas Desiciones (Viviendo en Integri)': 'CTBD',
  'Pre Matrimonial': 'PREMAT', 'Hebreos': 'HEB', 'Romanos': 'ROM', 'Amor sin Fronteras': 'ASF',
  'Efesios': 'EFE', 'Galatas': 'GAL', 'Gálatas': 'GAL', 'Apocalipsis': 'APO', '¿Adónde va este bus?': 'BUS',
  'Bienestar Integral': 'CTBD',
}

async function fetchAll<T>(table: string, select: string, filter?: (q: ReturnType<typeof supabase.from> extends never ? never : any) => any): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(select).range(from, from + 999)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw error
    out.push(...(data as T[])); if (!data || data.length < 1000) break
  }
  return out
}

async function main() {
  // approvedSet: `${indId}|${code}` + códigos con datos de aprobación
  const recs: Record<string, string>[] = parse(readFileSync(new URL('../data-import/historico-estudios.csv', import.meta.url), 'utf8'), { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true })
  const approved = new Set<string>()
  const codesWithData = new Set<string>()
  for (const r of recs) {
    const code = QUEUE_MAP[(r['Queue Name'] ?? '').trim()]
    const ind = (r['Ind ID'] ?? '').trim()
    if (!code || !ind) continue
    approved.add(`${ind}|${code}`)
    codesWithData.add(code)
  }
  console.log('Códigos con datos de aprobación:', [...codesWithData].sort().join(', '))

  // inscripciones de grupos finalizados con código de estudio y external_id del miembro
  type Enr = { id: string; status: string; member: { external_id: string | null } | null; study_groups: { status: string; plan: { code: string } | null } | null }
  const enrs = await fetchAll<Enr>('study_enrollments', 'id, status, member:members(external_id), study_groups!study_enrollments_group_id_fkey(status, plan:study_plans(code))')

  let approveCnt = 0, reproveCnt = 0, skipNoData = 0, skipNotFinished = 0
  const toComplete: string[] = [], toDrop: string[] = []
  for (const e of enrs) {
    const gstatus = e.study_groups?.status
    if (gstatus !== 'finalizado') { skipNotFinished++; continue }
    const code = e.study_groups?.plan?.code
    const ind = e.member?.external_id
    if (!code) continue
    if (!codesWithData.has(code)) { skipNoData++; continue } // sin con qué juzgar → queda completed
    const isApproved = ind ? approved.has(`${ind}|${code}`) : false
    if (isApproved) { approveCnt++; if (e.status !== 'completed') toComplete.push(e.id) }
    else { reproveCnt++; if (e.status !== 'dropped') toDrop.push(e.id) }
  }

  console.log(`Inscripciones en grupos finalizados evaluables: ${approveCnt + reproveCnt}`)
  console.log(`  aprobados: ${approveCnt} · reprobados: ${reproveCnt}`)
  console.log(`  sin datos de aprobación (se dejan completed): ${skipNoData} · en grupos no finalizados: ${skipNotFinished}`)
  console.log(`Cambios a aplicar → a dropped: ${toDrop.length} · a completed: ${toComplete.length}`)

  if (!APPLY) { console.log('\n(dry-run) Corré con --apply para escribir.'); return }

  async function bulk(ids: string[], status: string) {
    let ok = 0
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const { error } = await supabase.from('study_enrollments').update({ status }).in('id', chunk)
      if (error) { console.error('\n', status, error.message); continue }
      ok += chunk.length; process.stdout.write(`\r${status}: ${ok}/${ids.length}`)
    }
    if (ids.length) console.log('')
  }
  await bulk(toDrop, 'dropped')
  await bulk(toComplete, 'completed')
  console.log('Listo.')
}

main()
