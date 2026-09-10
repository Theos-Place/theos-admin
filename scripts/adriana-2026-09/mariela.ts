import { createAdminClient } from '../../src/lib/supabase/admin'
async function main() {
  const sb = createAdminClient()
  const { data: ms } = await sb.from('members').select('id, first_name, last_name, email').ilike('first_name', '%mariela%')
  const ella = (ms ?? []).filter(m => /mel[eé]ndez/i.test((m as {last_name:string}).last_name ?? ''))
  console.log('ficha:', JSON.stringify(ella))
  for (const m of ella as {id:string}[]) {
    const { data: enr } = await sb.from('study_enrollments')
      .select('id, group_id, status, created_at, dropped_at, drop_reason').eq('member_id', m.id).order('created_at', { ascending: false }).limit(6)
    console.log('\ninscripciones (las 6 más recientes):')
    for (const e of (enr ?? []) as Record<string,unknown>[]) {
      const { data: g } = e.group_id
        ? await sb.from('study_groups').select('name, leader_id, starts_at, schedule_days, schedule_time, location').eq('id', e.group_id as string).maybeSingle()
        : { data: null }
      const gg = g as Record<string,unknown> | null
      let dir = '—'
      if (gg?.leader_id) {
        const { data: l } = await sb.from('members').select('first_name, last_name').eq('id', gg.leader_id as string).maybeSingle()
        dir = `${(l as {first_name:string}|null)?.first_name} ${(l as {last_name:string}|null)?.last_name}`
      }
      const cr = (v: unknown) => v ? new Date(v as string).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }) : '—'
      console.log(`   ${String(e.status).padEnd(18)} | ${gg?.name ?? '(sin grupo)'} · ${dir} | creada ${cr(e.created_at)}`)
      if (e.dropped_at) console.log(`        soltada ${cr(e.dropped_at)} — ${e.drop_reason}`)
    }
    const { data: pagos } = await sb.from('payments').select('id, payment_date, status, amount, study_group_id, enrollment_id').eq('member_id', m.id).order('created_at')
    console.log('\n   pagos:')
    for (const p of (pagos ?? []) as Record<string,unknown>[]) console.log(`      ${p.payment_date} | ${p.status} | ${p.amount} | grupo ${p.study_group_id} | matrícula ${p.enrollment_id ?? '—'}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
