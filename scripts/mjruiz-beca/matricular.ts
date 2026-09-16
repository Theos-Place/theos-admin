/**
 * Matricula a María José Ruiz en LECTPROP — La Sabana dejándole UN pago
 * aprobado con la beca del 100% (2026-09-16, pedido por TI).
 *
 * POR QUÉ EN DOS PASOS Y NO PASÁNDOLE LA BECA A enrollMember. Con la beca
 * aplicada de una, el monto queda en 0, `requiresPaymentFinal` es false y NO se
 * crea ningún pago: la matrícula nace 'enrolled' y en finanzas no queda rastro.
 * Lo pedido es que quede un pago aprobado, así que se usa el mismo camino que
 * usaría finanzas desde la cola: matricular normal (cobro pendiente de ₡20.000)
 * y después aplicarle la beca. `applyScholarshipToPayment` con una beca que
 * cubre todo baja el pago a 0, lo marca payment_method='scholarship', consume la
 * beca (deja la redención) y lo aprueba con approve_payment — el mismo RPC de la
 * cola de revisión, que además libera la matrícula a 'enrolled'.
 *
 * OJO: estas funciones van por PostgREST, o sea FUERA de una transacción de pg.
 * No hay rollback. Por eso cada paso se verifica antes de seguir.
 */
import { enrollMember } from '@/lib/supabase/queries/studies'
import { applyScholarshipToPayment } from '@/lib/supabase/queries/scholarships'
import { createAdminClient } from '@/lib/supabase/admin'

const MJ       = '2c04a86e-0166-4156-8b3b-d9477ab257c3'
const GRUPO    = '253a16e5-ece9-44e8-bfaa-d7717db37b95' // LECTPROP — La Sabana
const BECA_100 = '0099e13a-1673-4ada-a793-62ce57c4feb6'
const TI       = 'c6995364-54f0-4ec6-8d5d-275fa2461f7f' // member_id de ti@theosplace.org

async function main() {
  const sb = createAdminClient()
  const aplicar = process.argv.includes('--aplicar')

  // --- Guardas de partida
  const { data: beca } = await sb.from('scholarships')
    .select('status, is_used, discount_value, plan_id').eq('id', BECA_100).maybeSingle()
  const b = beca as { status: string; is_used: boolean; discount_value: number; plan_id: string } | null
  if (!b || b.status !== 'active' || b.is_used) throw new Error('GUARDA: la beca no está activa y sin usar')
  if (Number(b.discount_value) !== 100) throw new Error('GUARDA: la beca no es del 100%')

  const { data: pagosAntes } = await sb.from('payments').select('id').eq('member_id', MJ)
  if ((pagosAntes ?? []).length !== 0) throw new Error(`GUARDA: esperaba 0 pagos, hay ${(pagosAntes ?? []).length}`)

  if (!aplicar) { console.log('DRY-RUN: guardas OK. Corré con --aplicar para escribir.'); return }

  // --- Paso 1: matricular normal (genera el cobro de ₡20.000 pendiente)
  const r = await enrollMember(GRUPO, MJ, undefined, { recordedBy: TI, allowPendingStudyPayments: true })
  console.log('1) matriculada:', JSON.stringify(r))
  if (!r.requires_payment) throw new Error('PARÁ: no se generó cobro; revisá a mano antes de seguir')

  const { data: pago } = await sb.from('payments')
    .select('id, amount, status').eq('enrollment_id', r.enrollment_id).eq('concept', 'matricula')
    .eq('status', 'pending').maybeSingle()
  const p = pago as { id: string; amount: number; status: string } | null
  if (!p) throw new Error('PARÁ: no encuentro el cobro pendiente recién creado')
  console.log('   cobro pendiente:', JSON.stringify(p))

  // --- Paso 2: aplicarle la beca del 100% (baja a 0, se aprueba y libera la matrícula)
  const ap = await applyScholarshipToPayment(p.id, { scholarship_id: BECA_100 }, TI)
  console.log('2) beca aplicada:', JSON.stringify(ap))

  // --- Verificación final
  const [{ data: pagosFin }, { data: matFin }, { data: becaFin }, { data: red }] = await Promise.all([
    sb.from('payments').select('id, amount, status, payment_method, scholarship_id, review_status, concept').eq('member_id', MJ),
    sb.from('study_enrollments').select('id, status, dropped_at, drop_reason').eq('id', r.enrollment_id).maybeSingle(),
    sb.from('scholarships').select('id, status, is_used, used_at').eq('id', BECA_100).maybeSingle(),
    sb.from('scholarship_redemptions').select('id, final_amount, enrollment_id').eq('scholarship_id', BECA_100),
  ])
  console.log('\n=== estado final ===')
  console.log('pagos:     ', JSON.stringify(pagosFin))
  console.log('matrícula: ', JSON.stringify(matFin))
  console.log('beca:      ', JSON.stringify(becaFin))
  console.log('redención: ', JSON.stringify(red))
}

main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
