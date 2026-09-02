import 'server-only'
import { fechasDelSucesor } from '@/lib/studies/successor-dates'
import { ymdCR } from '@/lib/format'
import { createAdminClient } from '@/lib/supabase/admin'
import { nextLevelCode } from '@/lib/studies/folletos'
import {
  ESTADOS_ACTIVOS, ESTADOS_A_CONSULTAR, repartirParaMatricula,
} from '@/lib/studies/auto-enroll-dedup'
import { filterByNotifPref } from '@/lib/notifications/dispatch'
import { isBlockingStudyPayment } from '@/lib/studies/pending-payments'

export const PAYMENT_RECEIPTS_BUCKET = 'payment-receipts'


export type PaymentConcept = 'matricula' | 'folletos' | 'evento' | 'prematrimonial'
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
  /** INT-2: moneda del cobro (default CRC; folletos y flujos CR no la pasan). */
  currency?: string
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .insert({
      member_id: input.member_id,
      amount: input.amount,
      currency: input.currency ?? 'CRC',
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
    /** Fin del grupo que se cierra: el sucesor arranca ahí (ver successor-dates). */
    ends_at?: string | null
  },
  nextPlanId: string,
  sourceCode: string,
  nextCode: string,
  /** Duración del plan del sucesor, para calcularle su propia fecha de fin. */
  nextDurationWeeks: number | null,
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
      /**
       * FECHAS (2026-08-31). Antes el sucesor nacía SIN ninguna: cuatro grupos
       * quedaron así —dos DIS2 y dos N3, 29 personas— y sin fecha de fin el
       * recordatorio de cierre no les llega nunca, porque se calcula sobre ella.
       *
       * La cohorte sigue de una: arranca donde terminó el anterior, sin hueco.
       * La regla y sus casos de borde están en successor-dates.ts.
       */
      ...fechasDelSucesor({ finDelAnterior: src.ends_at, semanas: nextDurationWeeks, hoy: ymdCR() }),
      /**
       * 'en_curso', NO 'en_matricula' (decisión 2026-08-27).
       *
       * La cohorte que aprobó avanza JUNTA y ya está adentro: el grupo arranca
       * corriendo, no abriendo matrícula. Dejarlo 'en_matricula' era engañoso en
       * dos frentes: aparecía como grupo con cupo disponible en las pantallas de
       * matrícula, y quedaba esperando una ventana de matrícula que nunca se
       * define — que es justo por lo que las reglas de folletos de FOL-1 no se
       * disparaban nunca para estos grupos.
       */
      status: 'en_curso',
      current_week: 0,
      // GRU-2 · A PROPÓSITO no se copia enrollment_restrictions: la cohorte que
      // avanza no arrastra la restricción de audiencia del grupo anterior. Si
      // el sucesor debe restringirse, se pone a mano.
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
  // EST-1: el sucesor hereda dirigente — si estaba inactivo, se activa (las
  // cadenas N/DIS nunca son campaña). Best-effort: no revienta el cierre
  // (p. ej. dirigente marcado "no recomendado": queda para gestión manual).
  try {
    const { setDirigenteActive } = await import('@/lib/supabase/queries/studies')
    for (const lid of [src.leader_id, src.co_leader_id]) {
      if (lid) await setDirigenteActive(lid, true)
    }
  } catch (e) {
    console.warn('successor leader activation:', e)
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
): Promise<{ enrolled: number; next_level: string | null; amount: number; next_group_id: string | null }> {
  // next_group_id: lo necesita el cierre para pedir los folletos DEL GRUPO
  // SUCESOR, que es quien los va a usar.
  if (approvedMemberIds.length === 0) return { enrolled: 0, next_level: null, amount: 0, next_group_id: null }
  const supabase = createAdminClient()

  // Grupo origen completo (para heredar dirigente/horario/zona) + nivel siguiente.
  const { data: g } = await supabase
    .from('study_groups')
    .select('id, name, leader_id, co_leader_id, zone, schedule_days, schedule_time, location, sede, max_students, age_min, age_max, ends_at, plan:study_plans(code)')
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
  if (!src || !next) return { enrolled: 0, next_level: null, amount: 0, next_group_id: null }

  const { data: nextPlan } = await supabase.from('study_plans').select('id, cost, currency, duration_weeks').eq('code', next).maybeSingle()
  const np = nextPlan as { id: string; cost: number | null; currency: string | null; duration_weeks: number | null } | null
  if (!np) return { enrolled: 0, next_level: next, amount: 0, next_group_id: null }
  const amount = Number(np.cost ?? 0)
  // INT-2: el pago hereda la moneda del costo del plan.
  const currency = np.currency ?? 'CRC'

  // Grupo sucesor (best-effort: si falla, la matrícula queda solo a nivel de plan).
  const successorGroupId = await findOrCreateSuccessorGroup(supabase, src, np.id, sourceCode!, next, np.duration_weeks)

  // Dedup: quién ya tiene inscripción a ese nivel — por plan_id directo O por
  // grupo cuyo plan es el siguiente (A12: las matrículas por grupo tienen
  // plan_id NULL y el dedup anterior no las veía → 3 duplicados en prod).
  //
  // Se traen los estados y no solo los member_ids, porque "ya está adentro" y
  // "ya lo aprobó" NO son lo mismo: el primero sería un duplicado, el segundo
  // es alguien repitiendo el nivel y tiene que entrar como cualquiera. La regla
  // vive en auto-enroll-dedup, con tests.
  const [byPlan, byGroup] = await Promise.all([
    supabase
      .from('study_enrollments')
      .select('member_id, status')
      .eq('plan_id', np.id)
      .in('member_id', approvedMemberIds)
      .in('status', ESTADOS_A_CONSULTAR as unknown as string[]),
    supabase
      .from('study_enrollments')
      .select('member_id, status, group:study_groups!study_enrollments_group_id_fkey!inner(plan_id)')
      .eq('group.plan_id', np.id)
      .in('member_id', approvedMemberIds)
      .in('status', ESTADOS_A_CONSULTAR as unknown as string[]),
  ])
  const filasPrevias = [
    ...((byPlan.data ?? []) as Array<{ member_id: string; status: string | null }>),
    ...((byGroup.data ?? []) as Array<{ member_id: string; status: string | null }>),
  ]
  const activos = new Set(
    filasPrevias.filter(r => (ESTADOS_ACTIVOS as readonly string[]).includes(r.status ?? ''))
      .map(r => r.member_id))
  const yaAprobados = new Set(
    filasPrevias.filter(r => r.status === 'completed').map(r => r.member_id))
  const { matricular, saltados } = repartirParaMatricula(approvedMemberIds, activos, yaAprobados)
  if (saltados.length > 0) {
    console.info(`auto-enroll: ${saltados.length} ya estaban matriculados en ${next}, no se duplican`)
  }

  // La matrícula queda ACTIVA siempre (regla 2026-08-04: el pago es un carril
  // aparte). Si el nivel tiene costo se crea además el pago pendiente, que
  // finanzas revisa por su cuenta sin tocar la matrícula.
  const free = amount <= 0
  const now = new Date().toISOString()
  let enrolled = 0
  for (const { memberId, nota } of matricular) {
    // El dirigente del grupo sucesor (heredado del origen) no paga su matrícula;
    // el resto (alumnos, aunque dirijan otros grupos) sí.
    const memberFree = free || memberId === src.leader_id || memberId === src.co_leader_id
    const { data: enr, error: enrErr } = await supabase
      .from('study_enrollments')
      .insert({
        member_id: memberId,
        plan_id: np.id,
        group_id: successorGroupId,
        status: 'enrolled',
        enrolled_at: now,
        // Quien repite lleva la razón escrita: sin eso, la inscripción de
        // alguien que ya tenía el nivel aprobado se lee como un error.
        ...(nota ? { notes: nota } : {}),
      })
      .select('id').single()
    if (enrErr) { console.warn('auto-enroll insert:', enrErr.message); continue }
    if (!memberFree) {
      const enrollmentId = (enr as { id: string }).id
      // Pago pendiente asociado (sin comprobante aún; el alumno lo completa).
      // QA 2026-07-17: si el pago no se pudo crear, revertir ESA inscripción y
      // seguir con el resto del lote (best-effort) — el retry de reconciliación
      // (YA_CERRADO) la repara. Sin esto quedaba una matrícula pendiente_de_pago
      // invisible para finanzas.
      const { data: pay, error: payErr } = await supabase.from('payments').insert({
        member_id: memberId,
        amount,
        currency,
        payment_method: 'comprobante',
        concept: 'matricula',
        enrollment_id: enrollmentId,
        status: 'pending',
      }).select('id').single()
      if (payErr) {
        console.warn('auto-enroll pago falló, revirtiendo inscripción:', payErr.message)
        await supabase.from('study_enrollments').delete().eq('id', enrollmentId)
        continue
      }
      // PAG-1: si el miembro silenció 'mensajes_sistema', no se le notifica
      // (el cobro sigue visible en /mis-pagos igual).
      const allowed = await filterByNotifPref(supabase as unknown as Parameters<typeof filterByNotifPref>[0], [memberId], 'mensajes_sistema')
      if (allowed.length === 0) continue
      // Notifica al miembro del cobro pendiente (clic → el pago en /mis-pagos).
      const payId = (pay as { id: string }).id
      const { error: notifErr } = await supabase.from('internal_notifications').insert({
        recipient_member_id: memberId,
        type: 'payment_pending',
        title: 'Tenés un cobro pendiente',
        body: `Se generó un cobro de matrícula de ₡${amount.toLocaleString('es-CR')}. Abrí el detalle para pagarlo (subir comprobante).`,
        link: `/mis-pagos?pago=${payId}`,
      })
      if (notifErr) console.warn('auto-enroll: notificación de cobro falló:', notifErr.message)
    }
    enrolled++
  }
  return { enrolled, next_level: next, amount, next_group_id: successorGroupId ?? null }
}

/** Sube el comprobante de una matrícula: si ya existe un pago pendiente para esa
 *  inscripción (ej. el auto-creado al cerrar), lo ACTUALIZA (adjunta comprobante +
 *  pasa a en_revision); si no, lo crea. Evita pagos duplicados por matrícula.
 *  El monto se toma del costo del plan (no del cliente). */
export async function submitEnrollmentComprobante(input: {
  enrollment_id: string
  receipt_path: string
  reference_code: string | null
  // `group_id` y `member_id` salen en la respuesta porque el caller manda el
  // correo de bienvenida ACÁ y no al matricularse (ver la ruta de enrollments).
}): Promise<{ id: string; member_id: string; group_id: string | null } | null> {
  const supabase = createAdminClient()
  const { data: enr } = await supabase
    .from('study_enrollments')
    .select('member_id, group_id, group:study_groups!study_enrollments_group_id_fkey(plan:study_plans(cost, currency)), plan_direct:study_plans!study_enrollments_plan_id_fkey(cost, currency)')
    .eq('id', input.enrollment_id)
    .maybeSingle()
  if (!enr) return null
  const row = enr as {
    member_id: string
    group_id: string | null
    group: { plan: { cost: number | null; currency: string | null } | { cost: number | null; currency: string | null }[] | null } | { plan: unknown }[] | null
    plan_direct: { cost: number | null; currency: string | null } | { cost: number | null; currency: string | null }[] | null
  }
  const grp = Array.isArray(row.group) ? row.group[0] : row.group
  const gplan = grp ? (Array.isArray(grp.plan) ? grp.plan[0] : grp.plan) : null
  const dplan = Array.isArray(row.plan_direct) ? row.plan_direct[0] : row.plan_direct
  const gp = gplan as { cost: number | null; currency: string | null } | null
  const amount = Number(gp?.cost ?? dplan?.cost ?? 0)
  // INT-2: el pago hereda la moneda del costo del plan (grupo primero, igual que el monto).
  const currency = (gp?.cost != null ? gp.currency : dplan?.currency) ?? 'CRC'

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
    // REGLA 2026-08-27: el comprobante se acepta al subirlo. Se deja pasar por
    // review_status=en_revision un instante porque approve_payment exige ese
    // estado de entrada — así se reusa el MISMO camino que usa finanzas, con la
    // activación de matrícula/inscripción incluida, en vez de duplicar updates
    // que después se separarían. Si falla, el pago queda en la cola como antes:
    // es mejor que quede por revisar a que se pierda.
    try { await autoAcceptComprobante(eid) } catch (e) { console.warn('autoAcceptComprobante:', e) }
    return { id: eid, member_id: row.member_id, group_id: row.group_id }
  }

  let insertResult
  try {
    insertResult = await supabase.from('payments').insert({
    member_id: row.member_id,
    amount,
    currency,
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
  // REGLA 2026-08-27: el comprobante se acepta al subirlo. Se deja pasar por
  // review_status=en_revision un instante porque approve_payment exige ese
  // estado de entrada — así se reusa el MISMO camino que usa finanzas, con la
  // activación de matrícula/inscripción incluida, en vez de duplicar updates
  // que después se separarían. Si falla, el pago queda en la cola como antes:
  // es mejor que quede por revisar a que se pierda.
  try { await autoAcceptComprobante((data as { id: string }).id) } catch (e) { console.warn('autoAcceptComprobante:', e) }
  return { id: (data as { id: string }).id, member_id: row.member_id, group_id: row.group_id }
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
    .select('event_id, member_id, event:events(currency)')
    .eq('id', input.event_registration_id)
    .maybeSingle()
  if (!reg) return null
  const { event_id, member_id } = reg as { event_id: string; member_id: string }
  // INT-2: el pago hereda la moneda del costo del evento.
  const regEvent = (reg as { event: { currency: string | null } | { currency: string | null }[] | null }).event
  const currency = (Array.isArray(regEvent) ? regEvent[0] : regEvent)?.currency ?? 'CRC'

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
    // REGLA 2026-08-27: el comprobante se acepta al subirlo. Se deja pasar por
    // review_status=en_revision un instante porque approve_payment exige ese
    // estado de entrada — así se reusa el MISMO camino que usa finanzas, con la
    // activación de matrícula/inscripción incluida, en vez de duplicar updates
    // que después se separarían. Si falla, el pago queda en la cola como antes:
    // es mejor que quede por revisar a que se pierda.
    try { await autoAcceptComprobante(eid) } catch (e) { console.warn('autoAcceptComprobante:', e) }
    return { id: eid }
  }

  const { data, error } = await supabase.from('payments').insert({
    member_id,
    amount,
    currency,
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
  // REGLA 2026-08-27: el comprobante se acepta al subirlo. Se deja pasar por
  // review_status=en_revision un instante porque approve_payment exige ese
  // estado de entrada — así se reusa el MISMO camino que usa finanzas, con la
  // activación de matrícula/inscripción incluida, en vez de duplicar updates
  // que después se separarían. Si falla, el pago queda en la cola como antes:
  // es mejor que quede por revisar a que se pierda.
  try { await autoAcceptComprobante((data as { id: string }).id) } catch (e) { console.warn('autoAcceptComprobante:', e) }
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
export type MemberPaymentRow = {
  id: string
  concept: PaymentConcept | null
  description: string
  amount: number
  currency: string
  status: string                 // crudo: paid | pending | failed | refunded | partial_refund
  queue_status: ReturnType<typeof computeQueueStatus>
  created_at: string
  reviewed_at: string | null
  enrollment_id: string | null
  event_registration_id: string | null
  /** FIN-4: si el pago es un TRACTO, su vencimiento y su número. */
  due_date: string | null
  installment_number: number | null
  payment_plan_id: string | null
}

/** Pagos/cobros de UN miembro (para la sección "Pagos y cobros" del perfil).
 *  Trae todos los conceptos con su descripción y estado, y los ids de entidad
 *  para poder pagar (subir comprobante) desde la lista. Orden: pendientes/en
 *  revisión primero (más nuevos arriba), luego los cerrados. */
/** PAG-2: pagos de estudios que bloquean una matrícula nueva (concepto
 *  'matricula' con status 'pending'). `excludePlanId` deja fuera los pagos
 *  ligados al plan que se está matriculando: el pago del propio flujo en curso
 *  no debe bloquearse a sí mismo (ese caso ya lo maneja el guard
 *  PAGO_PENDIENTE con su mensaje específico). */
/** El DETALLE de la deuda que bloquea, para poder explicarla en vez de solo
 *  contarla: cuánto debe, y de qué estudios. Los códigos importan porque el
 *  bloqueo NO aplica al plan de la propia deuda — quien debe N2 sigue pudiendo
 *  matricular N2 (subir su comprobante); lo que no puede es avanzar a N3.
 *
 *  Ojo con el pago SUELTO (sin enrollment_id): no tiene plan al cual atribuirse,
 *  así que no exime a ninguno y bloquea todo. Es correcto —no hay forma de saber
 *  a qué estudio corresponde— pero conviene saberlo al crear cobros a mano. */
/** PostgREST devuelve un embed to-one como objeto o como arreglo de uno. */
function uno(x: unknown): unknown {
  return Array.isArray(x) ? x[0] ?? null : x ?? null
}

export type BlockingStudyDebt = {
  count: number
  total: number
  currency: string
  /** Códigos de plan de la deuda; esos estudios NO quedan bloqueados. */
  planCodes: string[]
}

export async function getBlockingStudyDebt(memberId: string): Promise<BlockingStudyDebt> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .select(`
      concept, status, amount, currency,
      enrollment:study_enrollments!payments_enrollment_id_fkey(
        plan:study_plans!study_enrollments_plan_id_fkey(code),
        group:study_groups!study_enrollments_group_id_fkey(plan:study_plans(code))
      )
    `)
    .eq('member_id', memberId)
    .eq('concept', 'matricula')
    .eq('status', 'pending')
  if (error) throw error
  const codes = new Set<string>()
  let count = 0, total = 0, currency = 'CRC'
  for (const r of (data ?? []) as Array<{
    concept: string | null; status: string; amount: number | null; currency: string | null
    enrollment: unknown
  }>) {
    if (!isBlockingStudyPayment(r)) continue
    count++
    total += Number(r.amount ?? 0)
    if (r.currency) currency = r.currency
    // El plan sale del grupo si la matrícula tiene grupo; si no, del plan_id
    // directo de la matrícula. PostgREST devuelve el embed como objeto o como
    // arreglo de uno según el caso, de ahí el `uno()`.
    const enr = uno(r.enrollment) as {
      plan?: unknown
      group?: { plan?: unknown } | { plan?: unknown }[] | null
    } | null
    const grupo = uno(enr?.group) as { plan?: unknown } | null
    const plan = (uno(grupo?.plan) ?? uno(enr?.plan)) as { code?: string | null } | null
    if (plan?.code) codes.add(plan.code)
  }
  return { count, total, currency, planCodes: [...codes] }
}

export async function countBlockingStudyPayments(memberId: string, excludePlanId?: string | null): Promise<number> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .select(`
      concept, status,
      enrollment:study_enrollments!payments_enrollment_id_fkey(
        plan_id, group:study_groups!study_enrollments_group_id_fkey(plan_id)
      )
    `)
    .eq('member_id', memberId)
    .eq('concept', 'matricula')
    .eq('status', 'pending')
  if (error) throw error
  let count = 0
  for (const r of (data ?? []) as Array<{
    concept: string | null; status: string
    enrollment: { plan_id: string | null; group: { plan_id: string | null } | { plan_id: string | null }[] | null } | { plan_id: string | null; group: unknown }[] | null
  }>) {
    if (!isBlockingStudyPayment(r)) continue
    if (excludePlanId) {
      const enr = Array.isArray(r.enrollment) ? r.enrollment[0] : r.enrollment
      const grp = enr ? (Array.isArray(enr.group) ? (enr.group as Array<{ plan_id: string | null }>)[0] : enr.group as { plan_id: string | null } | null) : null
      const planId = grp?.plan_id ?? enr?.plan_id ?? null
      if (planId === excludePlanId) continue
    }
    count++
  }
  return count
}

export async function getPaymentsByMember(memberId: string): Promise<MemberPaymentRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id, amount, currency, concept, receipt_path, created_at, status, review_status, reviewed_at,
      enrollment_id, event_registration_id, due_date, installment_number, payment_plan_id,
      event_registration:event_registrations!payments_event_registration_id_fkey(event:events(title)),
      enrollment:study_enrollments!payments_enrollment_id_fkey(
        group:study_groups!study_enrollments_group_id_fkey(plan:study_plans(name)),
        plan_direct:study_plans!study_enrollments_plan_id_fkey(name)
      )
    `)
    .eq('member_id', memberId)
    .not('concept', 'is', null)
    .order('created_at', { ascending: false })
  if (error) throw error

  return ((data ?? []) as Array<Record<string, unknown>>).map(r => {
    const er = Array.isArray(r.event_registration) ? r.event_registration[0] : r.event_registration
    const erRow = er as { event: { title: string } | { title: string }[] | null } | null
    const ev = erRow ? (Array.isArray(erRow.event) ? erRow.event[0] : erRow.event) : null
    const eventTitle = (ev as { title: string } | null)?.title ?? null
    const enr = Array.isArray(r.enrollment) ? r.enrollment[0] : r.enrollment
    const enrRow = enr as { group: { plan: unknown }[] | { plan: unknown } | null; plan_direct: unknown } | null
    const grp = enrRow ? (Array.isArray(enrRow.group) ? enrRow.group[0] : enrRow.group) : null
    const gplan = grp ? (Array.isArray((grp as { plan: unknown }).plan) ? (grp as { plan: { name: string }[] }).plan[0] : (grp as { plan: { name: string } | null }).plan) : null
    const dplan = enrRow ? (Array.isArray(enrRow.plan_direct) ? enrRow.plan_direct[0] : enrRow.plan_direct) : null
    const studyName = (gplan as { name: string } | null)?.name ?? (dplan as { name: string } | null)?.name ?? null
    const concept = (r.concept as PaymentConcept | null) ?? null
    const description = concept === 'evento' ? (eventTitle ?? 'Evento')
      : concept === 'folletos' ? (studyName ? `Folleto — ${studyName}` : 'Folleto')
      : concept === 'matricula' ? (studyName ?? 'Matrícula')
      : concept === 'prematrimonial' ? 'Curso Prematrimonial'
      : 'Pago'
    return {
      id: r.id as string,
      concept,
      description,
      amount: Number(r.amount ?? 0),
      currency: (r.currency as string) ?? 'CRC',
      status: (r.status as string) ?? 'pending',
      queue_status: computeQueueStatus(r.status as string, r.review_status as string | null),
      created_at: r.created_at as string,
      reviewed_at: (r.reviewed_at as string | null) ?? null,
      enrollment_id: (r.enrollment_id as string | null) ?? null,
      event_registration_id: (r.event_registration_id as string | null) ?? null,
      due_date: (r.due_date as string | null) ?? null,
      installment_number: (r.installment_number as number | null) ?? null,
      payment_plan_id: (r.payment_plan_id as string | null) ?? null,
    }
  })
}

export async function getPendingPaymentsQueue(filters: {
  status?: PaymentQueueStatus
  concept?: PaymentConcept
  /** REV-1: filtros por plan del grupo y dirigente del grupo. Solo tienen
   *  sentido para concepto matrícula (fuerzan concept='matricula'). */
  planId?: string
  leaderId?: string
} = {}): Promise<PaymentQueueRow[]> {
  const supabase = createAdminClient()
  // Con filtro de plan/dirigente el embed pasa a !inner para que el filtro
  // sobre la tabla anidada excluya las filas padre que no matchean.
  const byGroup = !!(filters.planId || filters.leaderId)
  const enrollmentSel = byGroup
    ? `enrollment:study_enrollments!payments_enrollment_id_fkey!inner(
        group:study_groups!study_enrollments_group_id_fkey!inner(plan:study_plans(name)),
        plan_direct:study_plans!study_enrollments_plan_id_fkey(name)
      )`
    : `enrollment:study_enrollments!payments_enrollment_id_fkey(
        group:study_groups!study_enrollments_group_id_fkey(plan:study_plans(name)),
        plan_direct:study_plans!study_enrollments_plan_id_fkey(name)
      )`
  let q = supabase
    .from('payments')
    .select(`
      id, member_id, amount, currency, concept, reference_code, receipt_path, created_at,
      status, review_status, reviewed_at,
      member:members!payments_member_id_fkey(first_name, last_name),
      event_registration:event_registrations!payments_event_registration_id_fkey(event:events(title)),
      ${enrollmentSel}
    `)
    .not('concept', 'is', null)

  if (byGroup) {
    q = q.eq('concept', 'matricula')
    if (filters.planId) q = q.eq('enrollment.group.plan_id', filters.planId)
    if (filters.leaderId) q = q.eq('enrollment.group.leader_id', filters.leaderId)
  } else if (filters.concept) q = q.eq('concept', filters.concept)

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

/**
 * Acepta el comprobante EN EL MISMO MOMENTO en que se sube (regla del
 * 2026-08-27: los pagos por comprobante se dan por buenos).
 *
 * Reusa el RPC approve_payment en vez de escribir los UPDATE a mano, para que la
 * activación de la matrícula / inscripción / prematrimonial pase EXACTAMENTE
 * igual que cuando aprueba finanzas. Duplicar esos updates acá era la forma
 * segura de que los dos caminos se separaran con el tiempo.
 *
 * `reviewed_by` queda NULL a propósito: nadie revisó nada. Poner a la propia
 * persona como su revisora sería mentirle a la auditoría.
 */
export async function autoAcceptComprobante(paymentId: string): Promise<boolean> {
  const supabase = createAdminClient()
  // Sin p_reviewer: la firma lo tiene con DEFAULT NULL justamente para esto.
  const { data, error } = await supabase.rpc('approve_payment', { p_payment_id: paymentId })
  if (error) throw error
  return Boolean(data)
}

/**
 * Deshace una aceptación: el caso especial del régimen nuevo. Devuelve el pago a
 * rechazado y REVIERTE la activación (la matrícula vuelve a pendiente de pago,
 * la inscripción al evento a pendiente).
 *
 * Va por RPC porque son varias tablas y tiene que ser atómico: dejar el pago
 * rechazado pero la matrícula activa es peor que no haber revertido.
 */
export async function revertPaymentApproval(
  id: string, reviewerMemberId: string | null, reason: string,
): Promise<boolean> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('revert_payment_approval', {
    p_payment_id: id, p_reviewer: reviewerMemberId ?? undefined, p_reason: reason,
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

/** Transiciones MANUALES de un tiquete de la cola de finanzas, para seguimiento
 *  (Fase 3b). Complementan el flujo de comprobante (approve/reject):
 *   - 'start_review' → pendiente ➜ en revisión: finanzas empieza a gestionar el
 *     cobro (p. ej. un cobro en sitio pendiente que se va a conciliar). Habilita
 *     luego aprobar/rechazar.
 *   - 'reopen'       → en revisión ➜ pendiente: deshace lo anterior, SIN avisar
 *     a la persona (a diferencia de rechazar, que pide motivo y notifica).
 *   - 'close'        → cierra el tiquete SIN pago (status 'failed') con motivo.
 *     NO activa matrícula/inscripción (no toca approve_payment) — sirve para
 *     tiquetes que no se van a cobrar. Cae en el bucket 'cerrado'.
 *  Devuelve false si la fila ya no estaba en el estado esperado (otro revisor la
 *  movió) → la ruta responde 409. */
export async function transitionPaymentQueue(
  id: string,
  action: 'start_review' | 'reopen' | 'close',
  reviewerMemberId: string | null,
  reason?: string,
): Promise<boolean> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  if (action === 'start_review') {
    const { data, error } = await supabase
      .from('payments')
      .update({ review_status: 'en_revision' })
      .eq('id', id).eq('status', 'pending')
      .or('review_status.is.null,review_status.eq.rechazado')
      .select('id').maybeSingle()
    if (error) throw error
    return !!data
  }

  if (action === 'reopen') {
    const { data, error } = await supabase
      .from('payments')
      .update({ review_status: null, rejection_reason: null })
      .eq('id', id).eq('status', 'pending').eq('review_status', 'en_revision')
      .select('id').maybeSingle()
    if (error) throw error
    return !!data
  }

  // close: solo desde 'pending' (cualquier review_status). Cierra sin cobrar.
  const { data, error } = await supabase
    .from('payments')
    .update({ status: 'failed', rejection_reason: reason ?? null, reviewed_by: reviewerMemberId, reviewed_at: now })
    .eq('id', id).eq('status', 'pending')
    .select('id').maybeSingle()
  if (error) throw error
  return !!data
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
