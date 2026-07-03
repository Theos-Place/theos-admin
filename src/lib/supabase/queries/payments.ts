import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const { error } = await supabase
    .from('payments')
    .update({ review_status: 'aprobado', status: 'paid', reviewed_by: reviewerMemberId, reviewed_at: now, paid_at: now })
    .eq('id', id)
    .eq('review_status', 'en_revision')
  if (error) throw error
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
