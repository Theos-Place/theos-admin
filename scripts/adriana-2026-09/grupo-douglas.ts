import { createAdminClient } from '../../src/lib/supabase/admin'
const G = 'f9fb64b1-e42f-4a3f-950e-1200480ac5c7'
async function main() {
  const sb = createAdminClient()
  const { data: enr } = await sb.from('study_enrollments')
    .select('id, member_id, status, enrolled_at, dropped_at, drop_reason, created_at, updated_at')
    .eq('group_id', G).order('created_at')
  console.log(`inscripciones en el grupo de Douglas (TODOS los estados): ${(enr ?? []).length}\n`)
  const cr = (v: unknown) => v ? new Date(v as string).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }) : '—'
  for (const e of (enr ?? []) as Record<string,unknown>[]) {
    const { data: m } = await sb.from('members').select('first_name, last_name').eq('id', e.member_id as string).maybeSingle()
    const mm = m as {first_name:string; last_name:string} | null
    const marca = e.status === 'enrolled' ? '  ' : '⚠️'
    console.log(`${marca} ${`${mm?.first_name} ${mm?.last_name}`.padEnd(32)} | ${String(e.status).padEnd(18)} | creada ${cr(e.created_at)}`)
    if (e.dropped_at) console.log(`      soltada ${cr(e.dropped_at)} — ${e.drop_reason ?? 'sin motivo'}`)
  }
  const cuenta = (s: string) => (enr ?? []).filter(e => (e as {status:string}).status === s).length
  console.log(`\nenrolled: ${cuenta('enrolled')} | pendiente_de_pago: ${cuenta('pendiente_de_pago')} | cancelada: ${cuenta('cancelada')} | dropped: ${cuenta('dropped')} | waitlist: ${cuenta('waitlist')} | en_revision: ${cuenta('en_revision')} | expirada: ${cuenta('expirada')}`)
}
main().catch(e => { console.error(e); process.exit(1) })
