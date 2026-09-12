/**
 * Valeria Díaz: pagó ₡5.000 y el sistema le anotó ₡20.000; su beca de ₡15.000
 * cubre el resto.
 *   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local \
 *     scripts/becas-2026-09-12/arreglar-valeria.ts [--aplicar]
 *
 * Mismo patrón que Gisselle: el pago se auto-aprobó un minuto después de
 * crearse, sin revisor. Pero acá SÍ transfirió plata —₡5.000, referencia
 * 406490614— así que no se revierte y ya: se deja lo que pagó y la beca cubre
 * la diferencia.
 *
 * SIN CORREO AUTOMÁTICO (decisión del usuario 2026-09-12). La plantilla de beca
 * parcial le diría "te quedan ₡5.000 por pagar" y "elegí tu beca al
 * inscribirte": las dos cosas ya las hizo. Se enciende el modo silencioso solo
 * para este proceso, así el resto del flujo real —beca, notificación interna,
 * historial de la solicitud— sí ocurre. Finanzas le escribe a mano.
 */
process.env.EMAIL_SILENT_MODE = '1'

import { createAdminClient } from '@/lib/supabase/admin'
import { approveScholarshipRequest, applyScholarshipToPayment } from '@/lib/supabase/queries/scholarships'
import { updateFinanceRequestStatus } from '@/lib/supabase/queries/finance-requests'
import { revertPaymentApproval, approvePayment } from '@/lib/supabase/queries/payments'
import { isEmailSilentMode } from '@/lib/email/silent-mode'

const APLICAR = process.argv.includes('--aplicar')
const EXT = '1784', NOMBRE = 'Valeria Diaz Zamora'
const PAGADO_DE_VERDAD = 5000, BECA = 15000
const MOTIVO = 'El monto registrado no corresponde: la transferencia fue de ₡5.000, no de ₡20.000. Se corrige y la beca cubre la diferencia.'
const FINANZAS = 'fd7666c2-d552-4c3c-97cd-37effd8edf50'

async function foto(sb: ReturnType<typeof createAdminClient>, memberId: string) {
  const { data: p } = await sb.from('payments')
    .select('id, amount, status, review_status, payment_method, reference_code, scholarship_id, enrollment_id')
    .eq('member_id', memberId).eq('concept', 'matricula').maybeSingle()
  const pago = p as Record<string, unknown> | null
  const { data: e } = await sb.from('study_enrollments').select('status').eq('id', String(pago?.enrollment_id ?? '')).maybeSingle()
  const { data: b } = await sb.from('scholarships')
    .select('discount_type, discount_value, status, email_sent_at').eq('member_id', memberId).maybeSingle()
  return { pago, matricula: (e as { status: string } | null)?.status ?? '—', beca: b }
}

async function main() {
  const sb = createAdminClient()
  console.log(`modo silencioso: ${isEmailSilentMode() ? 'ENCENDIDO — no sale correo' : '⚠️ APAGADO'}\n`)
  const { data: m } = await sb.from('members').select('id, first_name, last_name, email').eq('external_id', EXT).maybeSingle()
  const mm = m as { id: string; first_name: string; last_name: string; email: string | null } | null
  if (!mm) { console.error('ABORTA — no hay ficha'); process.exit(1) }
  const completo = `${mm.first_name} ${mm.last_name}`.trim()
  if (completo !== NOMBRE) { console.error(`ABORTA — ${EXT} es «${completo}»`); process.exit(1) }

  const antes = await foto(sb, mm.id)
  console.log(`${completo}  (${mm.email})\n`)
  console.log('ANTES:')
  console.log(`   pago:      ₡${antes.pago?.amount} ${antes.pago?.status}/${antes.pago?.review_status}  ref «${antes.pago?.reference_code}»`)
  console.log(`   matrícula: ${antes.matricula}`)
  console.log(`   beca:      ${antes.beca ? JSON.stringify(antes.beca) : 'no tiene'}`)

  const { data: fr } = await sb.from('finance_requests')
    .select('id').eq('member_id', mm.id).eq('request_type', 'scholarship').maybeSingle()
  const req = fr as { id: string } | null
  if (!req) { console.error('ABORTA — no tiene solicitud de beca'); process.exit(1) }

  if (!APLICAR) {
    console.log('\nSE HARÍA:')
    console.log(`   1. revertir el pago de ₡${antes.pago?.amount}`)
    console.log(`   2. crear su beca de ₡${BECA} (monto fijo, parcial) — SIN correo`)
    console.log(`   3. aplicarla al pago → queda en ₡${PAGADO_DE_VERDAD}`)
    console.log(`   4. aprobar esos ₡${PAGADO_DE_VERDAD}, que sí transfirió (ref ${antes.pago?.reference_code})`)
    console.log('\n🔎 DRY RUN — no se escribió nada.')
    return
  }

  const { data: rev } = await sb.from('members').select('auth_user_id').eq('id', FINANZAS).maybeSingle()
  const authId = (rev as { auth_user_id: string | null } | null)?.auth_user_id
  if (!authId) { console.error('ABORTA — el usuario de finanzas no tiene cuenta'); process.exit(1) }

  console.log(`\n1. pago revertido: ${await revertPaymentApproval(String(antes.pago!.id), FINANZAS, MOTIVO)}`)

  if (!antes.beca) {
    await updateFinanceRequestStatus(req.id, 'in_review', FINANZAS, 'Reapertura para crear la beca que la aprobación del 11-set no llegó a crear.')
    await approveScholarshipRequest(req.id, {
      discount_type: 'fixed', discount_value: BECA, approval_type: 'parcial',
      reviewerMemberId: FINANZAS, reviewerUserId: authId,
    })
    console.log(`2. beca de ₡${BECA} creada (correo silenciado)`)
  } else console.log('2. ya tenía beca — se salta')

  const { data: b2 } = await sb.from('scholarships').select('id').eq('member_id', mm.id).eq('status', 'active').maybeSingle()
  const r = await applyScholarshipToPayment(String(antes.pago!.id), { scholarship_id: String((b2 as { id: string }).id) }, FINANZAS)
  console.log(`3. beca aplicada: el pago queda en ₡${r.amount} (cubierto=${r.covered})`)

  if (Number(r.amount) !== PAGADO_DE_VERDAD) {
    console.error(`ABORTA ANTES DE APROBAR — el saldo quedó en ₡${r.amount} y se esperaba ₡${PAGADO_DE_VERDAD}`)
    process.exit(1)
  }
  /**
   * approve_payment exige review_status='en_revision', y revert_payment_approval
   * lo deja en 'rechazado'. Sin este paso el RPC devuelve false en silencio y la
   * persona queda peor que antes: pago pendiente y matrícula en
   * pendiente_de_pago. Pasó en la primera corrida.
   */
  await sb.from('payments').update({ review_status: 'en_revision', rejection_reason: null }).eq('id', String(antes.pago!.id))
  const aprobado = await approvePayment(String(antes.pago!.id), FINANZAS)
  console.log(`4. saldo aprobado: ${aprobado}`)
  if (!aprobado) { console.error('ABORTA — el saldo no se aprobó; la matrícula quedaría en pendiente_de_pago'); process.exit(1) }

  const despues = await foto(sb, mm.id)
  console.log('\nDESPUÉS:')
  console.log(`   pago:      ₡${despues.pago?.amount} ${despues.pago?.status}/${despues.pago?.review_status}  beca=${despues.pago?.scholarship_id ? 'sí' : 'no'}`)
  console.log(`   matrícula: ${despues.matricula}`)
  console.log(`   beca:      ${JSON.stringify(despues.beca)}`)
  console.log(`\n   cuadre: ₡${despues.pago?.amount} pagados + ₡${BECA} de beca = ₡${Number(despues.pago?.amount) + BECA}`)
  console.log('\n✅ APLICADO')
}
main().catch(e => { console.error(e); process.exit(1) })
