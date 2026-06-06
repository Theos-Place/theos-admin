/**
 * Seed del catálogo de planes de estudio (study_plans) desde STUDY_TYPES del mock.
 * Idempotente: solo inserta los `code` que aún no existen en la BD.
 *
 * Uso: npx tsx scripts/seed-study-plans.ts
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { STUDY_TYPES } from '../src/data/mock-studies'
import type { StudyType } from '../src/types/study'

// Cargar .env.local / .env
for (const f of ['../.env.local', '../.env']) {
  try {
    const txt = readFileSync(new URL(f, import.meta.url), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* opcional */ }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const STAGE_TO_LEVEL: Record<StudyType['stage'], string> = {
  niveles: 'niveles',
  inicial: 'etapa_inicial',
  intermedia: 'etapa_intermedia',
  campaña: 'campanas',
}

function toRow(t: StudyType) {
  return {
    code: t.code,
    name: t.name,
    level: STAGE_TO_LEVEL[t.stage],
    cost: t.cost,
    duration_weeks: t.weeks,
    requires_payment: t.requires_payment,
    requires_grade: t.requires_grade,
    requires_donor: t.req_donor,
    requires_server: t.req_server,
    requires_attendance: t.req_attendee,
    auto_promote: t.auto_promote,
    prerequisite_code: t.prerequisite,
    next_study_code: t.next_study_id,
    is_active: !t.is_archived,
  }
}

async function main() {
  const { data: existing, error: exErr } = await supabase.from('study_plans').select('code')
  if (exErr) { console.error('Error leyendo study_plans:', exErr); process.exit(1) }
  const have = new Set((existing ?? []).map((r: { code: string | null }) => r.code))

  const toInsert = STUDY_TYPES.filter(t => !have.has(t.code)).map(toRow)
  console.log(`Catálogo mock: ${STUDY_TYPES.length} · ya en BD: ${have.size} · a insertar: ${toInsert.length}`)
  if (toInsert.length === 0) { console.log('Nada que insertar.'); return }

  const { data, error } = await supabase.from('study_plans').insert(toInsert).select('code, name')
  if (error) { console.error('ERROR insertando:', error); process.exit(1) }
  console.log(`Insertados ${data!.length} planes:`)
  for (const r of data!) console.log(` - ${r.code}  ${r.name}`)
}

main()
