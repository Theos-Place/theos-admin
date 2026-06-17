/**
 * Importa el HISTÓRICO DE CAMPAÑAS desde scripts/data/campanas.csv como
 * inscripciones DIRECTAS (study_enrollments con group_id NULL y plan_id directo).
 *
 * Cubre las campañas que no quedaron representadas por el reseed de grupos
 * (sobre todo Tiempo para Soñar, (RE) Descubriendo y el grueso de ¿Para qué
 * estoy aquí?). Idempotente: no duplica si la persona ya tiene ese plan en ese año.
 *
 * Mapeo Queue Name → { code, status }:
 *  - Transformados            → TRANS  completed
 *  - ¿Para qué estoy aquí?    → PQET   completed
 *  - Tiempo para Soñar 2023   → TPS    completed
 *  - Una Fe Audaz             → UFA    completed
 *  - (RE) Descubriendo        → REDESC completed
 *  - No finalizó -Transformados 2025 → TRANS dropped (campaña y año en la etiqueta)
 *  - Reprueba - Tiempo para Soñar 2023 → TPS dropped
 *  - Capacitación Larga/Corta Dirigentes 2019 → EXCLUIR (lo maneja seed-campaigns.ts)
 *
 * Año: el 20xx del nombre de la cola si lo trae; si no, el de Due. completed_at =
 * Due cuando su año coincide con el elegido; si no, `${año}-07-01` (para que el
 * perfil muestre el año de la edición).
 * Dedup: member + plan + AÑO(completed_at) — permite ediciones distintas del mismo
 * plan en años distintos, pero no duplica la misma edición ya presente.
 * Match de personas: "Ind ID" → members.external_id. Sin match → scripts/output/.
 *
 * Dry-run (no escribe nada):  npx tsx scripts/import-campaign-history.ts --dry-run
 * Ejecución real:             npx tsx scripts/import-campaign-history.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const FILE = new URL('./data/campanas.csv', import.meta.url)
const NOTE = 'Campaña histórica (PCO)'

for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

const str = (v: unknown): string => (v == null ? '' : String(v).trim())
const extId = (v: unknown): string => str(v).replace(/\.0$/, '')
const dueDate = (v: unknown): string | null => {
  const m = str(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m || m[1] === '0000' || m[2] === '00' || m[3] === '00') return null
  return `${m[1]}-${m[2]}-${m[3]}`
}
const qnameYear = (q: string): string | null => { const m = q.match(/(20\d{2})/); return m ? m[1] : null }

type Mapping = { code: string; status: 'completed' | 'dropped' }
function mapQueue(queue: string): Mapping | null {
  const q = queue.toLowerCase()
  if (/capacitaci[oó]n.*dirigentes/.test(q)) return null // lo maneja seed-campaigns.ts
  if (/no finaliz[oó].*transformad/.test(q)) return { code: 'TRANS', status: 'dropped' }
  if (/reprueba.*tiempo para so/.test(q)) return { code: 'TPS', status: 'dropped' }
  if (/transformad/.test(q)) return { code: 'TRANS', status: 'completed' }
  if (/tiempo para so/.test(q)) return { code: 'TPS', status: 'completed' }
  if (/una fe audaz/.test(q)) return { code: 'UFA', status: 'completed' }
  if (/descubr/.test(q)) return { code: 'REDESC', status: 'completed' }
  if (/para qu[eé] estoy/.test(q)) return { code: 'PQET', status: 'completed' }
  return null // sin mapeo
}

async function fetchAll<T>(table: string, select: string, build?: (q: ReturnType<ReturnType<typeof supabase.from>['select']>) => unknown): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1)
    if (build) q = build(q as never) as never
    const { data, error } = await q
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) break
  }
  return out
}

async function main() {
  const csv = readFileSync(FILE, 'utf8')
  const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as Record<string, string>[]
  const qcol = Object.keys(rows[0]).find(k => k.toLowerCase().includes('queue name'))!
  console.log(`campanas.csv: ${rows.length} filas`)

  // Catálogo de planes de campaña
  const plans = await fetchAll<{ id: string; code: string }>('study_plans', 'id, code', q => (q as { eq: (c: string, v: string) => unknown }).eq('level', 'campanas'))
  const planByCode = new Map(plans.map(p => [p.code, p.id]))

  // Miembros por external_id
  const members = await fetchAll<{ id: string; external_id: string | null }>('members', 'id, external_id')
  const memberByExt = new Map(members.filter(m => m.external_id).map(m => [extId(m.external_id), m.id]))

  // Inscripciones de campaña existentes → set "member|plan|año" para dedup
  const existing = await fetchAll<{ member_id: string; plan_id: string | null; completed_at: string | null; group_id: string | null }>(
    'study_enrollments', 'member_id, plan_id, completed_at, group_id, group:study_groups!study_enrollments_group_id_fkey(plan_id)',
  ) as Array<{ member_id: string; plan_id: string | null; completed_at: string | null; group: { plan_id: string } | null }>
  const planIdSet = new Set(plans.map(p => p.id))
  const seen = new Set<string>()
  for (const e of existing) {
    const pid = e.plan_id ?? e.group?.plan_id ?? null
    if (!pid || !planIdSet.has(pid)) continue
    const yr = e.completed_at ? e.completed_at.slice(0, 4) : '?'
    seen.add(`${e.member_id}|${pid}|${yr}`)
  }
  console.log(`Inscripciones de campaña existentes (dedup): ${seen.size}`)

  const toInsert: Record<string, unknown>[] = []
  const stats: Record<string, { matched: number; nuevo: number; dup: number; sinMatch: number; sinMapeo: number }> = {}
  const noMatch: string[] = []
  const newKeys = new Set<string>() // evita duplicar dentro del propio CSV

  for (const row of rows) {
    const queue = str(row[qcol])
    const map = mapQueue(queue)
    const s = (stats[queue] ??= { matched: 0, nuevo: 0, dup: 0, sinMatch: 0, sinMapeo: 0 })
    if (!map) { s.sinMapeo++; continue }
    const planId = planByCode.get(map.code)
    if (!planId) { s.sinMapeo++; continue }

    const ext = extId(row['Ind ID'])
    const memberId = memberByExt.get(ext)
    if (!memberId) { s.sinMatch++; noMatch.push(ext); continue }
    s.matched++

    const due = dueDate(row['Due'])
    const year = qnameYear(queue) ?? (due ? due.slice(0, 4) : null)
    if (!year) { s.sinMapeo++; continue }
    const completedAt = due && due.slice(0, 4) === year ? due : `${year}-07-01`

    const key = `${memberId}|${planId}|${year}`
    if (seen.has(key) || newKeys.has(key)) { s.dup++; continue }
    newKeys.add(key)
    s.nuevo++
    toInsert.push({
      member_id: memberId,
      plan_id: planId,
      group_id: null,
      status: map.status,
      completed_at: completedAt, // fecha de registro (también para dropped → idempotencia + año en perfil)
      enrolled_at: completedAt,
      dropped_at: map.status === 'dropped' ? completedAt : null,
      notes: `${NOTE} — ${queue}`,
    })
  }

  console.log('\nResumen por cola:')
  for (const q of Object.keys(stats).sort()) {
    const s = stats[q]
    console.log(`  ${q}\n     match=${s.matched}  nuevo=${s.nuevo}  dup=${s.dup}  sinMatch=${s.sinMatch}  sinMapeo=${s.sinMapeo}`)
  }
  console.log(`\nTOTAL a insertar: ${toInsert.length}`)
  console.log(`Sin match (Ind IDs únicos): ${new Set(noMatch).size}`)

  if (!existsSync(new URL('./output/', import.meta.url))) mkdirSync(new URL('./output/', import.meta.url))
  writeFileSync(new URL('./output/campanas-sin-match.csv', import.meta.url), 'ind_id\n' + Array.from(new Set(noMatch)).join('\n'))

  if (DRY_RUN) { console.log('\n[DRY-RUN] No se escribió nada.'); return }

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500)
    const { error } = await supabase.from('study_enrollments').insert(chunk)
    if (error) throw error
    inserted += chunk.length
    console.log(`  insertadas ${inserted}/${toInsert.length}`)
  }
  console.log(`\n✓ Listo: ${inserted} inscripciones de campaña insertadas.`)
}

main().catch(e => { console.error(e); process.exit(1) })
