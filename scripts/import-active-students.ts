/**
 * Importa los alumnos de los grupos ABIERTOS (2026-07-17). Complementa a
 * migrate-studies-clean.ts: aquel creó los 116 grupos 'en_curso' como
 * cascarones; este les cuelga las inscripciones activas.
 *
 * Fuente: data-import/grupos_activos_con_estudiantes.xlsx, hoja 'estudiantes'
 *   cols: member_external_id, nombre, Group Name, plan_code, starts_at, ends_at
 *
 * - Grupo: por 'Group Name' EXACTO contra los study_groups status='en_curso'
 *   ya existentes (NO recrea grupos). Sin match → skip + log.
 * - Alumno: member_external_id → members.external_id. Sin match → skip + log.
 * - Plan: plan_code → study_plans.code (fallback al plan del grupo).
 * - status 'enrolled', enrolled_at = starts_at (del xlsx), completed_at null.
 * UNIQUE(group_id, member_id): un duplicado se loguea y se sigue (idempotente).
 * Batches de 500, sin transacción global.
 *
 * Dry-run:      npx tsx scripts/import-active-students.ts --dry-run
 * Ejecución:    npx tsx scripts/import-active-students.ts --run
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const DRY_RUN = process.argv.includes('--dry-run')
const RUN = process.argv.includes('--run')
if (!DRY_RUN && !RUN) { console.error('Pasá --dry-run o --run.'); process.exit(1) }

for (const f of ['../.env.local', '../.env']) {
  try {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8')
    for (const l of t.split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* */ }
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  { auth: { persistSession: false } },
)

const XLSX_FILE = new URL('../data-import/grupos_activos_con_estudiantes.xlsx', import.meta.url)
const str = (v: unknown): string => (v == null ? '' : String(v).trim())
const extId = (v: unknown): string => str(v).replace(/\.0$/, '')
function cleanDate(v: unknown): string | null {
  const s = str(v)
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

async function fetchAll<T>(table: string, cols: string, filter?: (q: ReturnType<ReturnType<typeof supabase.from>['select']>) => typeof q): Promise<T[]> {
  const out: T[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    let q = supabase.from(table).select(cols).range(from, from + size - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < size) break
  }
  return out
}

async function main() {
  console.log(`\n=== Import alumnos de grupos abiertos ${DRY_RUN ? '(DRY-RUN)' : '(REAL)'} ===\n`)

  const members = await fetchAll<{ id: string; external_id: string | null }>('members', 'id, external_id')
  const byExt = new Map<string, string>()
  for (const m of members) if (m.external_id) byExt.set(extId(m.external_id), m.id)

  const plans = await fetchAll<{ id: string; code: string | null }>('study_plans', 'id, code')
  const planByCode = new Map<string, string>()
  for (const p of plans) if (p.code) planByCode.set(p.code, p.id)

  // Grupos abiertos existentes por nombre exacto.
  const groups = await fetchAll<{ id: string; name: string | null; plan_id: string | null; status: string }>(
    'study_groups', 'id, name, plan_id, status',
    q => q.eq('status', 'en_curso'),
  )
  const groupByName = new Map<string, { id: string; plan_id: string | null }>()
  for (const g of groups) if (g.name) groupByName.set(g.name, { id: g.id, plan_id: g.plan_id })
  console.log(`Grupos en_curso existentes: ${groups.length}`)

  const wb = XLSX.read(readFileSync(XLSX_FILE))
  const ws = wb.Sheets['estudiantes']
  if (!ws) { console.error('No existe la hoja "estudiantes".'); process.exit(1) }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  console.log(`Filas en hoja estudiantes: ${rows.length}\n`)

  let ok = 0, skipMember = 0, skipGroup = 0, dup = 0, otherErr = 0
  const missingGroups = new Set<string>()
  const buffer: Array<Record<string, unknown>> = []

  async function flushRow(row: Record<string, unknown>) {
    const { error } = await supabase.from('study_enrollments').insert(row)
    if (error) {
      if ((error as { code?: string }).code === '23505') dup++
      else { otherErr++; console.warn(`  enrollment falló (member ${row.member_id}): ${error.message}`) }
    } else ok++
  }
  async function flush() {
    if (DRY_RUN || !buffer.length) { buffer.length = 0; return }
    const chunk = buffer.splice(0, buffer.length)
    const { error } = await supabase.from('study_enrollments').insert(chunk)
    if (error) { for (const r of chunk) await flushRow(r) } // aísla el duplicado/error
    else ok += chunk.length
  }

  for (const r of rows) {
    const memberId = byExt.get(extId(r['member_external_id']))
    if (!memberId) { skipMember++; continue }
    const gname = str(r['Group Name'])
    const grp = groupByName.get(gname)
    if (!grp) { skipGroup++; missingGroups.add(gname); continue }
    const planId = planByCode.get(str(r['plan_code'])) ?? grp.plan_id
    if (!planId) { skipGroup++; continue }
    const startsAt = cleanDate(r['starts_at'])
    buffer.push({
      member_id: memberId, plan_id: planId, group_id: grp.id,
      status: 'enrolled', completed_at: null, enrolled_at: startsAt,
    })
    if (DRY_RUN) { ok++; buffer.length = 0 }
    else if (buffer.length >= 500) await flush()
  }
  await flush()

  console.log('──────── Reporte ────────')
  console.log(`✅ inscripciones activas insertadas: ${ok}`)
  console.log(`⚠️  skip (member no encontrado): ${skipMember}`)
  console.log(`⚠️  skip (grupo no encontrado): ${skipGroup}`)
  console.log(`⚠️  duplicados (ya existía group+member): ${dup}`)
  console.log(`⚠️  otros errores: ${otherErr}`)
  if (missingGroups.size) {
    console.log(`\nGrupos del xlsx sin match en_curso (${missingGroups.size}):`)
    for (const g of missingGroups) console.log(`  · ${g}`)
  }
  console.log(DRY_RUN ? '\n(DRY-RUN: no se escribió nada)\n' : '\nListo.\n')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
