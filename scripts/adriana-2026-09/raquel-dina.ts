import { createAdminClient } from '../../src/lib/supabase/admin'
const NOMBRES = [['Raquel','Badilla'], ['Dina','Romero']]
async function main() {
  const sb = createAdminClient()
  for (const [n, a] of NOMBRES) {
    const { data: ms } = await sb.from('members').select('id, first_name, last_name, email').ilike('first_name', `%${n}%`)
    const gente = (ms ?? []).filter(m => new RegExp(a, 'i').test((m as {last_name:string}).last_name ?? ''))
    for (const m of gente as {id:string; first_name:string; last_name:string}[]) {
      console.log(`\n═══ ${m.first_name} ${m.last_name} · ${m.id}`)
      const { data: enr } = await sb.from('study_enrollments')
        .select('id, group_id, status, created_at, dropped_at, drop_reason').eq('member_id', m.id).order('created_at', { ascending: false }).limit(6)
      for (const e of (enr ?? []) as Record<string,unknown>[]) {
        const { data: g } = e.group_id ? await sb.from('study_groups').select('name').eq('id', e.group_id as string).maybeSingle() : { data: null }
        const cr = (v: unknown) => v ? new Date(v as string).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }) : '—'
        console.log(`   matrícula ${String(e.status).padEnd(18)} | ${(g as {name:string}|null)?.name ?? '(sin grupo)'} | creada ${cr(e.created_at)}`)
        if (e.dropped_at) console.log(`        soltada ${cr(e.dropped_at)} — ${e.drop_reason}`)
      }
      const { data: pagos } = await sb.from('payments')
        .select('id, payment_date, status, amount, reference_code, study_group_id, enrollment_id, receipt_path')
        .eq('member_id', m.id).order('created_at')
      console.log(`   pagos: ${(pagos ?? []).length}`)
      for (const p of (pagos ?? []) as Record<string,unknown>[]) {
        const { data: g } = p.study_group_id ? await sb.from('study_groups').select('name').eq('id', p.study_group_id as string).maybeSingle() : { data: null }
        console.log(`      ${p.payment_date} | ${String(p.status).padEnd(8)} | ₡${p.amount} | ref ${p.reference_code ?? '—'} | ${(g as {name:string}|null)?.name ?? '?'} | matrícula ${p.enrollment_id ? 'sí' : 'HUÉRFANO'} | ${p.id}`)
      }
      const pagado = (pagos ?? []).filter(p => (p as {status:string}).status === 'paid').reduce((n, p) => n + Number((p as {amount:number}).amount), 0)
      console.log(`   → el sistema dice que pagó ₡${pagado}`)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
