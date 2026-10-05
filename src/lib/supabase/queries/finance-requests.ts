import type { RazonDeBeca } from '@/lib/finance/solicitud-de-beca'
import {
  AVISO_GRUPO_LLENO, NOTA_DE_CONVERSION, sigueAbierta,
  TIPO_GRUPO_LLENO, TITULO_GRUPO_LLENO, cuerpoDeGrupoLleno,
  TIPO_ARREGLO_OFRECIDO, TITULO_ARREGLO_OFRECIDO, cuerpoDeArregloOfrecido,
} from '@/lib/finance/solicitud-de-beca'
import type { PlanFrequency } from '@/lib/finance/installments'
/**
 * Solicitudes financieras (becas y devoluciones) — mismo patrón que
 * study-requests. SQL en supabase/migrations/048_finance_requests.sql:
 *
 *   CREATE TABLE finance_requests (
 *     id UUID PK, member_id UUID NOT NULL → members,
 *     request_type TEXT CHECK ('scholarship','refund'),
 *     study_group_id UUID → study_groups,   -- becas
 *     payment_id UUID → payments,           -- devoluciones
 *     amount NUMERIC(12,2), reason TEXT NOT NULL,
 *     status TEXT CHECK ('open','in_review','resolved','rejected') DEFAULT 'open',
 *     reviewed_by UUID → members, reviewed_at, review_notes,
 *     created_at, updated_at
 *   );
 *   CREATE TABLE finance_request_status_history (
 *     id UUID PK, request_id UUID → finance_requests,
 *     from_status TEXT, to_status TEXT NOT NULL,
 *     changed_by UUID → members, notes TEXT, created_at
 *   );
 *
 * Notificaciones: a diferencia de estudios (lista configurable), acá se
 * notifica directo a todos los miembros con rol activo finanzas o admin.
 */
import { createAdminClient, type Updatable } from '@/lib/supabase/admin'
import type {
  FinanceRequest, FinanceRequestWriteInput, FinanceRequestStatus, FinanceRequestType,
} from '@/types/finance'

const REQUEST_SELECT = `
  id, member_id, request_type, study_group_id, payment_id, amount, reason, reason_category, status,
  reviewed_by, reviewed_at, review_notes, created_at, updated_at,
  entity_type, plan_id, event_id,
  member:members!finance_requests_member_id_fkey(first_name, last_name),
  reviewer:members!finance_requests_reviewed_by_fkey(first_name, last_name),
  study_group:study_groups(name),
  plan:study_plans!finance_requests_plan_id_fkey(name, cost, currency),
  event:events!finance_requests_event_id_fkey(title, payment_amount, currency),
  payment:payments(amount, paid_at, description, entity_type),
  history:finance_request_status_history(from_status, to_status, notes, created_at, actor:members(first_name, last_name))
`

type DbRow = {
  id: string
  member_id: string
  request_type: FinanceRequestType
  study_group_id: string | null
  payment_id: string | null
  amount: number | null
  reason: string
  reason_category: RazonDeBeca | null
  status: FinanceRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  entity_type: 'study_plan' | 'event' | null
  plan_id: string | null
  event_id: string | null
  member: { first_name: string | null; last_name: string | null } | null
  reviewer: { first_name: string | null; last_name: string | null } | null
  study_group: { name: string | null } | null
  plan: PlanEmbed | PlanEmbed[] | null
  event: EventEmbed | EventEmbed[] | null
  payment: { amount: number | null; paid_at: string | null; description: string | null; entity_type: string | null } | null
  history: Array<{
    from_status: string | null
    to_status: string
    notes: string | null
    created_at: string
    actor: { first_name: string | null; last_name: string | null } | null
  }> | null
}

// FIN-5: el costo del destino alimenta la vista previa de la aprobación
// ("con un 50% quedan ₡7 500 por pagar").
type PlanEmbed = { name: string | null; cost: number | null; currency: string | null }
type EventEmbed = { title: string | null; payment_amount: number | null; currency: string | null }

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function fullName(p: { first_name: string | null; last_name: string | null } | null): string {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '—'
}

function paymentLabel(p: DbRow['payment']): string | null {
  if (!p) return null
  const amount = p.amount != null
    ? new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(p.amount)
    : ''
  const date = p.paid_at ? new Date(p.paid_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
  return [p.description, amount, date].filter(Boolean).join(' · ') || null
}

function toDomain(r: DbRow): FinanceRequest {
  const plan = one(r.plan)
  const event = one(r.event)
  return {
    id: r.id,
    member_id: r.member_id,
    member_name: fullName(r.member),
    request_type: r.request_type,
    study_group_id: r.study_group_id,
    study_group_name: r.study_group?.name ?? null,
    payment_id: r.payment_id,
    payment_label: paymentLabel(r.payment),
    amount: r.amount,
    reason: r.reason,
    reason_category: r.reason_category,
    status: r.status,
    reviewed_by: r.reviewed_by,
    reviewed_by_name: r.reviewer ? fullName(r.reviewer) : null,
    reviewed_at: r.reviewed_at,
    review_notes: r.review_notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
    entity_type: r.entity_type,
    plan_id: r.plan_id,
    event_id: r.event_id,
    entity_name: plan?.name ?? event?.title ?? null,
    entity_cost: plan ? (plan.cost ?? null) : event ? (event.payment_amount ?? null) : null,
    entity_currency: (plan?.currency ?? event?.currency) ?? null,
    history: (r.history ?? [])
      .map(h => ({
        from_status: h.from_status as FinanceRequestStatus | null,
        to_status: h.to_status as FinanceRequestStatus,
        notes: h.notes,
        changed_by_name: h.actor ? fullName(h.actor) : null,
        created_at: h.created_at,
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }
}

export async function getFinanceRequests(filters?: {
  status?: FinanceRequestStatus
  type?: FinanceRequestType
  member_id?: string
}): Promise<FinanceRequest[]> {
  const supabase = createAdminClient()
  let q = supabase
    .from('finance_requests')
    .select(REQUEST_SELECT)
    .order('created_at', { ascending: false })
    .limit(500)
  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.type) q = q.eq('request_type', filters.type)
  if (filters?.member_id) q = q.eq('member_id', filters.member_id)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as DbRow[]).map(toDomain)
}

export async function countOpenFinanceRequests(): Promise<number> {
  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from('finance_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
  if (error) throw error
  return count ?? 0
}

export async function createFinanceRequest(input: FinanceRequestWriteInput): Promise<FinanceRequest> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('finance_requests')
    .insert({
      member_id: input.member_id,
      recorded_by: input.recorded_by ?? null,
      request_type: input.request_type,
      study_group_id: input.study_group_id ?? null,
      reason_category: input.reason_category ?? null,
      payment_id: input.payment_id ?? null,
      amount: input.amount ?? null,
      reason: input.reason,
      entity_type: input.entity_type ?? null,
      plan_id: input.entity_type === 'study_plan' ? (input.plan_id ?? null) : null,
      event_id: input.entity_type === 'event' ? (input.event_id ?? null) : null,
    })
    .select(REQUEST_SELECT)
    .single()
  if (error) throw error
  return toDomain(data as DbRow)
}

export async function updateFinanceRequestStatus(
  id: string,
  status: FinanceRequestStatus,
  reviewedBy: string,
  reviewNotes?: string | null,
): Promise<FinanceRequest> {
  const supabase = createAdminClient()

  const { data: before } = await supabase
    .from('finance_requests').select('status').eq('id', id).maybeSingle()
  const fromStatus = (before as { status: FinanceRequestStatus } | null)?.status ?? null

  const patch: Record<string, unknown> = {
    status,
    reviewed_by: reviewedBy,
    updated_at: new Date().toISOString(),
  }
  if (status === 'resolved' || status === 'rejected') {
    patch.reviewed_at = new Date().toISOString()
    patch.review_notes = reviewNotes ?? null
  }
  const { data, error } = await supabase
    .from('finance_requests')
    .update(patch as Updatable<'finance_requests'>)
    .eq('id', id)
    .select(REQUEST_SELECT)
    .single()
  if (error) throw error

  const { error: hErr } = await supabase.from('finance_request_status_history').insert({
    request_id: id,
    from_status: fromStatus,
    to_status: status,
    changed_by: reviewedBy,
    notes: reviewNotes ?? null,
  })
  if (hErr) console.warn('updateFinanceRequestStatus: historial falló:', hErr.message)

  const result = toDomain(data as DbRow)
  result.history = [...result.history, {
    from_status: fromStatus,
    to_status: status,
    notes: reviewNotes ?? null,
    changed_by_name: result.reviewed_by_name,
    created_at: new Date().toISOString(),
  }]
  return result
}

/** Asigna la solicitud a un miembro con rol finanzas activo (espejo de
 *  assignStudyRequest): pasa a in_review con reviewed_by = el asignado,
 *  registra historial y le manda notificación interna. */
export async function assignFinanceRequest(
  id: string,
  assigneeMemberId: string,
  assignedByMemberId: string,
): Promise<FinanceRequest> {
  const supabase = createAdminClient()

  // El asignado debe tener rol finanzas activo.
  const { data: roleRow, error: roleErr } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(first_name, last_name)')
    .eq('member_id', assigneeMemberId)
    .eq('role', 'finanzas')
    .eq('is_active', true)
    .maybeSingle()
  if (roleErr) throw roleErr
  if (!roleRow) throw new Error('La persona asignada no tiene rol activo de finanzas')
  const assigneeName = fullName((roleRow as { member: { first_name: string | null; last_name: string | null } | null }).member)

  const { data: before } = await supabase
    .from('finance_requests').select('status').eq('id', id).maybeSingle()
  const fromStatus = (before as { status: FinanceRequestStatus } | null)?.status ?? null

  const { data, error } = await supabase
    .from('finance_requests')
    .update({ status: 'in_review', reviewed_by: assigneeMemberId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(REQUEST_SELECT)
    .single()
  if (error) throw error

  const { error: hErr } = await supabase.from('finance_request_status_history').insert({
    request_id: id,
    from_status: fromStatus,
    to_status: 'in_review',
    changed_by: assignedByMemberId,
    notes: `Asignada a ${assigneeName}`,
  })
  if (hErr) console.warn('assignFinanceRequest: historial falló:', hErr.message)

  const result = toDomain(data as DbRow)

  // Notificación interna al asignado (best-effort).
  const typeLabel = result.request_type === 'scholarship' ? 'beca' : 'devolución'
  const { error: nErr } = await supabase.from('internal_notifications').insert({
    recipient_member_id: assigneeMemberId,
    type: 'finance_request_assigned',
    title: 'Te asignaron una solicitud',
    body: `Te asignaron una solicitud de ${typeLabel} de ${result.member_name}`,
    link: `/finanzas/solicitudes?request=${result.id}`,
  })
  if (nErr) console.warn('assignFinanceRequest: notificación falló:', nErr.message)

  result.history = [...result.history, {
    from_status: fromStatus,
    to_status: 'in_review',
    notes: `Asignada a ${assigneeName}`,
    changed_by_name: null,
    created_at: new Date().toISOString(),
  }]
  return result
}

/** Miembros asignables a solicitudes de finanzas: rol finanzas activo. */
export async function getAssignableFinanceMembers(): Promise<Array<{ member_id: string; member_name: string }>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(first_name, last_name, is_active)')
    .eq('role', 'finanzas')
    .eq('is_active', true)
  if (error) throw error
  const byMember = new Map<string, { member_id: string; member_name: string }>()
  for (const r of (data ?? []) as Array<{
    member_id: string
    member: { first_name: string | null; last_name: string | null; is_active: boolean } | null
  }>) {
    if (!r.member?.is_active) continue
    if (!byMember.has(r.member_id)) byMember.set(r.member_id, { member_id: r.member_id, member_name: fullName(r.member) })
  }
  return Array.from(byMember.values()).sort((a, b) => a.member_name.localeCompare(b.member_name))
}

/** Notifica a todos los miembros con rol activo finanzas o admin. Best-effort. */
export async function notifyFinanceRolesOfRequest(req: FinanceRequest): Promise<void> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(is_active)')
    .in('role', ['admin', 'finanzas'])
    .eq('is_active', true)
  if (error) { console.warn('notifyFinanceRolesOfRequest:', error.message); return }
  // Mismo criterio que las solicitudes de estudio (2026-08-04): solo miembros
  // ACTIVOS, y el solicitante no se notifica a sí mismo.
  const recipients = Array.from(new Set(
    (data ?? [])
      .filter(r => (r as { member: { is_active: boolean } | null }).member?.is_active === true)
      .map(r => (r as { member_id: string }).member_id)
      .filter(id => id !== req.member_id),
  ))
  if (recipients.length === 0) return

  const isScholarship = req.request_type === 'scholarship'
  const rows = recipients.map(memberId => ({
    recipient_member_id: memberId,
    type: isScholarship ? 'finance_scholarship_request' : 'finance_refund_request',
    title: isScholarship ? 'Nueva solicitud de beca' : 'Nueva solicitud de devolución',
    body: `${req.member_name} envió una solicitud. Motivo: ${req.reason.slice(0, 140)}`,
    link: `/finanzas/solicitudes?request=${req.id}`,
  }))
  const { error: nErr } = await supabase.from('internal_notifications').insert(rows)
  if (nErr) console.warn('notifyFinanceRolesOfRequest:', nErr.message)
}

/** Pagos pagados de un miembro, para el dropdown de "Solicitar devolución". */
export async function getMemberPaidPayments(memberId: string): Promise<Array<{
  id: string; label: string
}>> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, paid_at, description, entity_type')
    .eq('member_id', memberId)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return ((data ?? []) as Array<{ id: string; amount: number | null; paid_at: string | null; description: string | null; entity_type: string | null }>)
    .map(p => ({ id: p.id, label: paymentLabel(p) ?? p.id }))
}

/**
 * BEC-5 punto 5 · El grupo se llenó: las solicitudes de beca que apuntan a
 * él pasan a «por modificar» y se les avisa.
 *
 * NO SE RECHAZAN. Rechazarlas obligaría a la persona a empezar de cero y a
 * finanzas a leer el caso otra vez. Una de las 10 solicitudes reales de
 * producción decía «la había solicitado para Romanos pero ya está lleno»:
 * esa conversación es la que esto evita.
 *
 * Se llama al matricular a alguien, cuando ese alguien ocupó el último cupo.
 * Best-effort del lado de quien llama: si falla, la matrícula que la disparó
 * NO se revierte — el cupo ya se tomó y dejar a medias una matrícula buena
 * sería peor.
 */
export async function marcarSolicitudesPorGrupoLleno(
  groupId: string,
  opciones: {
    /**
     * A quién NO avisarle: quien acaba de tomar el último cupo. Si esa misma
     * persona tenía una solicitud viva para este grupo, mandarle «el grupo se
     * llenó, elegí otro» sería mentirle — está adentro.
     */
    exceptoMemberId?: string
  } = {},
): Promise<{ movidas: number }> {
  const supabase = createAdminClient()

  // Solo las que SIGUEN VIVAS Y ESPERANDO A FINANZAS. Una ya resuelta o
  // rechazada no se reabre, y una que ya está en `por_modificar` no se vuelve
  // a avisar: la persona ya tiene el aviso sin leer.
  const { data, error } = await supabase
    .from('finance_requests')
    .select('id, member_id')
    .eq('request_type', 'scholarship')
    .eq('study_group_id', groupId)
    .in('status', ['open', 'in_review'])
  if (error) throw error
  const vivas = ((data ?? []) as Array<{ id: string; member_id: string }>)
    .filter(r => r.member_id !== opciones.exceptoMemberId)
  if (vivas.length === 0) return { movidas: 0 }

  const ahora = new Date().toISOString()
  const { error: updErr } = await supabase
    .from('finance_requests')
    .update({ status: 'por_modificar', updated_at: ahora } as Updatable<'finance_requests'>)
    .in('id', vivas.map(r => r.id))
  if (updErr) throw updErr

  // El nombre del grupo y del estudio, para que el aviso diga CUÁL se llenó.
  const { data: g } = await supabase
    .from('study_groups')
    .select('name, plan:study_plans(name)')
    .eq('id', groupId).maybeSingle()
  const grupo = (g as { name: string | null } | null)?.name ?? 'el que elegiste'
  const planEmbed = (g as { plan: { name: string } | { name: string }[] | null } | null)?.plan
  const estudio = (Array.isArray(planEmbed) ? planEmbed[0] : planEmbed)?.name ?? null

  // El historial: sin esto, la solicitud aparece en «por modificar» y nadie
  // puede decir desde cuándo ni por qué. `changed_by` va NULL a propósito —
  // no lo movió una persona, lo movió el cupo.
  const { error: hErr } = await supabase.from('finance_request_status_history').insert(
    vivas.map(r => ({
      request_id: r.id,
      from_status: null,
      to_status: 'por_modificar',
      changed_by: null,
      notes: AVISO_GRUPO_LLENO,
    })),
  )
  if (hErr) console.warn('marcarSolicitudesPorGrupoLleno: historial falló:', hErr.message)

  const { error: nErr } = await supabase.from('internal_notifications').insert(
    vivas.map(r => ({
      recipient_member_id: r.member_id,
      type: TIPO_GRUPO_LLENO,
      title: TITULO_GRUPO_LLENO,
      body: cuerpoDeGrupoLleno({ grupo, estudio }),
      link: '/mis-pagos',
    })),
  )
  if (nErr) console.warn('marcarSolicitudesPorGrupoLleno: notificación falló:', nErr.message)

  return { movidas: vivas.length }
}

/**
 * BEC-5 punto 5, lado de la persona · Cambiar el grupo de una solicitud que
 * quedó «por modificar», SIN crear una solicitud nueva.
 *
 * Es el punto entero: la solicitud conserva su razón, su monto, su historial
 * y su lugar en la fila. Lo único que cambia es a qué grupo apunta.
 *
 * Solo desde `por_modificar`. Dejar cambiar el grupo de una solicitud abierta
 * sería moverle el piso a finanzas mientras la está leyendo.
 *
 * Errores: SOLICITUD_NO_ENCONTRADA, NO_ES_SUYA, NO_SE_PUEDE_CAMBIAR,
 * GRUPO_NO_ENCONTRADO, GRUPO_DE_OTRO_ESTUDIO, GRUPO_LLENO.
 */
export async function cambiarGrupoDeSolicitud(
  id: string,
  nuevoGrupoId: string,
  quienMemberId: string,
): Promise<FinanceRequest> {
  const supabase = createAdminClient()

  const { data: fr } = await supabase
    .from('finance_requests')
    .select('id, member_id, request_type, status, plan_id, study_group_id')
    .eq('id', id).maybeSingle()
  const sol = fr as {
    member_id: string; request_type: string; status: string
    plan_id: string | null; study_group_id: string | null
  } | null
  if (!sol || sol.request_type !== 'scholarship') throw new Error('SOLICITUD_NO_ENCONTRADA')
  if (sol.member_id !== quienMemberId) throw new Error('NO_ES_SUYA')
  if (sol.status !== 'por_modificar') throw new Error('NO_SE_PUEDE_CAMBIAR')

  const { data: g } = await supabase
    .from('study_groups')
    .select('id, plan_id, status, max_students')
    .eq('id', nuevoGrupoId).maybeSingle()
  const grupo = g as { plan_id: string | null; status: string; max_students: number | null } | null
  if (!grupo) throw new Error('GRUPO_NO_ENCONTRADO')

  // El grupo nuevo tiene que ser del MISMO estudio. Si no, esto dejaría de
  // ser «elegí otro horario» y pasaría a ser una solicitud distinta — con el
  // monto y la razón de la vieja, que es justo lo que no se quiere.
  if (sol.plan_id && grupo.plan_id && grupo.plan_id !== sol.plan_id) {
    throw new Error('GRUPO_DE_OTRO_ESTUDIO')
  }

  // Y tiene que tener campo: mandarla a otro grupo lleno la devolvería acá
  // mismo en el siguiente matriculado.
  const { isGroupFull, OCCUPYING_STATUSES } = await import('@/lib/studies/enrollment-capacity')
  const { data: ocupados } = await supabase
    .from('study_enrollments')
    .select('member_id')
    .eq('group_id', nuevoGrupoId)
    .in('status', OCCUPYING_STATUSES as unknown as string[])
  if (isGroupFull({ activeCount: (ocupados ?? []).length, maxCapacity: grupo.max_students })) {
    throw new Error('GRUPO_LLENO')
  }

  const { data, error } = await supabase
    .from('finance_requests')
    .update({
      study_group_id: nuevoGrupoId,
      // Vuelve a la fila de finanzas: ya no espera a la persona.
      status: 'open',
      updated_at: new Date().toISOString(),
    } as Updatable<'finance_requests'>)
    .eq('id', id)
    .select(REQUEST_SELECT)
    .single()
  if (error) throw error

  await supabase.from('finance_request_status_history').insert({
    request_id: id,
    from_status: 'por_modificar',
    to_status: 'open',
    changed_by: quienMemberId,
    notes: 'La persona eligió otro grupo.',
  })

  const actualizada = toDomain(data as DbRow)
  // Finanzas se entera de que la solicitud volvió a su fila con otro grupo.
  await notifyFinanceRolesOfRequest(actualizada).catch(() => {})
  return actualizada
}

/**
 * BEC-5 punto 6 · «Ofrecer arreglo de pago en su lugar».
 *
 * NO ES UN RECHAZO, y la diferencia es el punto entero: «no te damos la beca»
 * y «no hay beca pero podés pagarlo en partes» son dos mensajes muy distintos,
 * y el segundo deja a la persona adentro. La solicitud queda `resolved` con la
 * nota de la conversión.
 *
 * El arreglo se arma con createPaymentPlan, el MISMO camino de FIN-8/FIN-13.
 * No hay una segunda forma de crear arreglos: los límites de
 * `limites-de-arreglo.ts` se aplican en un solo lugar y así siguen.
 *
 * Errores: SOLICITUD_NO_ENCONTRADA, SOLICITUD_CERRADA, SIN_COBRO, más los de
 * createPaymentPlan (TRACTOS_INVALIDOS, MONTO_INSUFICIENTE, …).
 */
export async function ofrecerArregloEnLugarDeBeca(
  id: string,
  opts: { installments: number; firstDue: string; frequency?: PlanFrequency; notes?: string | null },
  revisorMemberId: string,
): Promise<{ solicitud: FinanceRequest; payment_id: string; plan_id: string }> {
  const supabase = createAdminClient()

  const { data: fr } = await supabase
    .from('finance_requests')
    .select('id, member_id, request_type, status, payment_id, study_group_id, plan_id')
    .eq('id', id).maybeSingle()
  const sol = fr as {
    member_id: string; request_type: string; status: string
    payment_id: string | null; study_group_id: string | null; plan_id: string | null
  } | null
  if (!sol || sol.request_type !== 'scholarship') throw new Error('SOLICITUD_NO_ENCONTRADA')
  if (!sigueAbierta(sol.status)) throw new Error('SOLICITUD_CERRADA')

  const cobroId = sol.payment_id ?? await cobroDeLaBeca(sol)
  if (!cobroId) throw new Error('SIN_COBRO')

  const { createPaymentPlan } = await import('./payment-plans')
  const { plan } = await createPaymentPlan(cobroId, {
    installments: opts.installments,
    firstDue: opts.firstDue,
    frequency: opts.frequency,
    notes: opts.notes ?? NOTA_DE_CONVERSION,
  }, revisorMemberId)

  const solicitud = await updateFinanceRequestStatus(
    id, 'resolved', revisorMemberId,
    opts.notes?.trim() || NOTA_DE_CONVERSION,
  )

  const { error: nErr } = await supabase.from('internal_notifications').insert({
    recipient_member_id: sol.member_id,
    type: TIPO_ARREGLO_OFRECIDO,
    title: TITULO_ARREGLO_OFRECIDO,
    body: cuerpoDeArregloOfrecido(plan.installments),
    link: '/mis-pagos',
  })
  if (nErr) console.warn('ofrecerArregloEnLugarDeBeca: notificación falló:', nErr.message)

  return { solicitud, payment_id: cobroId, plan_id: plan.id }
}

/**
 * El cobro sobre el cual se arma el arreglo.
 *
 * Una solicitud de beca apunta al GRUPO o al PLAN, no al cobro — `payment_id`
 * es de las devoluciones. Así que se busca el cobro PENDIENTE de matrícula de
 * esa persona para ese destino. Si hay más de uno (un tracto viejo, un intento
 * anterior), gana el más reciente: es el de la matrícula en curso.
 */
async function cobroDeLaBeca(sol: {
  member_id: string; study_group_id: string | null; plan_id: string | null
}): Promise<string | null> {
  const supabase = createAdminClient()
  let q = supabase
    .from('payments')
    .select('id, created_at, study_group_id')
    .eq('member_id', sol.member_id)
    .eq('concept', 'matricula')
    .eq('status', 'pending')
    .is('payment_plan_id', null)   // ya partido no se vuelve a partir
    .order('created_at', { ascending: false })
  if (sol.study_group_id) q = q.eq('study_group_id', sol.study_group_id)
  const { data } = await q
  const filas = (data ?? []) as Array<{ id: string }>
  return filas[0]?.id ?? null
}
