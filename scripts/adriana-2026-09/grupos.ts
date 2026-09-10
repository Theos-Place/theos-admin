import { createAdminClient } from '../../src/lib/supabase/admin'
const GRUPOS = ['f9fb64b1-e42f-4a3f-950e-1200480ac5c7', '6f287f18-8f58-49fa-b035-639b1b1a5252']
async function main() {
  const sb = createAdminClient()
  for (const id of GRUPOS) {
    const { data: g } = await sb.from('study_groups')
      .select('id, name, starts_at, schedule_days, schedule_time, location, leader_id, co_leader_id, status').eq('id', id).maybeSingle()
    const gg = g as Record<string,unknown>
    const nombre = async (x: unknown) => {
      if (!x) return '—'
      const { data } = await sb.from('members').select('first_name, last_name').eq('id', x as string).maybeSingle()
      return `${(data as {first_name:string}|null)?.first_name} ${(data as {last_name:string}|null)?.last_name}`
    }
    console.log(`\n══ ${gg.name}`)
    console.log(`   id ${id} | arranca ${gg.starts_at} | ${JSON.stringify(gg.schedule_days)} ${gg.schedule_time} | ${gg.location} | ${gg.status}`)
    console.log(`   dirigente: ${await nombre(gg.leader_id)} | co: ${await nombre(gg.co_leader_id)}`)
    const { count } = await sb.from('study_enrollments').select('id', { count: 'exact', head: true }).eq('group_id', id).eq('status', 'enrolled')
    console.log(`   inscritos activos: ${count}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
