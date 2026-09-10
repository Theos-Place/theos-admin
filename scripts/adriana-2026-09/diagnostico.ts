import { createAdminClient } from '../../src/lib/supabase/admin'
async function main() {
  const sb = createAdminClient()
  const { data: ms } = await sb.from('members')
    .select('id, first_name, last_name, email, phone, cedula, is_active, created_at')
    .ilike('first_name', '%adriana%')
  const ella = (ms ?? []).filter(m => /jim[eé]nez/i.test((m as {last_name:string}).last_name ?? '') && /sanabria/i.test((m as {last_name:string}).last_name ?? ''))
  console.log('fichas que calzan:', JSON.stringify(ella, null, 1))

  for (const m of ella as {id:string; first_name:string; last_name:string}[]) {
    console.log(`\n═══ ${m.first_name} ${m.last_name} · ${m.id}`)
    const { data: enr } = await sb.from('study_enrollments')
      .select('id, group_id, status, created_at, updated_at, payment_status, completed_at, dropped_at, drop_reason, notes')
      .eq('member_id', m.id).order('created_at')
    for (const e of (enr ?? []) as Record<string,unknown>[]) {
      const { data: g } = await sb.from('study_groups')
        .select('name, starts_at, status, leader_id, schedule_days, schedule_time').eq('id', e.group_id as string).maybeSingle()
      const gg = g as Record<string,unknown> | null
      let dirigente = '—'
      if (gg?.leader_id) {
        const { data: l } = await sb.from('members').select('first_name, last_name').eq('id', gg.leader_id as string).maybeSingle()
        dirigente = `${(l as {first_name:string}|null)?.first_name} ${(l as {last_name:string}|null)?.last_name}`
      }
      const cr = (v: unknown) => v ? new Date(v as string).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }) : '—'
      console.log(`\n  · inscripción ${e.id}`)
      console.log(`      grupo: ${gg?.name ?? '(sin grupo)'} | dirigente: ${dirigente} | arranca ${gg?.starts_at} | grupo ${gg?.status}`)
      console.log(`      estado: ${e.status} | pago: ${e.payment_status} | creada ${cr(e.created_at)} | tocada ${cr(e.updated_at)}`)
      if (e.drop_reason || e.notes) console.log(`      motivo/nota: ${e.drop_reason ?? ''} ${e.notes ?? ''}`)
    }
    const { data: pagos } = await sb.from('payments').select('*').eq('member_id', m.id).order('created_at')
    console.log(`\n  pagos: ${(pagos ?? []).length}`)
    for (const p of (pagos ?? []) as Record<string,unknown>[]) {
      console.log(`      ${String(p.created_at).slice(0,16)} | ${p.status} | ${p.amount} ${p.currency ?? ''} | ref ${p.reference ?? '—'} | concepto ${p.concept ?? p.description ?? '—'} | ${p.id}`)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
