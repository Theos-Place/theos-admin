/**
 * Importa los 4 campos descriptivos (descripcion→description, funciones→functions,
 * perfil→profile, nivel_estudio→study_requirement) a service_positions, cruzando
 * cada registro del JSON por (puesto + comité + área), normalizado (sin tildes ni
 * mayúsculas). Idempotente: UPDATE por id. Reporta los no-matches en vez de crear.
 *
 *   npx tsx scripts/import-puestos-mapa.ts          (dry-run: solo reporta)
 *   npx tsx scripts/import-puestos-mapa.ts --apply   (aplica los updates)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const f of ['.env', '.env.local']) {
  try {
    for (const l of readFileSync(join(process.cwd(), f), 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sigue */ }
}

const APPLY = process.argv.includes('--apply')

type Row = { area: string; comite: string; puesto: string; descripcion: string; funciones: string; perfil: string; nivel_estudio: string }

const norm = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    { auth: { persistSession: false } },
  )

  const data: Row[] = JSON.parse(readFileSync(join(process.cwd(), 'data-import', 'puestos_mapa_2026.json'), 'utf8'))

  // Lookup de puestos con su comité (area_id) y área padre.
  const { data: positions, error: pErr } = await supabase
    .from('service_positions').select('id, title, area_id')
  if (pErr) throw pErr
  const { data: areas, error: aErr } = await supabase.from('areas').select('id, name, parent_id')
  if (aErr) throw aErr
  const areaById = new Map((areas ?? []).map(a => [a.id, a as { id: string; name: string; parent_id: string | null }]))

  // Match por (puesto | comité): el comité es el discriminador real. El `area` del
  // JSON ("Enseñanza", "Sedes"…) es OTRA taxonomía que NO mapea al área padre de
  // la BD ("Área Espiritual"…), así que incluirla rompería todos los matches. Si
  // un puesto+comité diera varias filas → ambiguo (se reporta, no se actualiza).
  const byKey = new Map<string, string[]>()
  for (const p of (positions ?? []) as Array<{ id: string; title: string; area_id: string | null }>) {
    const comite = p.area_id ? areaById.get(p.area_id) : null
    const key = `${norm(p.title)}|${norm(comite?.name ?? '')}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(p.id)
  }

  let matched = 0, updated = 0
  const noMatch: Row[] = []
  const ambiguous: Row[] = []

  for (const r of data) {
    const key = `${norm(r.puesto)}|${norm(r.comite)}`
    const ids = byKey.get(key)
    if (!ids || ids.length === 0) { noMatch.push(r); continue }
    if (ids.length > 1) { ambiguous.push(r); continue }
    matched++
    if (APPLY) {
      const { error } = await supabase.from('service_positions').update({
        description: r.descripcion || null,
        functions: r.funciones || null,
        profile: r.perfil || null,
        study_requirement: r.nivel_estudio || null,
      }).eq('id', ids[0])
      if (error) { console.error('update falló', r.puesto, error.message); continue }
      updated++
    }
  }

  console.log(`\n=== ${APPLY ? 'APLICADO' : 'DRY-RUN'} ===`)
  console.log(`Total JSON: ${data.length} · match único: ${matched} · actualizados: ${updated}`)
  console.log(`Sin match: ${noMatch.length} · ambiguos (mismo puesto+comité+área duplicado): ${ambiguous.length}`)
  if (ambiguous.length) {
    console.log('\n--- AMBIGUOS ---')
    for (const r of ambiguous) console.log(`  · ${r.area} › ${r.comite} › ${r.puesto}`)
  }
  if (noMatch.length) {
    console.log('\n--- SIN MATCH (revisar nomenclatura) ---')
    for (const r of noMatch) console.log(`  · ${r.area} › ${r.comite} › ${r.puesto}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
