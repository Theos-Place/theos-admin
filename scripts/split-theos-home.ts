/**
 * Divide la sede mezclada "Charla Theos Home" en DOS sedes (ambas tipo charla):
 *   - "Charla Meridiano Home" ← ex "Theos Home (antes Meridiano Jueves)"
 *   - "Charla Pedregal Home"  ← ex "Home" / "Theos Home" + "Pedregal (Jóvenes)"
 *
 * El origen se perdió en la unificación previa (todo quedó como "Charla Theos
 * Home"), pero los dos grupos se separan limpio por HORA (CR): el de la tarde
 * (≥12h, 19:30) era Meridiano Jueves; el de la mañana (<12h, 06:00) era Home.
 * "Charla Pedregal (Jóvenes)" se reclasifica por título.
 *
 * Consolida los que queden con mismo nombre + misma fecha/hora (reasigna
 * event_checkins al canónico, borra duplicados vacíos, dedup por member+event).
 *
 * Dry-run (no escribe):  npx tsx scripts/split-theos-home.ts
 * Ejecutar:              npx tsx scripts/split-theos-home.ts --confirm
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const CONFIRM = process.argv.includes('--confirm')
const MERIDIANO_HOME = 'Charla Meridiano Home'
const PEDREGAL_HOME = 'Charla Pedregal Home'
for (const f of ['../.env.local', '../.env']) {
  try { const t = readFileSync(new URL(f, import.meta.url), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch { /* */ }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false } })

type Ev = { id: string; title: string; starts_at: string }

/** Hora local CR del evento (0–23). starts_at se guarda en UTC; CR = UTC-6. */
function crHour(startsAt: string): number {
  return new Date(new Date(startsAt).getTime() - 6 * 3600 * 1000).getUTCHours()
}

/** Sede nueva para un evento, o null si no aplica / ambiguo. */
function classify(e: Ev): { target: string | null; ambiguous?: boolean } {
  const t = e.title.trim().toLowerCase()
  if (t.includes('pedregal') && t.includes('jóvenes')) return { target: PEDREGAL_HOME }
  if (t.includes('pedregal') && t.includes('jovenes')) return { target: PEDREGAL_HOME }
  if (e.title.trim() === 'Charla Theos Home') {
    const h = crHour(e.starts_at)
    if (h >= 12) return { target: MERIDIANO_HOME } // tarde/noche = Meridiano Jueves
    if (h < 12) return { target: PEDREGAL_HOME }   // mañana = Home
    return { target: null, ambiguous: true }
  }
  return { target: null } // otra sede (Charla Meridiano, Charla Pedregal, etc.) — no tocar
}

async function fetchAll(): Promise<Ev[]> {
  const out: Ev[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('events').select('id, title, starts_at')
      .or('title.ilike.%theos home%,title.ilike.%pedregal%')
      .order('id').range(from, from + 999)
    if (error) throw error
    out.push(...(data as Ev[])); if (!data || data.length < 1000) break
  }
  return out
}

async function main() {
  console.log(`${CONFIRM ? '' : '[DRY-RUN] '}Split de "Charla Theos Home" → Meridiano Home / Pedregal Home`)
  const evs = await fetchAll()

  const renames: Array<{ e: Ev; target: string }> = []
  const ambiguous: Ev[] = []
  for (const e of evs) {
    const { target, ambiguous: amb } = classify(e)
    if (amb) { ambiguous.push(e); continue }
    if (target && target !== e.title) renames.push({ e, target })
  }
  const byTarget = new Map<string, number>()
  for (const r of renames) byTarget.set(r.target, (byTarget.get(r.target) ?? 0) + 1)

  console.log('\n── Clasificación ──')
  for (const [t, n] of byTarget) console.log(`  → ${t}: ${n} eventos`)
  console.log(`  Ambiguos (sin clasificar, requieren confirmación): ${ambiguous.length}`)
  for (const a of ambiguous) console.log(`    · ${a.id}  ${a.title}  ${a.starts_at}`)

  // Fusión: tras renombrar, eventos con mismo título+timestamp se consolidan.
  const effective = evs.map(e => { const c = classify(e); return { ...e, title: c.target ?? e.title } })
  const groups = new Map<string, Ev[]>()
  for (const e of effective) {
    if (e.title !== MERIDIANO_HOME && e.title !== PEDREGAL_HOME) continue
    const key = `${e.title}|${new Date(e.starts_at).toISOString()}`
    const arr = groups.get(key) ?? []; arr.push(e); groups.set(key, arr)
  }
  const fusion = [...groups.values()].filter(g => g.length > 1)
  console.log(`\n  Grupos a fusionar (mismo nombre+fecha/hora): ${fusion.length} · eventos duplicados a borrar: ${fusion.reduce((s, g) => s + g.length - 1, 0)}`)

  if (!CONFIRM) {
    if (ambiguous.length) console.log('\n⚠ Hay ambiguos — confirmá su sede antes de ejecutar.')
    console.log('\n[DRY-RUN] No se escribió nada. Corré con --confirm para ejecutar.')
    return
  }
  if (ambiguous.length) { console.error('\n✗ Hay ambiguos sin resolver — abortando. Resolvé manualmente primero.'); process.exit(1) }

  // Renombrar
  let renamed = 0
  for (let i = 0; i < renames.length; i += 200) {
    const batch = renames.slice(i, i + 200)
    // Ambas sedes son charla (varios estaban mal como 'social' por el import).
    await Promise.all(batch.map(r => supabase.from('events').update({ title: r.target, event_type: 'charla' }).eq('id', r.e.id)))
    renamed += batch.length
  }
  console.log(`  ✓ eventos renombrados: ${renamed}`)

  // Fusionar (reasignar check-ins, dedup, borrar duplicados)
  let reassigned = 0, dupRemoved = 0, deleted = 0
  for (const g of fusion) {
    const sorted = [...g].sort((a, b) => a.id.localeCompare(b.id))
    const keep = sorted[0]
    const keepMembers = new Set<string>()
    { const { data } = await supabase.from('event_checkins').select('member_id').eq('event_id', keep.id)
      for (const r of (data ?? []) as Array<{ member_id: string | null }>) if (r.member_id) keepMembers.add(r.member_id) }
    for (const dup of sorted.slice(1)) {
      const { data } = await supabase.from('event_checkins').select('id, member_id').eq('event_id', dup.id)
      for (const c of (data ?? []) as Array<{ id: string; member_id: string | null }>) {
        if (c.member_id && keepMembers.has(c.member_id)) { await supabase.from('event_checkins').delete().eq('id', c.id); dupRemoved++ }
        else { await supabase.from('event_checkins').update({ event_id: keep.id }).eq('id', c.id); if (c.member_id) keepMembers.add(c.member_id); reassigned++ }
      }
      const { error } = await supabase.from('events').delete().eq('id', dup.id)
      if (!error) deleted++
    }
  }

  console.log('\n── Resumen ──')
  for (const [t, n] of byTarget) console.log(`  ${t}: ${n} renombrados`)
  console.log(`  Check-ins reasignados: ${reassigned} · duplicados borrados: ${dupRemoved} · eventos duplicados borrados: ${deleted}`)
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
