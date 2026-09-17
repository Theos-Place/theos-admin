/** SOLO LECTURA: qué payload recibe cada rol en un grupo real. */
import { getGroupById } from '@/lib/supabase/queries/studies'
import { recortarRoster, type FilaDeRoster } from '@/lib/studies/roster-por-alcance'
import { createAdminClient } from '@/lib/supabase/admin'

async function main() {
  const sb = createAdminClient()
  const { data } = await sb.from('study_groups').select('id, name')
    .eq('status', 'en_curso').limit(20)
  const grupos = (data ?? []) as Array<{ id: string; name: string }>
  for (const g of grupos) {
    const full = await getGroupById(g.id)
    const roster = (full as unknown as { enrollments?: FilaDeRoster[] })?.enrollments ?? []
    if (roster.length < 2) continue
    console.log(`grupo: ${g.name}  (${roster.length} participantes)\n`)
    for (const scope of ['admin', 'leader', 'member', 'none'] as const) {
      const r = recortarRoster(roster, scope)
      const p = r[0]
      console.log(`  ${scope.padEnd(7)} ${String(r.length).padStart(2)} filas · ` +
        (p ? `campos de member: ${Object.keys(p.member ?? {}).join(', ')} · campos de fila: ${Object.keys(p).join(', ')}` : '—'))
    }
    const conTel = roster.filter(x => x.member?.phone).length
    const conCumple = roster.filter(x => x.member?.birth_date).length
    console.log(`\n  del roster real: ${conTel}/${roster.length} con teléfono · ${conCumple}/${roster.length} con fecha de nacimiento`)
    return
  }
  console.log('no encontré un grupo en curso con 2+ participantes')
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
