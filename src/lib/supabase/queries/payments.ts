import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { nextLevelCode } from '@/lib/studies/folletos'

export const PAYMENT_RECEIPTS_BUCKET = 'payment-receipts'

// Columnas nuevas de payments (comprobante) no están en los tipos generados →
// cliente laxo para esas operaciones.
function looseClient(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

export type PaymentConcept = 'matricula' | 'folletos'
export type PaymentReviewStatus = 'en_revision' | 'aprobado' | 'rechazado'

export type PaymentQueueRow = {
  id: string
  member_id: string
  member_name: string
  concept: PaymentConcept | null
  amount: number
  currency: string
  reference_code: string | null
  receipt_path: string | null
  created_at: string
  duplicate_reference: boolean
}

/** Crea un pago por comprobante en estado de revisión. status='pending' (finanzas)
 *  + review_status='en_revision' (flujo de comprobante). */
export async function createComprobantePayment(input: {
  member_id: string
  amount: number
  concept: PaymentConcept
  enrollment_id?: string | null
  folleto_request_id?: string | null
  study_group_id?: string | null
  reference_code: string | null
  receipt_path: string
}): Promise<{ id: string }> {
  const supabase = looseClient()
  const { data, error } = await supabase
    .from('payments')
    .insert({
      member_id: input.member_id,
      amount: input.amount,
      currency: 'CRC',
      payment_method: 'comprobante',
      concept: input.concept,
      enrollment_id: input.enrollment_id ?? null,
      folleto_request_id: input.folleto_request_id ?? null,
      study_group_id: input.study_group_id ?? null,
      entity_type: input.concept === 'matricula' ? 'study_group' : null,
      reference_code: input.reference_code,
      receipt_path: input.receipt_path,
      status: 'pending',
      review_status: 'en_revision',
    })
    .select('id')
    .single()
  if (error) throw error
  return data as { id: string }
}

/** Matrícula automática al siguiente nivel para los aprobados de un cierre.
 *  Crea la inscripción en 'pendiente_de_pago' + el pago pendiente (concepto
 *  matricula, sin comprobante aún — el alumno lo sube desde su perfil). Evita
 *  duplicados si ya está matriculado o completó ese nivel. Devuelve cuántas creó. */
export async function autoEnrollApprovedToNextLevel(
  sourceGroupId: string,
  approvedMemberIds: string[],
): Promise<{ enrolled: number; next_level: string | null; amount: number }> {
  if (approvedMemberIds.length === 0) return { enrolled: 0, next_level: null, amount: 0 }
  const supabase = looseClient()

  // Plan origen del grupo → nivel siguiente.
  const { data: g } = await supabase.from('study_groups').select('plan:study_plans(code)').eq('id', sourceGroupId).maybeSingle()
  const planEmbed = (g as { plan: { code: string | null } | { code: string | null }[] | null } | null)?.plan
  const sourceCode = (Array.isArray(planEmbed) ? planEmbed[0] : planEmbed)?.code ?? null
  const next = nextLevelCode(sourceCode)
  if (!next) return { enrolled: 0, next_level: null, amount: 0 }

  const { data: nextPlan } = await supabase.from('study_plans').select('id, cost').eq('code', next).maybeSingle()
  const np = nextPlan as { id: string; cost: number | null } | null
  if (!np) return { enrolled: 0, next_level: next, amount: 0 }
  const amount = Number(np.cost ?? 0)

  // Dedup: quién ya tiene inscripción a ese nivel (activa/pendiente/completada/espera).
  const { data: existing } = await supabase
    .from('study_enrollments')
    .select('member_id')
    .eq('plan_id', np.id)
    .in('member_id', approvedMemberIds)
    .in('status', ['enrolled', 'pendiente_de_pago', 'completed', 'waitlist'])
  const already = new Set(((existing ?? []) as Array<{ member_id: string }>).map(r => r.member_id))

  // Si el nivel siguiente es gratis (costo 0), la matrícula queda ACTIVA de una;
  // si tiene costo, queda 'pendiente_de_pago' + pago pendiente por comprobante.
  const free = amount <= 0
  const now = new Date().toISOString()
  let enrolled = 0
  for (const memberId of approvedMemberIds) {
    if (already.has(memberId)) continue
    const { data: enr, error: enrErr } = await supabase
      .from('study_enrollments')
      .insert({ member_id: memberId, plan_id: np.id, status: free ? 'enrolled' : 'pendiente_de_pago', enrolled_at: now })
      .select('id').single()
    if (enrErr) { console.warn('auto-enroll insert:', enrErr.message); continue }
    if (!free) {
      const enrollmentId = (enr as { id: string }).id
      // Pago pendiente asociado (sin comprobante aún; el alumno lo completa).
      await supabase.from('payments').insert({
        member_id: memberId,
        amount,
        currency: 'CRC',
        payment_method: 'comprobante',
        concept: 'matricula',
        enrollment_id: enrollmentId,
        status: 'pending',
      })
    }
    enrolled++
  }
  return { enrolled, next_level: next, amount }
}

/** Sube el comprobante de una matrícula: si ya existe un pago pendiente para esa
 *  inscripción (ej. el auto-creado al cerrar), lo ACTUALIZA (adjunta comprobante +
 *  pasa a en_revision); si no, lo crea. Evita pagos duplicados por matrícula.
 *  El monto se toma del costo del plan (no del cliente). */
export async function submitEnrollmentComprobante(input: {
  enrollment_id: string
  receipt_path: string
  reference_code: string | null
}): Promise<{ id: string } | null> {
  const supabase = looseClient()
  const { data: enr } = await supabase
    .from('study_enrollments')
    .select('member_id, group_id, group:study_groups(plan:study_plans(cost)), plan_direct:study_plans!study_enrollments_plan_id_fkey(cost)')
    .eq('id', input.enrollment_id)
    .maybeSingle()
  if (!enr) return null
  const row = enr as {
    member_id: string
    group_id: string | null
    group: { plan: { cost: number | null } | { cost: number | null }[] | null } | { plan: unknown }[] | null
    plan_direct: { cost: number | null } | { cost: number | null }[] | null
  }
  const grp = Array.isArray(row.group) ? row.group[0] : row.group
  const gplan = grp ? (Array.isArray(grp.plan) ? grp.plan[0] : grp.plan) : null
  const dplan = Array.isArray(row.plan_direct) ? row.plan_direct[0] : row.plan_direct
  const amount = Number((gplan as { cost: number | null } | null)?.cost ?? dplan?.cost ?? 0)

  // ¿Ya hay un pago pendiente (sin revisar o rechazado) para esta matrícula?
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('enrollment_id', input.enrollment_id)
    .eq('concept', 'matricula')
    .eq('status', 'pending')
    .or('review_status.is.null,review_status.eq.rechazado')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const eid = (existing as { id: string }).id
    const { error } = await supabase.from('payments').update({
      receipt_path: input.receipt_path,
      reference_code: input.reference_code,
      payment_method: 'comprobante',
      review_status: 'en_revision',
      rejection_reason: null,
      amount,
    }).eq('id', eid)
    if (error) throw error
    return { id: eid }
  }

  const { data, error } = await supabase.from('payments').insert({
    member_id: row.member_id,
    amount,
    currency: 'CRC',
    payment_method: 'comprobante',
    concept: 'matricula',
    enrollment_id: input.enrollment_id,
    study_group_id: row.group_id,
    entity_type: row.group_id ? 'study_group' : null,
    reference_code: input.reference_code,
    receipt_path: input.receipt_path,
    status: 'pending',
    review_status: 'en_revision',
  }).select('id').single()
  if (error) throw error
  return { id: (data as { id: string }).id }
}

/** Cola de pagos en revisión, con nombre del miembro y detección de referencia
 *  duplicada (posible comprobante reutilizado). */
export async function getPaymentsQueue(): Promise<PaymentQueueRow[]> {
  const supabase = looseClient()
  const { data, error } = await supabase
    .from('payments')
    .select('id, member_id, amount, currency, concept, reference_code, receipt_path, created_at, member:members!payments_member_id_fkey(first_name, last_name)')
    .eq('review_status', 'en_revision')
    .order('created_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const refs = rows.map(r => (r.reference_code as string | null)?.trim()).filter((v): v is string => !!v)

  // Referencias que aparecen en más de un pago (en cualquier estado) → posible reuso.
  const dupSet = new Set<string>()
  if (refs.length) {
    const { data: allRefs } = await supabase
      .from('payments').select('reference_code').in('reference_code', refs)
    const counts = new Map<string, number>()
    for (const r of (allRefs ?? []) as Array<{ reference_code: string | null }>) {
      const k = r.reference_code?.trim()
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    for (const [k, n] of counts) if (n > 1) dupSet.add(k)
  }

  return rows.map(r => {
    const m = Array.isArray(r.member) ? r.member[0] : r.member
    const mm = m as { first_name: string; last_name: string } | null
    const ref = (r.reference_code as string | null)?.trim() ?? null
    return {
      id: r.id as string,
      member_id: r.member_id as string,
      member_name: mm ? `${mm.first_name} ${mm.last_name}`.trim() : '—',
      concept: (r.concept as PaymentConcept | null) ?? null,
      amount: Number(r.amount ?? 0),
      currency: (r.currency as string) ?? 'CRC',
      reference_code: ref,
      receipt_path: (r.receipt_path as string | null) ?? null,
      created_at: r.created_at as string,
      duplicate_reference: !!ref && dupSet.has(ref),
    }
  })
}

/** Aprueba: review_status=aprobado + status=paid (activa el objeto pagado —
 *  matrícula/folletos quedan como pagados; la fuente de verdad del "pagado" es
 *  este registro). Devuelve datos para trazabilidad. */
export async function approvePayment(id: string, reviewerMemberId: string | null): Promise<void> {
  const supabase = looseClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('payments')
    .update({ review_status: 'aprobado', status: 'paid', reviewed_by: reviewerMemberId, reviewed_at: now, paid_at: now })
    .eq('id', id)
    .eq('review_status', 'en_revision')
    .select('concept, enrollment_id')
    .maybeSingle()
  if (error) throw error

  // Activar la matrícula: pendiente_de_pago → enrolled (activa).
  const row = data as { concept: string | null; enrollment_id: string | null } | null
  if (row?.concept === 'matricula' && row.enrollment_id) {
    const { error: enrErr } = await supabase
      .from('study_enrollments')
      .update({ status: 'enrolled' })
      .eq('id', row.enrollment_id)
      .eq('status', 'pendiente_de_pago')
    if (enrErr) console.warn('activar matrícula tras pago:', enrErr.message)
  }
}

/** Rechaza: review_status=rechazado + motivo. Devuelve datos del pago para avisar
 *  a la persona (correo + notificación). */
export async function rejectPayment(id: string, reviewerMemberId: string | null, reason: string): Promise<{ member_id: string; concept: PaymentConcept | null } | null> {
  const supabase = looseClient()
  const { data, error } = await supabase
    .from('payments')
    .update({ review_status: 'rechazado', rejection_reason: reason, reviewed_by: reviewerMemberId, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('review_status', 'en_revision')
    .select('member_id, concept')
    .maybeSingle()
  if (error) throw error
  const row = data as { member_id: string; concept: PaymentConcept | null } | null
  return row
}

/** Path del comprobante + dueño, para el chequeo de permiso en la ruta de la imagen. */
export async function getPaymentReceiptMeta(id: string): Promise<{ member_id: string; receipt_path: string | null } | null> {
  const supabase = looseClient()
  const { data } = await supabase.from('payments').select('member_id, receipt_path').eq('id', id).maybeSingle()
  return (data as { member_id: string; receipt_path: string | null } | null) ?? null
}

/** URL firmada de corta duración para ver el comprobante (bucket privado). */
export async function signReceiptUrl(path: string, seconds = 120): Promise<string | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(PAYMENT_RECEIPTS_BUCKET).createSignedUrl(path, seconds)
  if (error) { console.warn('signReceiptUrl:', error.message); return null }
  return data?.signedUrl ?? null
}
