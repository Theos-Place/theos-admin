/**
 * Migración de datos de bautizo (2026-07-17). Actualiza member_spiritual_data
 * (baptism_date, baptism_place) desde data-import/bautizos_migration.csv.
 *   cols: member_external_id, baptism_date (YYYY-MM-DD|vacío), baptism_place (vacío)
 *
 * - member: member_external_id → members.external_id. Sin match → skip + warn.
 * - Upsert por PK member_id. COALESCE: un campo vacío en el CSV NO pisa lo que
 *   ya hay en la BD (se hace en JS leyendo lo existente y mezclando, porque el
 *   upsert por lote de supabase-js usa la UNIÓN de columnas y borraría con null).
 * - spiritual_gifts NO se toca (no va en el payload).
 * - Lotes de 100. Fecha/lugar vacío → null. Sin transacción global.
 *
 * Dry-run:   npx tsx scripts/import-baptisms.ts --dry-run
 * Ejecución: npx tsx scripts/import-baptisms.ts --run
 */
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

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

const CSV = new URL('../data-import/bautizos_migration.csv', import.meta.url)
const str = (v: unknown): string => (v == null ? '' : String(v).trim())
const extId = (v: unknown): string => str(v).replace(/\.0$/, '')
const orNull = (v: unknown): string | null => (str(v) || null)

async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

async function main() {
  console.log(`\n=== Import bautizos ${DRY_RUN ? '(DRY-RUN)' : '(REAL)'} ===\n`)

  const members = await fetchAll<{ id: string; external_id: string | null }>('members', 'id, external_id')
  const byExt = new Map<string, string>()
  for (const m of members) if (m.external_id) byExt.set(extId(m.external_id), m.id)

  // Filas existentes (para COALESCE + clasificar insert/update).
  const existingRows = await fetchAll<{ member_id: string; baptism_date: string | null; baptism_place: string | null }>(
    'member_spiritual_data', 'member_id, baptism_date, baptism_place',
  )
  const existing = new Map<string, { baptism_date: string | null; baptism_place: string | null }>()
  for (const r of existingRows) existing.set(r.member_id, { baptism_date: r.baptism_date, baptism_place: r.baptism_place })

  const rows = parse(readFileSync(CSV), { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }) as Array<Record<string, string>>

  const now = new Date().toISOString()
  let processed = 0, inserted = 0, updated = 0, skipMember = 0
  const payloads: Array<Record<string, unknown>> = []

  for (const r of rows) {
    const memberId = byExt.get(extId(r.member_external_id))
    if (!memberId) { skipMember++; console.warn(`  skip: external_id ${str(r.member_external_id)} sin match en members`); continue }
    processed++
    const prev = existing.get(memberId)
    // COALESCE: CSV manda; si viene vacío se conserva lo existente.
    const baptism_date = orNull(r.baptism_date) ?? prev?.baptism_date ?? null
    const baptism_place = orNull(r.baptism_place) ?? prev?.baptism_place ?? null
    if (prev) updated++; else inserted++
    payloads.push({ member_id: memberId, baptism_date, baptism_place, updated_at: now })
  }

  if (!DRY_RUN) {
    for (let i = 0; i < payloads.length; i += 100) {
      const chunk = payloads.slice(i, i + 100)
      const { error } = await supabase.from('member_spiritual_data').upsert(chunk, { onConflict: 'member_id' })
      if (error) {
        for (const p of chunk) {
          const { error: e2 } = await supabase.from('member_spiritual_data').upsert(p, { onConflict: 'member_id' })
          if (e2) console.warn(`  upsert falló (member ${p.member_id}): ${e2.message}`)
        }
      }
    }
  }

  console.log('──────── Reporte ────────')
  console.log(`✅ Registros procesados: ${processed}`)
  console.log(`✅ Insertados nuevos: ${inserted}`)
  console.log(`✅ Actualizados: ${updated}`)
  console.log(`⚠️  Skipped (member no encontrado): ${skipMember}`)
  console.log(DRY_RUN ? '\n(DRY-RUN: no se escribió nada)\n' : '\nListo.\n')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
