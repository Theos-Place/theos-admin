// FIN-6 · Acciones sobre una devolución que no son "procesarla":
//  · convertirla en DONACIÓN (punto 4)
//  · comentarla (punto 3 — el responsable del origen ve y comenta)

import { createAdminClient } from '@/lib/supabase/admin'
import { todayCR } from '@/lib/format'

/** Estados desde los que una devolución todavía se puede convertir. */
const CONVERTIBLE = ['pending', 'processing']

export type ConvertResult = {
  donation_id: string
  amount: number
  currency: string
  /** Estado en el que quedó el pago original. */
  payment_status: string
}

/**
 * Convierte la devolución en donación: la persona no quiere el reembolso.
 *
 * Contabilidad confirmó la conversión (2026-08-21). Mecánica:
 *  1. Se crea la donación con la FECHA DE CONVERSIÓN, ligada al miembro y con
 *     referencia cruzada al refund (donations.refund_id).
 *  2. La devolución queda RESUELTA como 'convertida_donacion' — no se borra
 *     (sin soft-delete y con historial en las notas).
 *  3. El pago original pasa a refunded/partial_refund. Esto es lo que evita
 *     contar la plata DOS VECES: si el pago siguiera 'paid', los totales
 *     mostrarían el ingreso del estudio Y la donación por el mismo dinero.
 *  4. El trigger de is_donor se dispara solo al insertar la donación.
 *
 * Idempotente: el índice único donations.refund_id impide crear dos donaciones
 * para la misma devolución si el POST se reintenta.
 *
 * Errores: DEVOLUCION_NO_ENCONTRADA, DEVOLUCION_YA_RESUELTA, SIN_MIEMBRO,
 * YA_CONVERTIDA.
 */
export async function convertRefundToDonation(
  refundId: string,
  actorMemberId: string | null,
): Promise<ConvertResult> {
  const supabase = createAdminClient()

  const { data: refRow } = await supabase
    .from('refunds')
    .select('id, payment_id, member_id, amount, currency, status, notes')
    .eq('id', refundId)
    .maybeSingle()
  if (!refRow) throw new Error('DEVOLUCION_NO_ENCONTRADA')
  const ref = refRow as {
    id: string; payment_id: string; member_id: string | null
    amount: number; currency: string; status: string; notes: string | null
  }

  if (!CONVERTIBLE.includes(ref.status)) throw new Error('DEVOLUCION_YA_RESUELTA')
  // Sin miembro no hay a quién acreditar la donación (y el trigger de is_donor
  // no haría nada).
  if (!ref.member_id) throw new Error('SIN_MIEMBRO')

  const fecha = todayCR()
  const monto = Number(ref.amount)

  const { data: donRow, error: donErr } = await supabase
    .from('donations')
    .insert({
      member_id: ref.member_id,
      amount: monto,
      currency: ref.currency ?? 'CRC',
      donation_date: fecha,
      is_identified: true,
      refund_id: ref.id,
    })
    .select('id')
    .single()
  if (donErr) {
    // 23505 = el índice único de refund_id: ya se había convertido.
    if ((donErr as { code?: string }).code === '23505') throw new Error('YA_CONVERTIDA')
    throw donErr
  }
  const donationId = (donRow as { id: string }).id

  // La devolución queda resuelta. Guard optimista sobre el estado: si otra
  // sesión la resolvió en el medio, se revierte la donación.
  const nota = [ref.notes, `Convertida en donación el ${fecha}.`].filter(Boolean).join('\n')
  const { data: updated, error: updErr } = await supabase
    .from('refunds')
    .update({ status: 'convertida_donacion', processed_at: new Date().toISOString(), notes: nota })
    .eq('id', ref.id)
    .in('status', CONVERTIBLE)
    .select('id')
  if (updErr || (updated ?? []).length === 0) {
    await supabase.from('donations').delete().eq('id', donationId)
    throw updErr ?? new Error('DEVOLUCION_YA_RESUELTA')
  }

  // El pago deja de contar como cobrado (si no, la plata se contaría dos veces).
  const paymentStatus = await settlePaymentAfterRefund(ref.payment_id)

  if (actorMemberId) {
    await addRefundComment(ref.id, actorMemberId, `Convertida en donación por ${monto} ${ref.currency ?? 'CRC'}.`)
      .catch(() => { /* el comentario es traza, no bloquea la conversión */ })
  }

  return { donation_id: donationId, amount: monto, currency: ref.currency ?? 'CRC', payment_status: paymentStatus }
}

/**
 * Recalcula el estado del pago según lo devuelto/convertido. Misma regla que el
 * RPC process_refund: si lo resuelto cubre el monto del pago, 'refunded'; si no,
 * 'partial_refund'. Las conversiones cuentan igual que una devolución completada
 * — en los dos casos el pago dejó de ser un cobro efectivo del estudio/evento.
 */
async function settlePaymentAfterRefund(paymentId: string): Promise<string> {
  const supabase = createAdminClient()
  const { data: pay } = await supabase
    .from('payments').select('amount').eq('id', paymentId).maybeSingle()
  const total = Number((pay as { amount?: number } | null)?.amount ?? 0)

  const { data: rows } = await supabase
    .from('refunds').select('amount, status').eq('payment_id', paymentId)
  const resuelto = ((rows ?? []) as Array<{ amount: number; status: string }>)
    .filter(r => r.status === 'completed' || r.status === 'convertida_donacion')
    .reduce((sum, r) => sum + Number(r.amount), 0)

  const nuevo = resuelto >= total ? 'refunded' : 'partial_refund'
  await supabase.from('payments').update({ status: nuevo }).eq('id', paymentId)
  return nuevo
}

// ── Comentarios (punto 3) ───────────────────────────────────────────────────

export type RefundComment = {
  id: string
  body: string
  created_at: string
  member_id: string | null
  author_name: string | null
}

export async function addRefundComment(
  refundId: string, memberId: string | null, body: string,
): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const texto = body.trim()
  if (!texto) throw new Error('COMENTARIO_VACIO')
  const { data, error } = await supabase
    .from('refund_comments')
    .insert({ refund_id: refundId, member_id: memberId, body: texto })
    .select('id')
    .single()
  if (error) throw error
  return data as { id: string }
}

export async function getRefundComments(refundId: string): Promise<RefundComment[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('refund_comments')
    .select('id, body, created_at, member_id, member:members!refund_comments_member_id_fkey(first_name, last_name)')
    .eq('refund_id', refundId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map(r => {
    const m = (Array.isArray(r.member) ? r.member[0] : r.member) as
      { first_name?: string; last_name?: string } | null
    return {
      id: r.id as string,
      body: r.body as string,
      created_at: r.created_at as string,
      member_id: (r.member_id as string | null) ?? null,
      author_name: m ? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || null : null,
    }
  })
}
