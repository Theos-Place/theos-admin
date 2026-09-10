import { createAdminClient } from '../../src/lib/supabase/admin'
async function main() {
  const sb = createAdminClient()
  const { data: ms } = await sb.from('members').select('id, first_name, last_name, email').ilike('first_name', '%Lin%')
  const lin = (ms ?? []).filter(m => /hsiang|ta/i.test((m as {last_name:string}).last_name ?? ''))
  console.log('ficha:', JSON.stringify(lin))
  for (const m of lin as {id:string}[]) {
    const { data: enr } = await sb.from('study_enrollments')
      .select('id, group_id, status, enrolled_at, dropped_at, drop_reason, updated_at')
      .eq('member_id', m.id).order('updated_at', { ascending: false }).limit(6)
    for (const e of (enr ?? []) as Record<string,unknown>[]) {
      const { data: g } = e.group_id ? await sb.from('study_groups')
        .select('name, zone, schedule_days, schedule_time, leader_id, status, max_students').eq('id', e.group_id as string).maybeSingle() : { data: null }
      const gg = g as Record<string,unknown> | null
      let dir = '—'
      if (gg?.leader_id) {
        const { data: l } = await sb.from('members').select('first_name, last_name').eq('id', gg.leader_id as string).maybeSingle()
        dir = `${(l as {first_name:string}|null)?.first_name} ${(l as {last_name:string}|null)?.last_name}`
      }
      const cr = (v: unknown) => v ? new Date(v as string).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }) : '—'
      console.log(`\n  ${e.id}`)
      console.log(`     ${gg?.name ?? '(sin grupo)'} · ${dir} · ${JSON.stringify(gg?.schedule_days)} ${gg?.schedule_time} · ${gg?.zone}`)
      console.log(`     estado: ${e.status} | tocada ${cr(e.updated_at)}`)
      if (e.dropped_at) console.log(`     soltada ${cr(e.dropped_at)} — ${e.drop_reason}`)
      if (gg) {
        const { count } = await sb.from('study_enrollments').select('id', { count: 'exact', head: true }).eq('group_id', e.group_id as string).eq('status', 'enrolled')
        console.log(`     el grupo tiene ${count} de ${gg.max_students}`)
      }
    }
    const { data: pagos } = await sb.from('payments').select('id, payment_date, status, amount, enrollment_id, study_group_id').eq('member_id', m.id)
    console.log('\n  pagos:', JSON.stringify(pagos))
  }
}
main().catch(e => { console.error(e); process.exit(1) })
