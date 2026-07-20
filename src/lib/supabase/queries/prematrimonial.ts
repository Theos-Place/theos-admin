// Flujo de inscripción al curso prematrimonial: búsqueda del cónyuge (con
// privacidad), validación de requisito (N2 para ambos), creación de la
// solicitud + pago por comprobante, cola del coordinador, creación del grupo
// con la pareja, y cancelación con devolución vía finance_request.
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeCedula } from '@/lib/cedula'
import { normalizePhone } from '@/lib/phone'
import { getMemberStudyProfile } from '@/lib/supabase/queries/studies-eligibility'
import { createComprobantePayment } from '@/lib/supabase/queries/payments'

export const PREMAT_COST = 25000
export const PREMAT_PLAN_CODE = 'PREMAT'
export const PREMAT_REQUIRED_CODE = 'N2'

const loose = () => createAdminClient() as unknown as SupabaseClient

/** Búsqueda EXACTA del cónyuge por cédula, email o teléfono. Devuelve SOLO
 *  id + nombre (privacidad: nunca se expone otro dato del cónyuge). */
export async function findSpouseByContact(raw: string): Promise<{ id: string; name: string } | null> {
  const q = (raw ?? '').trim()
  if (!q) return null
  const sb = loose()
  const sel = 'id, first_name, last_name'
  type Row = { id: string; first_name: string | null; last_name: string | null }
  const pick = (d: Row | null) => d ? { id: d.id, name: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() } : null
  // Tres coincidencias exactas independientes (la primera que exista gana).
  const ced = normalizeCedula(q)
  if (ced) {
    const { data } = await sb.from('members').select(sel).eq('cedula_normalized', ced).limit(1).maybeSingle()
    if (data) return pick(data as Row)
  }
  if (q.includes('@')) {
    const { data } = await sb.from('members').select(sel).ilike('email', q.toLowerCase().replace(/[\\%_]/g, m => `\\${m}`)).limit(1).maybeSingle()
    if (data) return pick(data as Row)
  }
  const phone = normalizePhone(q)
  if (phone) {
    const { data } = await sb.from('members').select(sel).eq('phone', phone).limit(1).maybeSingle()
    if (data) return pick(data as Row)
  }
  return null
}

/** ¿El miembro completó N2 (Nivel 2)? Reusa la lógica de elegibilidad. */
export async function hasCompletedN2(memberId: string): Promise<boolean> {
  const profile = await getMemberStudyProfile(memberId)
  return (profile?.completed_codes ?? []).includes(PREMAT_REQUIRED_CODE)
}

export type PrematLogistica = {
  available_days: string[]
  available_times: string[]
  zones: string[]
  can_host: boolean
  host_address?: string | null
  host_maps_url?: string | null
}
export type PrematCeremonia = {
  ceremony_date?: string | null
  ceremony_date_defined: boolean
  venue_defined: boolean
  venue_outside_gam: boolean
  officiant?: string | null
  comments?: string | null
}

/** Crea la solicitud prematrimonial + el pago por comprobante (concept
 *  'prematrimonial', en revisión). El pago es la llave del flujo. */
export async function createPrematrimonialRequest(input: {
  requesterMemberId: string
  spouseMemberId: string
  logistica: PrematLogistica
  ceremonia: PrematCeremonia
  receiptPath: string
  referenceCode: string | null
}): Promise<{ id: string; payment_id: string }> {
  const sb = loose()
  // Guard doble-submit: ya hay una solicitud activa para esta pareja.
  const { data: dup } = await sb.from('prematrimonial_requests')
    .select('id')
    .eq('requester_member_id', input.requesterMemberId)
    .eq('spouse_member_id', input.spouseMemberId)
    .in('status', ['pago_en_revision', 'pendiente'])
    .limit(1).maybeSingle()
  if (dup) throw new Error('SOLICITUD_ACTIVA_EXISTE')

  const payment = await createComprobantePayment({
    member_id: input.requesterMemberId,
    amount: PREMAT_COST,
    concept: 'prematrimonial',
    reference_code: input.referenceCode,
    receipt_path: input.receiptPath,
  })

  const { data, error } = await sb.from('prematrimonial_requests').insert({
    requester_member_id: input.requesterMemberId,
    spouse_member_id: input.spouseMemberId,
    status: 'pago_en_revision',
    available_days: input.logistica.available_days,
    available_times: input.logistica.available_times,
    zones: input.logistica.zones,
    can_host: input.logistica.can_host,
    host_address: input.logistica.host_address ?? null,
    host_maps_url: input.logistica.host_maps_url ?? null,
    ceremony_date: input.ceremonia.ceremony_date ?? null,
    ceremony_date_defined: input.ceremonia.ceremony_date_defined,
    venue_defined: input.ceremonia.venue_defined,
    venue_outside_gam: input.ceremonia.venue_outside_gam,
    officiant: input.ceremonia.officiant ?? null,
    comments: input.ceremonia.comments ?? null,
    payment_id: payment.id,
    created_by: input.requesterMemberId,
  }).select('id').single()
  if (error) throw error
  const reqId = (data as { id: string }).id
  await sb.from('prematrimonial_request_status_history').insert({
    request_id: reqId, from_status: null, to_status: 'pago_en_revision',
    changed_by: input.requesterMemberId, notes: 'Solicitud creada; pago en revisión.',
  })
  return { id: reqId, payment_id: payment.id }
}

/** Cola del coordinador: solicitudes con su logística/ceremonia y los nombres
 *  de la pareja (para armar el grupo). */
export async function getPrematrimonialQueue(statuses = ['pendiente', 'pago_en_revision', 'grupo_creado', 'cancelada']) {
  const sb = loose()
  const { data, error } = await sb.from('prematrimonial_requests')
    .select(`*,
      requester:members!prematrimonial_requests_requester_member_id_fkey(id, first_name, last_name),
      spouse:members!prematrimonial_requests_spouse_member_id_fkey(id, first_name, last_name),
      payment:payments!prematrimonial_requests_payment_id_fkey(id, review_status, status)`)
    .in('status', statuses)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** El coordinador crea el grupo prematrimonial y agrega a la pareja. El pago ya
 *  cumplió su función (no se re-verifica): se insertan los enrollments como
 *  'enrolled' directo (sin re-cobro, a diferencia de enrollMember). */
export async function createGroupForRequest(
  requestId: string,
  group: { name: string; leader_id: string; co_leader_id?: string | null; zone?: string | null; schedule_days?: string[] | null; schedule_time?: string | null; starts_at?: string | null; location?: string | null },
  actorId: string,
): Promise<{ group_id: string }> {
  const sb = loose()
  const { data: req } = await sb.from('prematrimonial_requests')
    .select('id, status, requester_member_id, spouse_member_id').eq('id', requestId).maybeSingle()
  const r = req as { status: string; requester_member_id: string; spouse_member_id: string } | null
  if (!r) throw new Error('NO_ENCONTRADA')
  if (r.status !== 'pendiente') throw new Error('ESTADO_INVALIDO')

  const { data: plan } = await sb.from('study_plans').select('id').eq('code', PREMAT_PLAN_CODE).maybeSingle()
  const planId = (plan as { id: string } | null)?.id
  if (!planId) throw new Error('PLAN_NO_ENCONTRADO')

  const { data: g, error: gErr } = await sb.from('study_groups').insert({
    plan_id: planId,
    name: group.name,
    leader_id: group.leader_id,
    co_leader_id: group.co_leader_id ?? null,
    zone: group.zone ?? null,
    schedule_days: group.schedule_days ?? null,
    schedule_time: group.schedule_time ?? null,
    starts_at: group.starts_at ?? null,
    location: group.location ?? null,
    status: 'en_matricula',
  }).select('id').single()
  if (gErr) throw gErr
  const groupId = (g as { id: string }).id

  // Agregar a la pareja como enrolled (sin re-cobro: el pago ya fue la llave).
  const rows = [r.requester_member_id, r.spouse_member_id].map(mid => ({
    group_id: groupId, plan_id: planId, member_id: mid, status: 'enrolled',
    enrolled_at: new Date().toISOString(),
  }))
  const { error: eErr } = await sb.from('study_enrollments')
    .upsert(rows, { onConflict: 'group_id,member_id' })
  if (eErr) throw eErr

  await sb.from('prematrimonial_requests')
    .update({ status: 'grupo_creado', resulting_group_id: groupId, reviewed_by: actorId })
    .eq('id', requestId)
  await sb.from('prematrimonial_request_status_history').insert({
    request_id: requestId, from_status: 'pendiente', to_status: 'grupo_creado',
    changed_by: actorId, notes: 'Grupo creado y pareja asignada.',
  })
  return { group_id: groupId }
}

/** Cancela la solicitud y, opcionalmente, genera una solicitud de devolución
 *  (finance_request tipo 'refund') sobre el pago, que finanzas revisa. */
export async function cancelPrematrimonialRequest(
  requestId: string, reason: string | null, withRefund: boolean, actorId: string,
): Promise<{ refund_request_id: string | null }> {
  const sb = loose()
  const { data: req } = await sb.from('prematrimonial_requests')
    .select('id, status, payment_id, requester_member_id').eq('id', requestId).maybeSingle()
  const r = req as { status: string; payment_id: string | null; requester_member_id: string } | null
  if (!r) throw new Error('NO_ENCONTRADA')
  if (r.status === 'cancelada') throw new Error('YA_CANCELADA')

  let refundRequestId: string | null = null
  if (withRefund && r.payment_id) {
    const { createFinanceRequest } = await import('@/lib/supabase/queries/finance-requests')
    const fr = await createFinanceRequest({
      request_type: 'refund',
      member_id: r.requester_member_id,
      payment_id: r.payment_id,
      amount: PREMAT_COST,
      reason: reason ?? 'Cancelación de inscripción prematrimonial',
    })
    refundRequestId = fr.id
  }

  await sb.from('prematrimonial_requests').update({
    status: 'cancelada', canceled_by: actorId, cancel_reason: reason ?? null,
    refund_request_id: refundRequestId,
  }).eq('id', requestId)
  await sb.from('prematrimonial_request_status_history').insert({
    request_id: requestId, from_status: r.status, to_status: 'cancelada',
    changed_by: actorId, notes: reason ?? (withRefund ? 'Cancelada con devolución.' : 'Cancelada.'),
  })
  return { refund_request_id: refundRequestId }
}
