import { createAdminClient } from '../../src/lib/supabase/admin'
async function main() {
  const s = createAdminClient()
  const { count: fin } = await s.from('study_groups').select('id', { count: 'exact', head: true }).eq('status', 'finalizado')
  console.log('grupos finalizados:', fin)
  // ¿Cuántos tienen una huella de cierre en sus inscripciones?
  const ids: string[] = []
  let from = 0
  for (;;) {
    const { data } = await s.from('study_groups').select('id, updated_at').eq('status', 'finalizado').range(from, from + 999)
    const rows = (data ?? []) as { id: string }[]
    ids.push(...rows.map(r => r.id))
    if (rows.length < 1000) break
    from += 1000
  }
  let conHuella = 0
  const CHUNK = 100
  for (let i = 0; i < ids.length; i += CHUNK) {
    const trozo = ids.slice(i, i + CHUNK)
    const { data } = await s.from('study_enrollments')
      .select('group_id, completed_at, dropped_at')
      .in('group_id', trozo)
    const con = new Set<string>()
    for (const e of (data ?? []) as { group_id: string; completed_at: string | null; dropped_at: string | null }[]) {
      if (e.completed_at || e.dropped_at) con.add(e.group_id)
    }
    conHuella += con.size
  }
  console.log('con huella de cierre en inscripciones:', conHuella, '→ sin huella:', ids.length - conHuella)
}
main().catch(e => { console.error(e); process.exit(1) })
