/**
 * Corrige enrollments cargados por error como CTBD que en realidad son "Plan
 * Daniel". El error vino del mapeo "Bienestar Integral" → CTBD en los imports.
 * NO toca is_active de Plan Daniel (queda desactivado).
 *
 * Mueve dos conjuntos (solo cambia plan_id / group.plan_id, conserva el resto):
 *  A) Inscripciones DIRECTAS (group_id null, plan_id=CTBD, históricas) de personas
 *     que en process_detail.csv tienen Queue Name = 'Bienestar Integral' y NO el
 *     de CTBD real ('Cómo Tomar Buenas Desiciones (Viviendo en Integri)').
 *     Las de personas con AMBOS quedan como AMBIGUAS (no se mueven; se reportan).
 *  B) Grupos cuyo nombre es claramente "Bienestar Integral" (no "Viviendo en
 *     Integridad", que sí es CTBD real) → se reasigna el plan del grupo.
 *
 * Dry-run (no escribe):  npx tsx scripts/fix-bienestar-to-daniel.ts
 * Ejecutar:              npx tsx scripts/fix-bienestar-to-daniel.ts --confirm
 */
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

const CONFIRM = process.argv.includes('--confirm')
const PD_FILE = new URL('./data/process_detail.csv', import.meta.url)
const Q_BIENESTAR = 'Bienestar Integral'
const Q_CTBD_REAL = 'Cómo Tomar Buenas Desiciones (Viviendo en Integri)'
for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })
const extId = (v: unknown) => String(v ?? '').trim().replace(/\.0$/, '')

async function planId(code: string): Promise<string> {
  const { data, error } = await supabase.from('study_plans').select('id').eq('code', code).single()
  if (error) throw error
  return (data as { id: string }).id
}

async function main() {
  console.log(`${CONFIRM ? '' : '[DRY-RUN] '}Bienestar Integral → Plan Daniel (sacar de CTBD)`)
  const CTBD = await planId('CTBD')
  const DANIEL = await planId('PLANDANIEL')
  console.log(`  CTBD=${CTBD} · PLANDANIEL=${DANIEL}`)

  // Sets de Ind ID por queue en process_detail.
  const pd: Record<string, string>[] = parse(readFileSync(PD_FILE, 'utf8'), { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true })
  const bienestar = new Set<string>(), ctbdReal = new Set<string>()
  for (const r of pd) {
    const q = String(r['Queue Name'] ?? '').trim(); const ind = extId(r['Ind ID']); if (!ind) continue
    if (q === Q_BIENESTAR) bienestar.add(ind)
    else if (q === Q_CTBD_REAL) ctbdReal.add(ind)
  }
  console.log(`  process_detail → Bienestar Integral: ${bienestar.size} · CTBD real: ${ctbdReal.size}`)

  // Inscripciones DIRECTAS de CTBD (sin grupo) con external_id del miembro.
  const direct: Array<{ id: string; ext: string }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('study_enrollments')
      .select('id, member:members(external_id)').eq('plan_id', CTBD).is('group_id', null).order('id').range(from, from + 999)
    if (error) throw error
    for (const r of data as Array<{ id: string; member: { external_id: string | null } | null }>) direct.push({ id: r.id, ext: String(r.member?.external_id ?? '') })
    if (data.length < 1000) break
  }

  const toMove: string[] = [], ambiguous: string[] = []
  for (const e of direct) {
    const inB = bienestar.has(e.ext), inC = ctbdReal.has(e.ext)
    if (inB && !inC) toMove.push(e.id)
    else if (inB && inC) ambiguous.push(e.ext)
  }

  // (B) Grupos CTBD con nombre Bienestar (no "Viviendo en Integridad").
  const { data: grp } = await supabase.from('study_groups').select('id, name').eq('plan_id', CTBD).ilike('name', '%bienestar%')
  const bienestarGroups = (grp ?? []) as Array<{ id: string; name: string }>

  console.log('\n── Plan ──')
  console.log(`  (A) Directos CTBD que son Bienestar → mover a Plan Daniel: ${toMove.length}`)
  console.log(`      Ambiguos (persona con Bienestar Y CTBD real, NO se mueven): ${ambiguous.length}`)
  console.log(`  (B) Grupos CTBD con nombre Bienestar → reasignar plan del grupo: ${bienestarGroups.length}`)
  for (const g of bienestarGroups) console.log(`      · ${g.name} (${g.id})`)
  if (ambiguous.length) console.log(`      Ind IDs ambiguos (muestra): ${ambiguous.slice(0, 10).join(', ')}`)

  if (!CONFIRM) { console.log('\n[DRY-RUN] No se escribió nada. Corré con --confirm para ejecutar.'); return }

  // (A) mover directos (un solo UPDATE atómico por lote).
  let movedDirect = 0
  for (let i = 0; i < toMove.length; i += 200) {
    const batch = toMove.slice(i, i + 200)
    const { error } = await supabase.from('study_enrollments').update({ plan_id: DANIEL }).in('id', batch)
    if (error) { console.error('✗ update directos:', error.message); continue }
    movedDirect += batch.length
  }
  // (B) reasignar plan de los grupos Bienestar.
  let movedGroups = 0
  for (const g of bienestarGroups) {
    const { error } = await supabase.from('study_groups').update({ plan_id: DANIEL }).eq('id', g.id)
    if (!error) movedGroups++
  }

  console.log('\n── Resumen ──')
  console.log(`  Directos movidos a Plan Daniel: ${movedDirect}`)
  console.log(`  Grupos reasignados a Plan Daniel: ${movedGroups}`)
  console.log(`  Ambiguos sin mover (revisar): ${ambiguous.length}`)
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
