import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { nextLevelCode } from '@/lib/studies/folletos'

export const PAYMENT_RECEIPTS_BUCKET = 'payment-receipts'


export type PaymentConcept = 'matricula' | 'folletos' | 'evento'
export type PaymentReviewStatus = 'en_revision' | 'aprobado' | 'rechazado'

/** Bucket de la cola de finanzas, derivado de (status, review_status):
 *   pendiente   → status='pending', sin comprobante (o rechazado, esperando reintento)
 *   en_revision → status='pending', comprobante subido, esperando aprobación
 *   cerrado     → status ya no es 'pending' (paid/refunded/partial_refund/failed) */
export type PaymentQueueStatus = 'pendiente' | 'en_revision' | 'cerrado'

export type PaymentQueueRow = {
  id: string
  member_id: string
  member_name: string
  concept: PaymentConcept | null
  /** Qué es el pago: nombre del estudio (matrícula/folleto) o del evento. */
  description: string
  amount: number
  currency: string
  reference_code: string | null
  receipt_path: string | null
  created_at: string
  reviewed_at: string | null
  queue_status: PaymentQueueStatus
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
  const supabase = createAdminClient()
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

/** Busca (o crea) el grupo SUCESOR del siguiente nivel: la cohorte continúa
 *  junta de N1→N2→N3→N4 con el mismo dirigente, día, horario y zona (regla de
 *  producto 2026-07-13), así que el grupo siguiente hereda esos datos del
 *  grupo que cierra. Idempotente: si ya existe un grupo del plan siguiente
 *  con el mismo dirigente/horario/zona sin finalizar, se reutiliza. */
async function findOrCreateSuccessorGroup(
  supabase: ReturnType<typeof createAdminClient>,
  src: {
    id: string; name: string | null; leader_id: string | null; co_leader_id: string | null
    zone: string | null; schedule_days: string[] | null; schedule_time: string | null
    location: string | null; sede: string | null; max_students: number | null
    age_min: number | null; age_max: number | null
  },
  nextPlanId: string,
  sourceCode: string,
  nextCode: string,
): Promise<string | null> {
  const findSuccessor = async (): Promise<string | null> => {
    let query = supabase
      .from('study_groups')
      .select('id')
      .eq('plan_id', nextPlanId)
      .in('status', ['en_matricula', 'en_curso'])
      .limit(1)
    query = src.leader_id ? query.eq('leader_id', src.leader_id) : query.is('leader_id', null)
    query = src.zone ? query.eq('zone', src.zone) : query.is('zone', null)
    query = src.schedule_time ? query.eq('schedule_time', src.schedule_time) : query.is('schedule_time', null)
    const { data, error } = await query
    if (error) { console.warn('successor find:', error.message); return null }
    return (data ?? []).length > 0 ? (data as Array<{ id: string }>)[0].id : null
  }

  const existing = await findSuccessor()
  if (existing) return existing

  // Nombre: reutiliza el del grupo origen cambiando el código de nivel.
  const name = src.name?.includes(sourceCode)
    ? src.name.replace(sourceCode, nextCode)
    : `${nextCode} · ${src.name ?? 'continuación'}`
  const { data: created, error: createErr } = await supabase
    .from('study_groups')
    .insert({
      plan_id: nextPlanId,
      name,
      leader_id: src.leader_id,
      co_leader_id: src.co_leader_id,
      zone: src.zone,
      schedule_days: src.schedule_days,
      schedule_time: src.schedule_time,
      location: src.location,
      sede: src.sede,
      max_students: src.max_students,
      age_min: src.age_min,
      age_max: src.age_max,
      status: 'en_matricula',
      current_week: 0,
    })
    .select('id').single()
  if (createErr) {
    // 23505 = perdió la carrera contra otro cierre concurrente (índice único
    // parcial study_groups_sucesor_uniq, migración 112): usar el ganador.
    if ((createErr as { code?: string }).code === '23505') {
      const winner = await findSuccessor()
      if (winner) return winner
    }
    console.warn('successor create:', createErr.message)
    return null
  }
  return (created as { id: string }).id
}

/** Matrícula automática al siguiente nivel para los aprobados de un cierre.
 *  Crea la inscripción en 'pendiente_de_pago' + el pago pendiente (concepto
 *  matricula, sin comprobante aún — el alumno lo sube desde su perfil), en el
 *  grupo SUCESOR (mismo dirigente/horario/zona; la cohorte continúa junta).
 *  Evita duplicados si ya está matriculado o completó ese nivel. Devuelve cuántas creó. */
export async function autoEnrollApprovedToNextLevel(
  sourceGroupId: string,
  approvedMemberIds: string[],
): Promise<{ enrolled: number; next_level: string | null; amount: number }> {
  if (approvedMemberIds.length === 0) return { enrolled: 0, next_level: null, amount: 0 }
  const supabase = createAdminClient()

  // Grupo origen completo (para heredar dirigente/horario/zona) + nivel siguiente.
  const { data: g } = await supabase
    .from('study_groups')
    .select('id, name, leader_id, co_leader_id, zone, schedule_days, schedule_time, location, sede, max_students, age_min, age_max, plan:study_plans(code)')
    .eq('id', sourceGroupId).maybeSingle()
  const src = g as {
    id: string; name: string | null; leader_id: string | null; co_leader_id: string | null
    zone: string | null; schedule_days: string[] | null; schedule_time: string | null
    location: string | null; sede: string | null; max_students: number | null
    age_min: number | null; age_max: number | null
    plan: { code: string | null } | { code: string | null }[] | null
  } | null
  const planEmbed = src?.plan
  const sourceCode = (Array.isArray(planEmbed) ? planEmbed[0] : planEmbed)?.code ?? null
  const next = nextLevelCode(sourceCode)
  if (!src || !next) return { enrolled: 0, next_level: null, amount: 0 }

  const { data: nextPlan } = await supabase.from('study_plans').select('id, cost').eq('code', next).maybeSingle()
  const np = nextPlan as { id: string; cost: number | null } | null
  if (!np) return { enrolled: 0, next_level: next, amount: 0 }
  const amount = Number(np.cost ?? 0)

  // Grupo sucesor (best-effort: si falla, la matrícula queda solo a nivel de plan).
  const successorGroupId = await findOrCreateSuccessorGroup(supabase, src, np.id, sourceCode!, next)

  // Dedup: quién ya tiene inscripción a ese nivel — por plan_id directo O por
  // grupo cuyo plan es el siguiente (A12: las matrículas por grupo tienen
  // plan_id NULL y el dedup anterior no las veía → 3 duplicados en prod).
  const [byPlan, byGroup] = await Promise.all([
    supabase
      .from('study_enrollments')
      .select('member_id')
      .eq('plan_id', np.id)
      .in('member_id', approvedMemberIds)
      .in('status', ['enrolled', 'pendiente_de_pago', 'completed', 'waitlist']),
    supabase
      .from('study_enrollments')
      .select('member_id, group:study_groups!study_enrollments_group_id_fkey!inner(plan_id)')
      .eq('group.plan_id', np.id)
      .in('member_id', approvedMemberIds)
      .in('status', ['enrolled', 'pendiente_de_pago', 'completed', 'waitlist']),
  ])
  const already = new Set([
    ...((byPlan.data ?? []) as Array<{ member_id: string }>).map(r => r.member_id),
    ...((byGroup.data ?? []) as Array<{ member_id: string }>).map(r => r.member_id),
  ])

  // Si el nivel siguiente es gratis (costo 0), la matrícula queda ACTIVA de una;
  // si tiene costo, queda 'pendiente_de_pago' + pago pendiente por comprobante.
  const free = amount <= 0
  const now = new Date().toISOString()
  let enrolled = 0
  for (const memberId of approvedMemberIds) {
    if (already.has(memberId)) continue
    const { data: enr, error: enrErr } = await supabase
      .from('study_enrollments')
      .insert({
        member_id: memberId,
        plan_id: np.id,
        group_id: successorGroupId,
        status: free ? 'enrolled' : 'pendiente_de_pago',
        enrolled_at: now,
      })
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
  const supabase = createAdminClient()
  const { data: enr } = await supabase
    .from('study_enrollments')
    .select('member_id, group_id, group:study_groups!study_enrollments_group_id_fkey(plan:study_plans(cost)), plan_direct:study_plans!study_enrollments_plan_id_fkey(cost)')
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

  // Si ya hay un comprobante EN REVISIÓN para esta matrícula, no se acepta
  // otro: un doble submit (doble clic / dos pestañas) creaba dos pagos en la
  // cola y ambos podían aprobarse.
  const { data: inReview } = await supabase
    .from('payments')
    .select('id')
    .eq('enrollment_id', input.enrollment_id)
    .eq('concept', 'matricula')
    .eq('review_status', 'en_revision')
    .limit(1)
  if ((inReview ?? []).length > 0) throw new Error('COMPROBANTE_EN_REVISION')

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
    // NO tocar `amount`: el pago pendiente ya existente (creado por enrollMember,
    // con beca ya descontada si aplicó) tiene el monto correcto — recalcularlo acá
    // con el costo de lista lo pisaría y borraría el descuento.
    const eid = (existing as { id: string }).id
    const { error } = await supabase.from('payments').update({
      receipt_path: input.receipt_path,
      reference_code: input.reference_code,
      payment_method: 'comprobante',
      review_status: 'en_revision',
      rejection_reason: null,
    }).eq('id', eid)
    if (error) throw error
    return { id: eid }
  }

  let insertResult
  try {
    insertResult = await supabase.from('payments').insert({
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
  } catch (e) {
    throw e
  }
  const { data, error } = insertResult
  if (error) {
    // 23505 = índice único parcial (migración 118): otro comprobante de esta
    // matrícula ya está en revisión (carrera que el check de arriba no cubre).
    if ((error as { code?: string }).code === '23505') throw new Error('COMPROBANTE_EN_REVISION')
    throw error
  }
  return { id: (data as { id: string }).id }
}

/** Sube el comprobante de una inscripción a evento: análoga a
 *  submitEnrollmentComprobante (matrícula) — reusa el pago pendiente existente
 *  si lo hay, mismo guard de doble-submit (índice único parcial, migración 121),
 *  monto resuelto server-side con registrationPricing (nunca del cliente). */
export async function submitEventComprobante(input: {
  event_registration_id: string
  receipt_path: string
  reference_code: string | null
}): Promise<{ id: string } | null> {
  const supabase = createAdminClient()
  const { data: reg } = await supabase
    .from('event_registrations')
    .select('event_id, member_id')
    .eq('id', input.event_registration_id)
    .maybeSingle()
  if (!reg) return null
  const { event_id, member_id } = reg as { event_id: string; member_id: string }

  const { registrationPricing } = await import('./events')
  const pricing = await registrationPricing(event_id, member_id)
  const amount = pricing.price

  const { data: inReview } = await supabase
    .from('payments')
    .select('id')
    .eq('event_registration_id', input.event_registration_id)
    .eq('concept', 'evento')
    .eq('review_status', 'en_revision')
    .limit(1)
  if ((inReview ?? []).length > 0) throw new Error('COMPROBANTE_EN_REVISION')

  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('event_registration_id', input.event_registration_id)
    .eq('concept', 'evento')
    .eq('status', 'pending')
    .or('review_status.is.null,review_status.eq.rechazado')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    // NO tocar `amount`: si este pago ya existía (evento con beca aplicada al
    // registrarse, migración de becas), su monto YA está descontado — recalcularlo
    // acá con el precio de lista lo pisaría y borraría el descuento.
    const eid = (existing as { id: string }).id
    const { error } = await supabase.from('payments').update({
      receipt_path: input.receipt_path,
      reference_code: input.reference_code,
      payment_method: 'comprobante',
      review_status: 'en_revision',
      rejection_reason: null,
    }).eq('id', eid)
    if (error) throw error
    return { id: eid }
  }

  const { data, error } = await supabase.from('payments').insert({
    member_id,
    amount,
    currency: 'CRC',
    payment_method: 'comprobante',
    concept: 'evento',
    event_registration_id: input.event_registration_id,
    entity_type: 'event',
    reference_code: input.reference_code,
    receipt_path: input.receipt_path,
    status: 'pending',
    review_status: 'en_revision',
  }).select('id').single()
  if (error) {
    // 23505 = índice único parcial (migración 121): otro comprobante de esta
    // inscripción ya está en revisión.
    if ((error as { code?: string }).code === '23505') throw new Error('COMPROBANTE_EN_REVISION')
    throw error
  }
  return { id: (data as { id: string }).id }
}

function computeQueueStatus(status: string, reviewStatus: string | null): PaymentQueueStatus {
  if (status !== 'pending') return 'cerrado'
  return reviewStatus === 'en_revision' ? 'en_revision' : 'pendiente'
}

/**
 * Cola de pagos pendientes de finanzas: cualquier fila de `payments` con
 * concept no nulo cae acá automáticamente (matrícula, folletos, evento — y
 * cualquier fuente futura que inserte un pago 'pending'), sin wiring extra por
 * fuente. Tres estados (ver PaymentQueueStatus). Por defecto trae lo
 * ACCIONABLE (pendiente + en_revision); 'cerrado' es historial y se limita a
 * los últimos 300 para no cargar años de pagos aprobados.
 */
export async function getPendingPaymentsQueue(filters: {
  status?: PaymentQueueStatus
  concept?: PaymentConcept
} = {}): Promise<PaymentQueueRow[]> {
  const supabase = createAdminClient()
  let q = supabase
    .from('payments')
    .select(`
      id, member_id, amount, currency, concept, reference_code, receipt_path, created_at,
      status, review_status, reviewed_at,
      member:members!payments_member_id_fkey(first_name, last_name),
      event_registration:event_registrations!payments_event_registration_id_fkey(event:events(title)),
      enrollment:study_enrollments!payments_enrollment_id_fkey(
        group:study_groups!study_enrollments_group_id_fkey(plan:study_plans(name)),
        plan_direct:study_plans!study_enrollments_plan_id_fkey(name)
      )
    `)
    .not('concept', 'is', null)

  if (filters.concept) q = q.eq('concept', filters.concept)

  if (filters.status === 'en_revision') q = q.eq('status', 'pending').eq('review_status', 'en_revision')
  else if (filters.status === 'pendiente') q = q.eq('status', 'pending').or('review_status.is.null,review_status.eq.rechazado')
  else if (filters.status === 'cerrado') q = q.neq('status', 'pending')
  else q = q.eq('status', 'pending') // sin filtro: todo lo accionable (pendiente + en_revision)

  if (filters.status === 'cerrado') {
    q = q.order('reviewed_at', { ascending: false }).limit(300)
  } else {
    q = q.order('created_at', { ascending: true }) // FIFO para lo accionable
  }

  const { data, error } = await q
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
    const er = Array.isArray(r.event_registration) ? r.event_registration[0] : r.event_registration
    const erRow = er as { event: { title: string } | { title: string }[] | null } | null
    const ev = erRow ? (Array.isArray(erRow.event) ? erRow.event[0] : erRow.event) : null
    const eventTitle = (ev as { title: string } | null)?.title ?? null

    const enr = Array.isArray(r.enrollment) ? r.enrollment[0] : r.enrollment
    const enrRow = enr as {
      group: { plan: { name: string } | { name: string }[] | null } | { plan: unknown }[] | null
      plan_direct: { name: string } | { name: string }[] | null
    } | null
    const grp = enrRow ? (Array.isArray(enrRow.group) ? enrRow.group[0] : enrRow.group) : null
    const gplan = grp ? (Array.isArray((grp as { plan: unknown }).plan) ? (grp as { plan: { name: string }[] }).plan[0] : (grp as { plan: { name: string } | null }).plan) : null
    const dplan = enrRow ? (Array.isArray(enrRow.plan_direct) ? enrRow.plan_direct[0] : enrRow.plan_direct) : null
    const studyName = (gplan as { name: string } | null)?.name ?? (dplan as { name: string } | null)?.name ?? null

    const concept = (r.concept as PaymentConcept | null) ?? null
    const description = concept === 'evento' ? (eventTitle ?? 'Evento')
      : concept === 'folletos' ? (studyName ? `Folleto — ${studyName}` : 'Folleto')
      : concept === 'matricula' ? (studyName ?? 'Matrícula')
      : 'Pago'

    const ref = (r.reference_code as string | null)?.trim() ?? null
    return {
      id: r.id as string,
      member_id: r.member_id as string,
      member_name: mm ? `${mm.first_name} ${mm.last_name}`.trim() : '—',
      concept,
      description,
      amount: Number(r.amount ?? 0),
      currency: (r.currency as string) ?? 'CRC',
      reference_code: ref,
      receipt_path: (r.receipt_path as string | null) ?? null,
      created_at: r.created_at as string,
      reviewed_at: (r.reviewed_at as string | null) ?? null,
      queue_status: computeQueueStatus(r.status as string, r.review_status as string | null),
      duplicate_reference: !!ref && dupSet.has(ref),
    }
  })
}

/** Aprueba vía RPC TRANSACCIONAL (migración 113): pago → paid + matrícula
 *  pendiente_de_pago → enrolled en una sola transacción. Antes eran dos
 *  updates sueltos: si el segundo fallaba quedaba dinero cobrado con la
 *  matrícula sin activar y solo un console.warn. Devuelve false si el pago
 *  ya no estaba en revisión (otro revisor lo procesó). */
export async function approvePayment(id: string, reviewerMemberId: string | null): Promise<boolean> {
  if (!reviewerMemberId) throw new Error('approvePayment requiere el member_id del revisor')
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('approve_payment', {
    p_payment_id: id,
    p_reviewer: reviewerMemberId,
  })
  if (error) throw error
  return Boolean(data)
}

/** Rechaza: review_status=rechazado + motivo. Devuelve datos del pago para avisar
 *  a la persona (correo + notificación). */
export async function rejectPayment(id: string, reviewerMemberId: string | null, reason: string): Promise<{ member_id: string; concept: PaymentConcept | null } | null> {
  const supabase = createAdminClient()
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
  const supabase = createAdminClient()
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
