/**
 * Unifica las charlas de sede registradas con nombres distintos (alias → nombre
 * canónico, ver src/lib/sedes-canonical.ts) y CONSOLIDA los eventos que queden
 * con mismo nombre + misma fecha/hora (ocurrencias de la misma charla):
 *   - reasigna sus event_checkins al evento canónico (el más viejo del grupo),
 *   - borra los eventos duplicados que quedan vacíos,
 *   - deduplica check-ins repetidos por la fusión (mismo member_id + event_id).
 *
 * Solo toca títulos que mapean a una sede del diccionario (actividades, campas,
 * Youth/Kids/Este, etc. NO se tocan). Idempotente.
 *
 * Dry-run (no escribe nada):  npx tsx scripts/unify-sede-events.ts
 * Ejecutar consolidación:     npx tsx scripts/unify-sede-events.ts --confirm
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { canonicalCharlaTitle } from '../src/lib/sedes-canonical'

const CONFIRM = process.argv.includes('--confirm')
for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

type Ev = { id: string; title: string; starts_at: string }

async function fetchAllEvents(): Promise<Ev[]> {
  const out: Ev[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('events').select('id, title, starts_at').order('id').range(from, from + 999)
    if (error) throw error
    out.push(...(data as Ev[])); if (!data || data.length < 1000) break
  }
  return out
}

async function checkinCount(eventId: string): Promise<number> {
  const { count } = await supabase.from('event_checkins').select('*', { count: 'exact', head: true }).eq('event_id', eventId)
  return count ?? 0
}

async function main() {
  console.log(`${CONFIRM ? '' : '[DRY-RUN] '}Unificación de charlas de sede`)
  const events = await fetchAllEvents()

  // 1) Renombrados: título actual → canónico (solo los que cambian).
  const renames = events
    .map(e => ({ e, canon: canonicalCharlaTitle(e.title) }))
    .filter((x): x is { e: Ev; canon: string } => x.canon != null && x.canon !== x.e.title)
  const renameByTitle = new Map<string, number>()
  for (const r of renames) renameByTitle.set(`${r.e.title} → ${r.canon}`, (renameByTitle.get(`${r.e.title} → ${r.canon}`) ?? 0) + 1)

  // 2) Estado POST-rename: cada evento con su título efectivo (canónico si aplica).
  const effective = events.map(e => ({ ...e, title: canonicalCharlaTitle(e.title) ?? e.title }))

  // 3) Grupos de fusión: mismo título efectivo + misma fecha/hora (timestamp).
  //    El que se queda = el de id menor (estable); el resto se fusiona en él.
  const groups = new Map<string, Ev[]>()
  for (const e of effective) {
    // solo eventos cuyo título es de sede (canónico) entran a fusión
    if (!canonicalCharlaTitle(e.title)) continue
    const key = `${e.title}|${new Date(e.starts_at).toISOString()}`
    const arr = groups.get(key) ?? []; arr.push(e); groups.set(key, arr)
  }
  const fusionGroups = [...groups.values()].filter(g => g.length > 1)

  console.log('\n── Plan ──')
  console.log(`  Eventos totales: ${events.length}`)
  console.log(`  Eventos a renombrar: ${renames.length}`)
  for (const [k, n] of [...renameByTitle.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${k}: ${n}`)
  console.log(`  Grupos a fusionar (mismo nombre+fecha/hora): ${fusionGroups.length}`)
  const eventsToDelete = fusionGroups.reduce((s, g) => s + (g.length - 1), 0)
  console.log(`  Eventos duplicados a eliminar tras fusión: ${eventsToDelete}`)

  if (!CONFIRM) {
    // Conteo de check-ins que se reasignarían (solo informativo en dry-run).
    let toReassign = 0
    for (const g of fusionGroups) {
      const sorted = [...g].sort((a, b) => a.id.localeCompare(b.id))
      for (const dup of sorted.slice(1)) toReassign += await checkinCount(dup.id)
    }
    console.log(`  Check-ins en eventos duplicados (se reasignarían al canónico): ${toReassign}`)
    console.log('\n[DRY-RUN] No se escribió nada. Corré con --confirm para ejecutar la consolidación.')
    return
  }

  // ── Ejecutar ──
  // a) Renombrar (en lotes por id).
  let renamed = 0
  for (let i = 0; i < renames.length; i += 200) {
    const batch = renames.slice(i, i + 200)
    await Promise.all(batch.map(r => supabase.from('events').update({ title: r.canon }).eq('id', r.e.id)))
    renamed += batch.length
  }
  console.log(`  ✓ eventos renombrados: ${renamed}`)

  // b) Fusionar: reasignar check-ins al canónico, deduplicar, borrar duplicados.
  let reassigned = 0, dupCheckinsRemoved = 0, deleted = 0
  for (const g of fusionGroups) {
    const sorted = [...g].sort((a, b) => a.id.localeCompare(b.id))
    const keep = sorted[0]
    const dups = sorted.slice(1)
    // member_ids ya presentes en el canónico (para no violar UNIQUE(member_id,event_id))
    const keepMembers = new Set<string>()
    {
      const { data } = await supabase.from('event_checkins').select('member_id').eq('event_id', keep.id)
      for (const r of (data ?? []) as Array<{ member_id: string | null }>) if (r.member_id) keepMembers.add(r.member_id)
    }
    for (const dup of dups) {
      const { data } = await supabase.from('event_checkins').select('id, member_id').eq('event_id', dup.id)
      const rows = (data ?? []) as Array<{ id: string; member_id: string | null }>
      for (const c of rows) {
        if (c.member_id && keepMembers.has(c.member_id)) {
          // ya existe en el canónico → borrar el duplicado
          await supabase.from('event_checkins').delete().eq('id', c.id)
          dupCheckinsRemoved++
        } else {
          await supabase.from('event_checkins').update({ event_id: keep.id }).eq('id', c.id)
          if (c.member_id) keepMembers.add(c.member_id)
          reassigned++
        }
      }
      // borrar el evento duplicado (ya sin check-ins)
      const { error } = await supabase.from('events').delete().eq('id', dup.id)
      if (error) console.error(`  ✗ borrando evento ${dup.id}: ${error.message}`)
      else deleted++
    }
  }

  console.log('\n── Resumen ──')
  console.log(`  Eventos renombrados:        ${renamed}`)
  console.log(`  Grupos fusionados:          ${fusionGroups.length}`)
  console.log(`  Check-ins reasignados:      ${reassigned}`)
  console.log(`  Check-ins duplicados borrados: ${dupCheckinsRemoved}`)
  console.log(`  Eventos duplicados borrados: ${deleted}`)
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
