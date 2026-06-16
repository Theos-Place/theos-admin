/**
 * Migra el contenido curado de src/data/study-catalog.ts (STUDY_CATALOG) a la
 * tabla study_plans, que tenía esas columnas VACÍAS (0 descripciones / 0
 * compromisos / 0 dificultad). Matchea por `code`. Solo toca description,
 * commitments y difficulty (los campos que faltaban); NO pisa prereq, mentor,
 * costo ni flags (la BD ya es la fuente de esos, editables en la UI).
 *
 * Dry-run por defecto:  npx tsx scripts/migrate-study-catalog.ts
 * Aplicar:              npx tsx scripts/migrate-study-catalog.ts --apply
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { STUDY_CATALOG } from '../src/data/study-catalog'

const APPLY = process.argv.includes('--apply')

for (const f of ['../.env.local', '../.env']) {
  try {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8')
    for (const line of t.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
  } catch { /* */ }
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  { auth: { persistSession: false } },
)

async function main() {
  // Solo los estudios con algún contenido que migrar.
  const items = STUDY_CATALOG.filter(s => s.description || s.commitments || s.level)
  console.log(`Catálogo: ${STUDY_CATALOG.length} estudios, ${items.length} con contenido a migrar`)

  const { data: plans, error } = await supabase.from('study_plans').select('id, code')
  if (error) { console.error(error.message); process.exit(1) }
  const idByCode = new Map((plans ?? []).map((p: { id: string; code: string | null }) => [p.code, p.id]))

  const updates: Array<{ code: string; id: string; patch: Record<string, unknown> }> = []
  const noMatch: string[] = []
  for (const s of items) {
    const id = idByCode.get(s.code)
    if (!id) { noMatch.push(s.code); continue }
    const patch: Record<string, unknown> = {}
    if (s.description) patch.description = s.description
    if (s.commitments) patch.commitments = s.commitments
    if (s.level) patch.difficulty = s.level
    if (Object.keys(patch).length) updates.push({ code: s.code, id, patch })
  }

  console.log(`A actualizar: ${updates.length} planes${noMatch.length ? ` · sin match en BD: ${noMatch.join(', ')}` : ''}`)
  for (const u of updates) console.log(`  ${u.code}: ${Object.keys(u.patch).join(', ')}`)

  if (!APPLY) { console.log('\nDRY-RUN: no se escribió nada. Corré con --apply'); return }

  for (const u of updates) {
    const { error: uErr } = await supabase.from('study_plans').update(u.patch).eq('id', u.id)
    if (uErr) { console.error(`Error en ${u.code}:`, uErr.message); process.exit(1) }
  }
  console.log(`\nListo: ${updates.length} planes actualizados.`)
}

main().catch(e => { console.error(e); process.exit(1) })
