/**
 * Gisselle López: el pago de la matrícula está marcado como PAGADO y no pagó.
 *   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local \
 *     scripts/becas-2026-09-12/arreglar-gisselle.ts [--aplicar]
 *
 * Adjuntó un comprobante que no correspondía y el pago quedó aprobado dos
 * minutos después de crearse, con referencia "123456" y sin revisor. Aparte,
 * su solicitud de beca del 11-set nunca creó la beca.
 *
 * Tres pasos, en este orden y no en otro:
 *   1. revertir el pago  → queda 'pending' y su matrícula 'pendiente_de_pago';
 *   2. crear la beca     → la del 100% que le aprobaron, y le llega el correo;
 *   3. aplicar la beca al pago → lo deja en ₡0, lo aprueba y la matrícula
 *      vuelve a 'enrolled'.
 *
 * El paso 3 EXIGE el 1: applyScholarshipToPayment solo toca pagos pendientes.
 * Y dejarla solo con el 1 sería peor que el estado actual — quedaría con la
 * matrícula en pendiente_de_pago debiendo una plata que la beca cubre.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { approveScholarshipRequest, applyScholarshipToPayment } from '@/lib/supabase/queries/scholarships'
import { updateFinanceRequestStatus } from '@/lib/supabase/queries/finance-requests'
import { revertPaymentApproval } from '@/lib/supabase/queries/payments'

const APLICAR = process.argv.includes('--aplicar')
const EXT = '7402', NOMBRE = 'Gisselle Lopez Rodriguez'
const MOTIVO = 'El comprobante adjunto no corresponde a este pago. Se revierte y se cubre con la beca aprobada.'
const FINANZAS = 'fd7666c2-d552-4c3c-97cd-37effd8edf50'

async function foto(sb: ReturnType<typeof createAdminClient>, memberId: string) {
  const { data: p } = await sb.from('payments')
    .select('id, amount, status, review_status, scholarship_id, payment_method, reference_code, enrollment_id')
    .eq('member_id', memberId).eq('concept', 'matricula').maybeSingle()
  const pago = p as Record<string, unknown> | null
  const { data: e } = await sb.from('study_enrollments')
    .select('status').eq('id', String(pago?.enrollment_id ?? '')).maybeSingle()
  const { data: b } = await sb.from('scholarships')
    .select('discount_value, discount_type, status, email_sent_to').eq('member_id', memberId).maybeSingle()
  return { pago, matricula: (e as { status: string } | null)?.status ?? '—', beca: b }
}

async function main() {
  const sb = createAdminClient()
  const { data: m } = await sb.from('members').select('id, first_name, last_name, email').eq('external_id', EXT).maybeSingle()
  const mm = m as { id: string; first_name: string; last_name: string; email: string | null } | null
  if (!mm) { console.error('ABORTA — no hay ficha'); process.exit(1) }
  const completo = `${mm.first_name} ${mm.last_name}`.trim()
  if (completo !== NOMBRE) { console.error(`ABORTA — ${EXT} es «${completo}»`); process.exit(1) }

  const antes = await foto(sb, mm.id)
  console.log(`${completo}  (${mm.email})\n`)
  console.log('ANTES:')
  console.log(`   pago:      ${antes.pago?.amount} ${antes.pago?.status} / ${antes.pago?.review_status}  ref «${antes.pago?.reference_code}»  beca=${antes.pago?.scholarship_id ?? 'no'}`)
  console.log(`   matrícula: ${antes.matricula}`)
  console.log(`   beca:      ${antes.beca ? JSON.stringify(antes.beca) : 'no tiene'}`)

  const { data: fr } = await sb.from('finance_requests')
    .select('id, status').eq('member_id', mm.id).eq('request_type', 'scholarship').maybeSingle()
  const req = fr as { id: string; status: string } | null
  if (!req) { console.error('ABORTA — no tiene solicitud de beca'); process.exit(1) }

  if (!APLICAR) {
    console.log('\nSE HARÍA:')
    console.log(`   1. revertir el pago de ₡${antes.pago?.amount} — motivo: «${MOTIVO}»`)
    console.log(`   2. crear su beca del 100% desde la solicitud ${req.id} → correo a ${mm.email}`)
    console.log('   3. aplicar la beca al pago → ₡0, aprobado, matrícula de vuelta en enrolled')
    console.log('\n🔎 DRY RUN — no se escribió nada.')
    return
  }

  const { data: rev } = await sb.from('members').select('auth_user_id').eq('id', FINANZAS).maybeSingle()
  const authId = (rev as { auth_user_id: string | null } | null)?.auth_user_id
  if (!authId) { console.error('ABORTA — el usuario de finanzas no tiene cuenta'); process.exit(1) }

  const revertido = await revertPaymentApproval(String(antes.pago!.id), FINANZAS, MOTIVO)
  console.log(`\n1. pago revertido: ${revertido}`)

  if (!antes.beca) {
    await updateFinanceRequestStatus(req.id, 'in_review', FINANZAS, 'Reapertura para crear la beca que la aprobación del 11-set no llegó a crear.')
    await approveScholarshipRequest(req.id, {
      discount_type: 'percentage', discount_value: 100, approval_type: 'total',
      reviewerMemberId: FINANZAS, reviewerUserId: authId,
    })
    console.log('2. beca del 100% creada y correo enviado')
  } else console.log('2. ya tenía beca — se salta')

  const { data: b2 } = await sb.from('scholarships').select('id').eq('member_id', mm.id).eq('status', 'active').maybeSingle()
  const r = await applyScholarshipToPayment(String(antes.pago!.id), { scholarship_id: String((b2 as { id: string }).id) }, FINANZAS)
  console.log(`3. beca aplicada al pago: monto ${r.amount}, cubierto=${r.covered}, aprobado=${r.approved}`)

  const despues = await foto(sb, mm.id)
  console.log('\nDESPUÉS:')
  console.log(`   pago:      ${despues.pago?.amount} ${despues.pago?.status} / ${despues.pago?.review_status}  beca=${despues.pago?.scholarship_id ? 'sí' : 'no'}`)
  console.log(`   matrícula: ${despues.matricula}`)
  console.log(`   beca:      ${JSON.stringify(despues.beca)}`)
  console.log('\n✅ APLICADO')
}
main().catch(e => { console.error(e); process.exit(1) })
