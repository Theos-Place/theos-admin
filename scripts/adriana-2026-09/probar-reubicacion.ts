/**
 * La reubicación TIENE que seguir funcionando igual después de engancharla a
 * transferEnrollment. Se prueba con datos desechables y se limpia.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { resolveStudyRequest } from '../../src/lib/supabase/queries/study-requests'

const SCJ = 'f9fb64b1-e42f-4a3f-950e-1200480ac5c7'   // ₡5.000

async function main() {
  const sb = createAdminClient()
  // Destino: otro grupo, más caro, para comprobar que la reubicación NO cobra
  // la diferencia (a diferencia de la acción directa).
  const { data: gs } = await sb.from('study_groups')
    .select('id, name, plan_id, plan:study_plans!study_groups_plan_id_fkey(code, cost)')
    .eq('status', 'en_matricula').limit(300)
  const caro = (gs ?? []).find(g => Number((g as { plan: { cost: number } | null }).plan?.cost ?? 0) === 20000) as
    { id: string; name: string } | undefined
  if (!caro) throw new Error('no hay grupo de ₡20.000 abierto')

  const { data: m } = await sb.from('members').insert({
    first_name: '[prueba]', last_name: 'Reubicación Temporal',
    email: 'reubicacion.temporal@prueba.theosplace.invalid', is_active: true,
  }).select('id').single()
  const MID = (m as { id: string }).id
  const { data: e } = await sb.from('study_enrollments').insert({
    member_id: MID, group_id: SCJ, status: 'enrolled', enrolled_at: new Date().toISOString(),
  }).select('id').single()
  const EID = (e as { id: string }).id
  await sb.from('payments').insert({
    member_id: MID, amount: 5000, currency: 'CRC', payment_method: 'comprobante',
    concept: 'matricula', entity_type: 'study_group', enrollment_id: EID, study_group_id: SCJ,
    status: 'paid', review_status: 'aprobado', payment_date: new Date().toISOString().slice(0, 10),
  })
  const { data: req } = await sb.from('study_requests').insert({
    member_id: MID, request_type: 'relocation', status: 'open',
    current_group_id: SCJ, wants_falleto: undefined, wants_folleto: false,
  } as never).select('id').single()
  const RID = (req as { id: string }).id
  console.log(`preparado: ${MID} en SCJ con ₡5.000 pagados · solicitud ${RID} → destino ${caro.name}`)

  const r = await resolveStudyRequest(RID, MID, { target_group_id: caro.id })
  console.log('\nsolicitud quedó:', r.status, '| grupo resuelto:', r.resolved_group_name ?? r.resolved_group_id)

  const { data: enr } = await sb.from('study_enrollments')
    .select('group_id, status, transferred_to').eq('member_id', MID)
  console.table(enr)
  const { data: pagos } = await sb.from('payments')
    .select('amount, status, study_group_id, transfer_note').eq('member_id', MID)
  console.table(pagos?.map(p => ({ ...p, transfer_note: String((p as {transfer_note:string|null}).transfer_note ?? '').slice(0, 60) })))
  const cobros = (pagos ?? []).filter(p => (p as {status:string}).status === 'pending')
  console.log(cobros.length === 0
    ? '✓ NO se le cobró la diferencia — la reubicación conserva su regla'
    : `✗ le crearon ${cobros.length} cobro(s): la reubicación cambió de comportamiento`)

  await sb.from('study_requests').delete().eq('id', RID)
  await sb.from('payments').delete().eq('member_id', MID)
  await sb.from('study_enrollments').delete().eq('member_id', MID)
  await sb.from('members').delete().eq('id', MID)
  console.log('✓ limpio')
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
