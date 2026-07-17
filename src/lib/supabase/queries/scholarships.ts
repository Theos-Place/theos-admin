import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateFinanceRequestStatus } from '@/lib/supabase/queries/finance-requests'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { formatCRC } from '@/lib/format'

const SCHOLARSHIP_ERROR_MESSAGES: Record<string, string> = {
  SCHOLARSHIP_NOT_FOUND: 'La beca indicada no existe o no aplica para tu cuenta.',
  SCHOLARSHIP_CODE_INVALID: 'El código no es válido.',
  SCHOLARSHIP_CODE_EXPIRED: 'El código ya venció.',
  SCHOLARSHIP_WRONG_TARGET: 'Ese código no aplica para este estudio/evento.',
  SCHOLARSHIP_ALREADY_USED: 'Ya usaste esta beca/código antes.',
}

/** Traduce los errores de aplicar una beca (resolveScholarshipForApplication/
 *  consumeScholarship) a una respuesta HTTP. Devuelve null si el error no es
 *  de becas (el caller debe seguir con su propio manejo). */
export function scholarshipErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) return null
  const message = SCHOLARSHIP_ERROR_MESSAGES[error.message]
  if (!message) return null
  const status = error.message === 'SCHOLARSHIP_ALREADY_USED' ? 409 : 400
  return NextResponse.json({ error: message }, { status })
}

// Becas/cupones — mismo patrón que study_requirement_exceptions (active/used/
// revoked, referencia por plan_id, un solo uso). Tabla `scholarships` (migración
// 122): kind 'asignada' (member_id fijo, sin código) | 'generica' (código,
// member_id null, varios usos hasta expires_at, uno por persona vía
// scholarship_redemptions). El consumo ocurre al APLICAR la beca (inscribirse/
// matricularse), nunca al aprobar el comprobante.

export type ScholarshipEntityType = 'study_plan' | 'event'
export type ScholarshipKind = 'asignada' | 'generica'
export type ScholarshipStatus = 'active' | 'used' | 'revoked'
export type DiscountType = 'percentage' | 'fixed'
export type ApprovalType = 'total' | 'parcial'

export type Scholarship = {
  id: string
  kind: ScholarshipKind
  member_id: string | null
  member_name: string | null
  entity_type: ScholarshipEntityType
  plan_id: string | null
  event_id: string | null
  entity_name: string
  discount_type: DiscountType
  discount_value: number
  code: string | null
  expires_at: string | null
  approval_type: ApprovalType | null
  status: ScholarshipStatus
  used_at: string | null
  used_count: number
  created_at: string
}

/** Redondea al colón (CRC no usa decimales en la práctica de este sistema). */
export function computeDiscountedAmount(original: number, type: DiscountType, value: number): number {
  if (type === 'percentage') return Math.max(0, Math.round(original * (1 - value / 100)))
  return Math.max(0, Math.round(original - value))
}

export function formatDiscount(type: DiscountType, value: number): string {
  if (type === 'percentage') return `${value}%`
  return `${formatCRC(value)}`
}

const SELECT = `
  id, kind, member_id, entity_type, plan_id, event_id, discount_type, discount_value,
  code, expires_at, approval_type, status, used_at, created_at,
  member:members!scholarships_member_id_fkey(first_name, last_name),
  plan:study_plans!scholarships_plan_id_fkey(name),
  event:events!scholarships_event_id_fkey(title)
`

type DbRow = {
  id: string
  kind: ScholarshipKind
  member_id: string | null
  entity_type: ScholarshipEntityType
  plan_id: string | null
  event_id: string | null
  discount_type: DiscountType
  discount_value: number
  code: string | null
  expires_at: string | null
  approval_type: ApprovalType | null
  status: ScholarshipStatus
  used_at: string | null
  created_at: string
  member: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  plan: { name: string } | { name: string }[] | null
  event: { title: string } | { title: string }[] | null
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function toDomain(r: DbRow, usedCount = 0): Scholarship {
  const member = one(r.member)
  const plan = one(r.plan)
  const event = one(r.event)
  return {
    id: r.id,
    kind: r.kind,
    member_id: r.member_id,
    member_name: member ? `${member.first_name} ${member.last_name}`.trim() : null,
    entity_type: r.entity_type,
    plan_id: r.plan_id,
    event_id: r.event_id,
    entity_name: plan?.name ?? event?.title ?? '—',
    discount_type: r.discount_type,
    discount_value: Number(r.discount_value),
    code: r.code,
    expires_at: r.expires_at,
    approval_type: r.approval_type,
    status: r.status,
    used_at: r.used_at,
    used_count: usedCount,
    created_at: r.created_at,
  }
}

/** Cola de gestión (pantalla /finanzas/becas). */
export async function getScholarshipsQueue(filters?: { kind?: ScholarshipKind; status?: ScholarshipStatus }): Promise<Scholarship[]> {
  const supabase = createAdminClient()
  let q = supabase.from('scholarships').select(SELECT).order('created_at', { ascending: false })
  if (filters?.kind) q = q.eq('kind', filters.kind)
  if (filters?.status) q = q.eq('status', filters.status)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as DbRow[]

  // Conteo de usos de cupones genéricos (para mostrar "usado N veces").
  const genericIds = rows.filter(r => r.kind === 'generica').map(r => r.id)
  const counts = new Map<string, number>()
  if (genericIds.length) {
    const { data: redemptions } = await supabase
      .from('scholarship_redemptions').select('scholarship_id').in('scholarship_id', genericIds)
    for (const red of (redemptions ?? []) as Array<{ scholarship_id: string }>) {
      counts.set(red.scholarship_id, (counts.get(red.scholarship_id) ?? 0) + 1)
    }
  }
  return rows.map(r => toDomain(r, counts.get(r.id) ?? 0))
}

/** Becas asignadas de un miembro (cualquier estado) — para "Mis becas" del perfil. */
export async function getMemberScholarships(memberId: string): Promise<Scholarship[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('scholarships').select(SELECT)
    .eq('kind', 'asignada').eq('member_id', memberId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as DbRow[]).map(r => toDomain(r))
}

/** Beca asignada activa de un miembro para un destino específico (para
 *  precargar el selector en el paso de pago). */
export async function findApplicableScholarship(
  memberId: string, entityType: ScholarshipEntityType, entityId: string,
): Promise<Scholarship | null> {
  const supabase = createAdminClient()
  let q = supabase.from('scholarships').select(SELECT)
    .eq('kind', 'asignada').eq('member_id', memberId).eq('status', 'active').eq('entity_type', entityType)
  q = entityType === 'study_plan' ? q.eq('plan_id', entityId) : q.eq('event_id', entityId)
  const { data, error } = await q.limit(1).maybeSingle()
  if (error) throw error
  return data ? toDomain(data as DbRow) : null
}

export type CodeValidationError = 'invalid_code' | 'expired' | 'wrong_target' | 'already_used'

/** Valida un código genérico para un destino/miembro dados. */
export async function validateGenericCode(
  code: string, entityType: ScholarshipEntityType, entityId: string, memberId: string,
): Promise<{ scholarship: Scholarship } | { error: CodeValidationError }> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('scholarships').select(SELECT)
    .eq('code', code.trim()).eq('kind', 'generica').eq('status', 'active').maybeSingle()
  if (!data) return { error: 'invalid_code' }
  const row = data as DbRow
  if (row.entity_type !== entityType || (entityType === 'study_plan' ? row.plan_id : row.event_id) !== entityId) {
    return { error: 'wrong_target' }
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return { error: 'expired' }
  const { data: existing } = await supabase
    .from('scholarship_redemptions').select('id').eq('scholarship_id', row.id).eq('member_id', memberId).maybeSingle()
  if (existing) return { error: 'already_used' }
  return { scholarship: toDomain(row) }
}

/** Marca la beca como consumida. Asignada: UPDATE condicional atómico
 *  (0 filas afectadas = ya usada, carrera perdida). Genérica: INSERT en
 *  scholarship_redemptions (23505 = ya usada por esta persona, el UNIQUE cierra
 *  la carrera sin necesitar lock). */
export async function consumeScholarship(
  scholarship: { id: string; kind: ScholarshipKind },
  memberId: string,
  finalAmount: number,
  refs: { enrollmentId?: string | null; eventRegistrationId?: string | null } = {},
): Promise<void> {
  const supabase = createAdminClient()
  if (scholarship.kind === 'asignada') {
    const { data, error } = await supabase.from('scholarships')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('id', scholarship.id).eq('status', 'active').eq('member_id', memberId)
      .select('id')
    if (error) throw error
    if ((data ?? []).length === 0) throw new Error('BECA_YA_USADA')
    return
  }
  const { error } = await supabase.from('scholarship_redemptions').insert({
    scholarship_id: scholarship.id,
    member_id: memberId,
    enrollment_id: refs.enrollmentId ?? null,
    event_registration_id: refs.eventRegistrationId ?? null,
    final_amount: finalAmount,
  })
  if (error) {
    if ((error as { code?: string }).code === '23505') throw new Error('BECA_YA_USADA')
    throw error
  }
}

/** Resuelve una beca/código a aplicar en una inscripción/matrícula. Tira un
 *  Error con código reconocible por las rutas API (400/409) si no es válida —
 *  a diferencia de validateGenericCode, que devuelve el error como valor. */
export async function resolveScholarshipForApplication(
  memberId: string, entityType: ScholarshipEntityType, entityId: string,
  input: { scholarship_id?: string; coupon_code?: string },
): Promise<{ id: string; kind: ScholarshipKind; discount_type: DiscountType; discount_value: number }> {
  if (input.scholarship_id) {
    const found = await findApplicableScholarship(memberId, entityType, entityId)
    if (!found || found.id !== input.scholarship_id) throw new Error('SCHOLARSHIP_NOT_FOUND')
    return { id: found.id, kind: 'asignada', discount_type: found.discount_type, discount_value: found.discount_value }
  }
  if (input.coupon_code) {
    const result = await validateGenericCode(input.coupon_code, entityType, entityId, memberId)
    if ('error' in result) {
      const map: Record<CodeValidationError, string> = {
        invalid_code: 'SCHOLARSHIP_CODE_INVALID',
        expired: 'SCHOLARSHIP_CODE_EXPIRED',
        wrong_target: 'SCHOLARSHIP_WRONG_TARGET',
        already_used: 'SCHOLARSHIP_ALREADY_USED',
      }
      throw new Error(map[result.error])
    }
    return {
      id: result.scholarship.id, kind: 'generica',
      discount_type: result.scholarship.discount_type, discount_value: result.scholarship.discount_value,
    }
  }
  throw new Error('SCHOLARSHIP_NOT_FOUND')
}

/** Crea un cupón genérico directo (sin solicitud previa). */
export async function createGenericScholarship(input: {
  entity_type: ScholarshipEntityType
  plan_id?: string | null
  event_id?: string | null
  discount_type: DiscountType
  discount_value: number
  code: string
  expires_at: string | null
  created_by: string | null
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('scholarships').insert({
    kind: 'generica',
    member_id: null,
    entity_type: input.entity_type,
    plan_id: input.entity_type === 'study_plan' ? input.plan_id : null,
    event_id: input.entity_type === 'event' ? input.event_id : null,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    code: input.code.trim(),
    expires_at: input.expires_at,
    status: 'active',
    created_by: input.created_by,
  }).select('id').single()
  if (error) {
    if ((error as { code?: string }).code === '23505') throw new Error('CODIGO_DUPLICADO')
    throw error
  }
  return data as { id: string }
}

/** Revoca una beca/cupón. Solo si sigue 'active' — si ya está 'used', el caller
 *  debe advertir en vez de dejar revocar (ActiveWarningModal). */
export async function revokeScholarship(id: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('scholarships')
    .update({ status: 'revoked' }).eq('id', id).eq('status', 'active').select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

async function resolveEntityName(entityType: ScholarshipEntityType, planId: string | null, eventId: string | null): Promise<string> {
  const supabase = createAdminClient()
  if (entityType === 'study_plan' && planId) {
    const { data } = await supabase.from('study_plans').select('name').eq('id', planId).maybeSingle()
    return (data as { name: string } | null)?.name ?? '—'
  }
  if (entityType === 'event' && eventId) {
    const { data } = await supabase.from('events').select('title').eq('id', eventId).maybeSingle()
    return (data as { title: string } | null)?.title ?? '—'
  }
  return '—'
}

/** Aprueba una solicitud de beca (total o parcial — el toggle lo define quien
 *  aprueba, no se infiere). Crea la beca asignada + resuelve la solicitud +
 *  notifica (interna + email). */
export async function approveScholarshipRequest(
  requestId: string,
  input: {
    discount_type: DiscountType; discount_value: number; approval_type: ApprovalType
    /** members.id — finance_requests.reviewed_by referencia members. */
    reviewerMemberId: string
    /** auth.users.id — scholarships.approved_by referencia auth.users (distinto de members). */
    reviewerUserId: string
  },
): Promise<void> {
  const supabase = createAdminClient()
  const { data: reqRow } = await supabase
    .from('finance_requests')
    .select('member_id, request_type, status, entity_type, plan_id, event_id')
    .eq('id', requestId).maybeSingle()
  const req = reqRow as {
    member_id: string; request_type: string; status: string
    entity_type: ScholarshipEntityType | null; plan_id: string | null; event_id: string | null
  } | null
  if (!req || req.request_type !== 'scholarship') throw new Error('Solicitud no encontrada')
  if (!['open', 'in_review'].includes(req.status)) throw new Error('La solicitud ya fue resuelta')
  if (!req.entity_type) throw new Error('La solicitud no tiene un destino definido')

  const { error: insErr } = await supabase.from('scholarships').insert({
    kind: 'asignada',
    member_id: req.member_id,
    entity_type: req.entity_type,
    plan_id: req.plan_id,
    event_id: req.event_id,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    approval_type: input.approval_type,
    status: 'active',
    request_id: requestId,
    approved_by: input.reviewerUserId,
    approved_at: new Date().toISOString(),
  })
  if (insErr) throw insErr

  await updateFinanceRequestStatus(requestId, 'resolved', input.reviewerMemberId, null)

  // Notificación interna + email (best-effort).
  try {
    const { data: m } = await supabase.from('members').select('email, first_name, last_name').eq('id', req.member_id).maybeSingle()
    const member = m as { email: string | null; first_name: string; last_name: string } | null
    const entityName = await resolveEntityName(req.entity_type, req.plan_id, req.event_id)
    const discount = formatDiscount(input.discount_type, input.discount_value)

    await supabase.from('internal_notifications').insert({
      recipient_member_id: req.member_id,
      type: 'scholarship_approved',
      title: input.approval_type === 'parcial' ? 'Tu beca fue aprobada parcialmente' : '¡Tu beca fue aprobada!',
      body: `Se te asignó un descuento de ${discount} para ${entityName}.`,
      link: null,
    })
    if (member?.email) {
      await sendSystemEmail({
        systemKey: input.approval_type === 'parcial' ? 'beca_aprobada_parcial' : 'beca_aprobada',
        to: { email: member.email, name: `${member.first_name} ${member.last_name}`.trim() },
        data: { nombre: member.first_name, nombre_estudio_evento: entityName, descuento: discount },
      })
    }
  } catch (e) {
    console.warn('approveScholarshipRequest: aviso falló:', e)
  }
}

/** Rechaza una solicitud de beca (motivo obligatorio). Sin fila en scholarships. */
export async function rejectScholarshipRequest(
  requestId: string, input: { reason: string; reviewerId: string },
): Promise<void> {
  const supabase = createAdminClient()
  const { data: reqRow } = await supabase
    .from('finance_requests')
    .select('member_id, request_type, status, entity_type, plan_id, event_id')
    .eq('id', requestId).maybeSingle()
  const req = reqRow as {
    member_id: string; request_type: string; status: string
    entity_type: ScholarshipEntityType | null; plan_id: string | null; event_id: string | null
  } | null
  if (!req || req.request_type !== 'scholarship') throw new Error('Solicitud no encontrada')
  if (!['open', 'in_review'].includes(req.status)) throw new Error('La solicitud ya fue resuelta')

  await updateFinanceRequestStatus(requestId, 'rejected', input.reviewerId, input.reason)

  try {
    const { data: m } = await supabase.from('members').select('email, first_name, last_name').eq('id', req.member_id).maybeSingle()
    const member = m as { email: string | null; first_name: string; last_name: string } | null
    const entityName = req.entity_type ? await resolveEntityName(req.entity_type, req.plan_id, req.event_id) : 'tu solicitud'

    await supabase.from('internal_notifications').insert({
      recipient_member_id: req.member_id,
      type: 'scholarship_rejected',
      title: 'Sobre tu solicitud de beca',
      body: `Tu solicitud de beca para ${entityName} fue rechazada: ${input.reason}`,
      link: null,
    })
    if (member?.email) {
      await sendSystemEmail({
        systemKey: 'beca_rechazada',
        to: { email: member.email, name: `${member.first_name} ${member.last_name}`.trim() },
        data: { nombre: member.first_name, nombre_estudio_evento: entityName, motivo_rechazo: input.reason },
      })
    }
  } catch (e) {
    console.warn('rejectScholarshipRequest: aviso falló:', e)
  }
}
