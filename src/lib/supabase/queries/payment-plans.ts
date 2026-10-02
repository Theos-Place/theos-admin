// FIN-4 · Arreglos de pago en tractos (uso interno de finanzas).
//
// Un arreglo parte un pago PENDIENTE en N tractos. Los tractos son filas
// normales de payments con payment_plan_id, así que pasan por la cola de
// revisión de siempre y los agregados no cambian.
//
// Reglas acordadas con finanzas (2026-08-21):
//  · El PRIMER tracto aprobado libera el objeto pagado (approve_payment queda
//    igual). El resto es deuda.
//  · Un tracto VENCIDO impago bloquea matricularse y inscribirse a eventos pagos.
//  · Cancelar el arreglo solo marca el plan: los tractos impagos siguen
//    pendientes (siguen bloqueando y recordándose). Cancelar ≠ condonar; para
//    condonar está "Cerrar sin cobrar" de cada pago.

import { createAdminClient } from '@/lib/supabase/admin'
import {
  planInstallments, MIN_INSTALLMENTS, MAX_INSTALLMENTS, type PlanFrequency,
} from '@/lib/finance/installments'
import {
  motivoParaRechazarArreglo, limiteDeEstudio, type ContextoDelArreglo,
} from '@/lib/finance/limites-de-arreglo'

export type PaymentPlan = {
  id: string
  member_id: string
  enrollment_id: string | null
  event_registration_id: string | null
  total_amount: number
  currency: string
  installments: number
  status: 'activo' | 'completado' | 'cancelado'
  frequency: PlanFrequency
  notes: string | null
  created_at: string
}

export type PaymentPlanInstallment = {
  id: string
  installment_number: number | null
  amount: number
  currency: string
  due_date: string | null
  status: string
  review_status: string | null
}

/**
 * FIN-13 · De qué es este pago y hasta cuándo puede estirarse su arreglo.
 *
 * El tipo sale del VÍNCULO del pago (matrícula o inscripción) y no de
 * `entity_type`, que es un texto que puede venir vacío en lo histórico: el
 * vínculo es el que la tabla obliga con un CHECK, así que no miente.
 */
async function contextoDelArreglo(
  supabase: ReturnType<typeof createAdminClient>,
  p: { enrollment_id: string | null; study_group_id: string | null; event_id: string | null },
): Promise<ContextoDelArreglo> {
  if (p.enrollment_id) {
    // El grupo puede venir por el pago o por la matrícula; se prueba el del
    // pago primero porque evita una consulta.
    let groupId = p.study_group_id
    if (!groupId) {
      const { data } = await supabase
        .from('study_enrollments').select('group_id').eq('id', p.enrollment_id).maybeSingle()
      groupId = (data as { group_id: string | null } | null)?.group_id ?? null
    }
    if (!groupId) return { tipo: 'estudio', limite: null, origenDelLimite: null }
    const { data: g } = await supabase
      .from('study_groups').select('enrollment_end_date, starts_at').eq('id', groupId).maybeSingle()
    const { limite, origenDelLimite } = limiteDeEstudio(
      (g as { enrollment_end_date: string | null; starts_at: string | null } | null) ?? {},
    )
    return { tipo: 'estudio', limite, origenDelLimite }
  }

  if (!p.event_id) return { tipo: 'evento', limite: null, origenDelLimite: null }
  const { data: e } = await supabase
    .from('events').select('starts_at').eq('id', p.event_id).maybeSingle()
  const starts = (e as { starts_at: string | null } | null)?.starts_at ?? null
  return {
    tipo: 'evento',
    // `events.starts_at` es timestamptz: el día que importa es el de Costa
    // Rica, no el de UTC. Un evento de las 6 p.m. del viernes es sábado en
    // UTC, y con eso el arreglo ganaría un día que no tiene.
    limite: starts ? diaCR(starts) : null,
    origenDelLimite: 'inicio_actividad',
  }
}

/** `YYYY-MM-DD` en día de Costa Rica. */
function diaCR(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(d)
}

/**
 * Convierte un pago pendiente en un arreglo de tractos.
 *
 * El pago original se REUSA como tracto 1 (conserva su enrollment/inscripción,
 * su beca aplicada y su historial); los tractos 2..N se insertan copiando sus
 * vínculos. La suma de los tractos es exactamente el monto original.
 *
 * Errores: PAGO_NO_ENCONTRADO, PAGO_NO_PENDIENTE, PAGO_YA_EN_ARREGLO,
 * PAGO_SIN_OBJETO, TRACTOS_INVALIDOS, MONTO_INSUFICIENTE.
 */
export async function createPaymentPlan(
  paymentId: string,
  opts: {
    installments: number; firstDue: string; notes?: string | null
    /** FIN-8. Default 'mensual': los llamadores viejos no cambian. */
    frequency?: PlanFrequency
  },
  createdByMemberId: string | null,
): Promise<{ plan: PaymentPlan; installments: PaymentPlanInstallment[] }> {
  const supabase = createAdminClient()

  if (!Number.isInteger(opts.installments)
    || opts.installments < MIN_INSTALLMENTS || opts.installments > MAX_INSTALLMENTS) {
    throw new Error('TRACTOS_INVALIDOS')
  }

  const { data: pay } = await supabase
    .from('payments')
    .select('id, member_id, amount, currency, status, concept, entity_type, study_group_id, event_id, enrollment_id, event_registration_id, description, category_id, payment_method, payment_plan_id')
    .eq('id', paymentId)
    .maybeSingle()
  if (!pay) throw new Error('PAGO_NO_ENCONTRADO')

  const p = pay as {
    id: string; member_id: string | null; amount: number; currency: string | null
    status: string; concept: string | null; entity_type: string | null
    study_group_id: string | null; event_id: string | null
    enrollment_id: string | null; event_registration_id: string | null
    description: string | null; category_id: string | null
    payment_method: string | null; payment_plan_id: string | null
  }

  if (p.payment_plan_id) throw new Error('PAGO_YA_EN_ARREGLO')
  if (p.status !== 'pending') throw new Error('PAGO_NO_PENDIENTE')
  if (!p.member_id) throw new Error('PAGO_SIN_OBJETO')
  // El arreglo se ancla al objeto pagado (matrícula o inscripción a evento).
  if (!p.enrollment_id && !p.event_registration_id) throw new Error('PAGO_SIN_OBJETO')

  const total = Number(p.amount)
  const currency = p.currency ?? 'CRC'
  const frequency: PlanFrequency = opts.frequency ?? 'mensual'
  const tractos = planInstallments({
    total, count: opts.installments, firstDue: opts.firstDue, currency, frequency,
  })
  // Con montos muy chicos no se puede repartir (ej. ₡2 en 3 tractos).
  if (tractos.length !== opts.installments) throw new Error('MONTO_INSUFICIENTE')

  /**
   * FIN-13 · Los límites se validan ACÁ y no solo en la pantalla.
   *
   * La pantalla ya no ofrece lo que no se puede, pero el endpoint es
   * alcanzable con un POST a mano y esto decide cuánta plata se cobra y
   * cuándo. Una regla de negocio que solo vive en el formulario no es una
   * regla: es una sugerencia.
   */
  const ctx = await contextoDelArreglo(supabase, p)
  const rechazo = motivoParaRechazarArreglo(
    { installments: opts.installments, frequency, vencimientos: tractos.map(t => t.due_date) },
    ctx,
  )
  if (rechazo) throw new Error(rechazo.code)

  const { data: planRow, error: planErr } = await supabase
    .from('payment_plans')
    .insert({
      member_id: p.member_id,
      // Exactamente uno de los dos, por el CHECK de la tabla.
      enrollment_id: p.enrollment_id ?? null,
      event_registration_id: p.enrollment_id ? null : p.event_registration_id,
      total_amount: total,
      currency,
      installments: opts.installments,
      frequency,
      notes: opts.notes?.trim() || null,
      created_by: createdByMemberId,
    })
    .select('*')
    .single()
  if (planErr) throw planErr
  const plan = planRow as PaymentPlan

  const label = (n: number) => `Tracto ${n} de ${opts.installments}`
  const baseDesc = (p.description ?? '').trim()

  // Tracto 1 = el pago original (conserva beca, comprobante y vínculos).
  const first = tractos[0]
  const { error: updErr } = await supabase
    .from('payments')
    .update({
      payment_plan_id: plan.id,
      installment_number: first.number,
      amount: first.amount,
      due_date: first.due_date,
      description: baseDesc ? `${label(1)} — ${baseDesc}` : label(1),
    })
    .eq('id', p.id)
    .eq('status', 'pending')
    .is('payment_plan_id', null)
  if (updErr) {
    // Sin el tracto 1 el arreglo no cuadra: se deshace el plan.
    await supabase.from('payment_plans').delete().eq('id', plan.id)
    throw updErr
  }

  // Tractos 2..N.
  const rest = tractos.slice(1).map(t => ({
    member_id: p.member_id,
    amount: t.amount,
    currency,
    payment_method: p.payment_method ?? 'comprobante',
    status: 'pending',
    concept: p.concept,
    entity_type: p.entity_type,
    study_group_id: p.study_group_id,
    event_id: p.event_id,
    enrollment_id: p.enrollment_id,
    event_registration_id: p.event_registration_id,
    category_id: p.category_id,
    payment_plan_id: plan.id,
    installment_number: t.number,
    due_date: t.due_date,
    description: baseDesc ? `${label(t.number)} — ${baseDesc}` : label(t.number),
  }))

  if (rest.length > 0) {
    const { error: insErr } = await supabase.from('payments').insert(rest)
    if (insErr) {
      // Deshacer: el tracto 1 vuelve a ser el pago original y el plan se borra.
      await supabase.from('payments').update({
        payment_plan_id: null, installment_number: null,
        amount: total, due_date: null, description: p.description,
      }).eq('id', p.id)
      await supabase.from('payments').delete().eq('payment_plan_id', plan.id)
      await supabase.from('payment_plans').delete().eq('id', plan.id)
      throw insErr
    }
  }

  return { plan, installments: await getPlanInstallments(plan.id) }
}

/** Tractos de un arreglo, en orden. */
export async function getPlanInstallments(planId: string): Promise<PaymentPlanInstallment[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .select('id, installment_number, amount, currency, due_date, status, review_status')
    .eq('payment_plan_id', planId)
    .order('installment_number', { ascending: true })
  if (error) throw error
  return (data ?? []) as PaymentPlanInstallment[]
}

/** El arreglo al que pertenece un pago (null si el pago no es un tracto). */
export async function getPlanForPayment(paymentId: string): Promise<PaymentPlan | null> {
  const supabase = createAdminClient()
  const { data: pay } = await supabase
    .from('payments').select('payment_plan_id').eq('id', paymentId).maybeSingle()
  const planId = (pay as { payment_plan_id?: string | null } | null)?.payment_plan_id
  if (!planId) return null
  const { data, error } = await supabase
    .from('payment_plans').select('*').eq('id', planId).maybeSingle()
  if (error) throw error
  return (data as PaymentPlan) ?? null
}

/**
 * Cancela el arreglo. Solo marca el PLAN: los tractos impagos quedan como
 * están (decisión 2026-08-21), así que siguen bloqueando y siguen entrando a
 * los recordatorios. Cancelar el arreglo NO perdona la deuda.
 */
export async function cancelPaymentPlan(planId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payment_plans')
    .update({ status: 'cancelado' })
    .eq('id', planId)
    .eq('status', 'activo')
    .select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

/** Marca el arreglo como completado si ya no le quedan tractos pendientes. */
export async function settlePlanIfPaid(planId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data: pend } = await supabase
    .from('payments').select('id').eq('payment_plan_id', planId).eq('status', 'pending').limit(1)
  if ((pend ?? []).length > 0) return false
  const { data, error } = await supabase
    .from('payment_plans').update({ status: 'completado' })
    .eq('id', planId).eq('status', 'activo').select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

export type OverdueInstallment = {
  payment_id: string
  installment_number: number | null
  amount: number
  currency: string
  due_date: string
}

/**
 * Tractos VENCIDOS e impagos de un miembro. Es lo que bloquea matricularse en
 * otro estudio o inscribirse a otro evento pago (FIN-4 punto 3). Un tracto
 * futuro al día no aparece acá.
 *
 * `todayYmd` se inyecta (hora CR) para que el corte no dependa del reloj UTC
 * del proceso.
 */
export async function getOverdueInstallments(
  memberId: string, todayYmd: string,
): Promise<OverdueInstallment[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .select('id, installment_number, amount, currency, due_date')
    .eq('member_id', memberId)
    .eq('status', 'pending')
    .not('payment_plan_id', 'is', null)
    .not('due_date', 'is', null)
    .lt('due_date', todayYmd)
    .order('due_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => {
    const x = r as { id: string; installment_number: number | null; amount: number; currency: string | null; due_date: string }
    return {
      payment_id: x.id,
      installment_number: x.installment_number,
      amount: Number(x.amount),
      currency: x.currency ?? 'CRC',
      due_date: x.due_date,
    }
  })
}

/** Roles que reciben el aviso interno de tractos vencidos. */
export const OVERDUE_NOTIFY_ROLES = ['finanzas', 'direccion', 'admin'] as const

const OVERDUE_NOTIF_TYPE = 'installment_overdue'

/**
 * Aviso INTERNO a finanzas de los tractos vencidos (FIN-4 punto 4). Lo dispara
 * el cron de recordatorios: el bloqueo por sí solo es pasivo (actúa cuando la
 * persona intenta matricularse), así que sin este aviso nadie se enteraba.
 *
 * Es un aviso de TRABAJO, no un mensaje al miembro sobre lo suyo, así que no
 * pasa por la preferencia 'mensajes_sistema' (esa silencia lo propio, no la
 * cola de trabajo). Dedupea por día en hora CR, igual que los recordatorios.
 */
export async function notifyFinanceOverdueInstallments(
  todayYmd: string,
): Promise<{ overdue: number; members: number; notified: number; skipped_dup: number }> {
  const supabase = createAdminClient()

  const { data: vencidos, error } = await supabase
    .from('payments')
    .select('id, member_id, amount, currency, due_date')
    .eq('status', 'pending')
    .not('payment_plan_id', 'is', null)
    .not('due_date', 'is', null)
    .lt('due_date', todayYmd)
  if (error) throw error

  const items = ((vencidos ?? []) as Array<{ member_id: string | null; amount: number; currency: string | null }>)
    .filter(r => !!r.member_id)
    .map(r => ({ member_id: r.member_id as string, amount: Number(r.amount), currency: r.currency ?? 'CRC' }))

  if (items.length === 0) return { overdue: 0, members: 0, notified: 0, skipped_dup: 0 }

  const { financeOverdueSummary } = await import('@/lib/finance/installments')
  const resumen = financeOverdueSummary(items)

  // Destinatarios: rol activo EN miembro activo (mismo criterio que los avisos
  // de estudios, para no notificar a alguien dado de baja).
  const { data: roleRows } = await supabase
    .from('member_roles')
    .select('member_id, role, is_active, member:members!member_roles_member_id_fkey(is_active)')
    .in('role', OVERDUE_NOTIFY_ROLES as unknown as string[])
    .eq('is_active', true)
  const recipients = [...new Set(
    ((roleRows ?? []) as Array<{ member_id: string; member: { is_active: boolean } | null }>)
      .filter(r => r.member?.is_active === true)
      .map(r => r.member_id),
  )]
  if (recipients.length === 0) return { overdue: items.length, members: resumen.members, notified: 0, skipped_dup: 0 }

  // Dedupe diario (hora CR: UTC-6 fijo, sin DST).
  const { data: yaHoy } = await supabase
    .from('internal_notifications')
    .select('recipient_member_id')
    .eq('type', OVERDUE_NOTIF_TYPE)
    .gte('created_at', `${todayYmd}T00:00:00-06:00`)
    .in('recipient_member_id', recipients)
  const notificados = new Set(
    ((yaHoy ?? []) as Array<{ recipient_member_id: string }>).map(r => r.recipient_member_id),
  )

  let notified = 0
  let skipped_dup = 0
  for (const memberId of recipients) {
    if (notificados.has(memberId)) { skipped_dup++; continue }
    const { error: insErr } = await supabase.from('internal_notifications').insert({
      recipient_member_id: memberId,
      type: OVERDUE_NOTIF_TYPE,
      title: resumen.installments === 1 ? 'Hay 1 tracto vencido' : `Hay ${resumen.installments} tractos vencidos`,
      body: `${resumen.members} persona${resumen.members === 1 ? '' : 's'} con tractos vencidos por ${resumen.totals}. `
        + 'Mientras estén vencidos no pueden matricularse ni inscribirse a eventos pagos.',
      link: '/finanzas/pagos?tab=todos',
    })
    if (insErr) { console.warn('aviso de tracto vencido:', insErr.message); continue }
    notified++
  }
  return { overdue: items.length, members: resumen.members, notified, skipped_dup }
}

/**
 * FIN-13 · Habilita (o quita) el arreglo de pago sobre un cobro.
 *
 * Las dos guardas importan y son distintas:
 *
 * · PAGO_NO_PENDIENTE — habilitar un arreglo sobre algo ya pagado le pondría
 *   a la persona un botón que al tocarlo falla. Peor que no tenerlo.
 * · PAGO_YA_EN_ARREGLO — ya es un tracto de otro arreglo; partirlo otra vez
 *   no es lo que nadie quiso.
 *
 * QUITAR la habilitación NO deshace un arreglo ya creado: para eso está
 * cancelar el plan. Esto solo cierra la puerta hacia adelante.
 */
export async function setPaymentPlanEnabled(
  paymentId: string,
  habilitado: boolean,
  porMemberId: string | null,
): Promise<void> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('payments')
    .select('id, status, payment_plan_id')
    .eq('id', paymentId)
    .maybeSingle()
  if (!data) throw new Error('PAGO_NO_ENCONTRADO')
  const p = data as { status: string; payment_plan_id: string | null }
  if (p.payment_plan_id) throw new Error('PAGO_YA_EN_ARREGLO')
  if (p.status !== 'pending') throw new Error('PAGO_NO_PENDIENTE')

  const { error } = await supabase
    .from('payments')
    .update(habilitado
      ? { payment_plan_enabled_at: new Date().toISOString(), payment_plan_enabled_by: porMemberId }
      // Al quitar se borran las DOS: dejar el «quién» sin el «cuándo» haría
      // creer que sigue habilitado por esa persona.
      : { payment_plan_enabled_at: null, payment_plan_enabled_by: null })
    .eq('id', paymentId)
  if (error) throw error
}

/**
 * FIN-13 · ¿Puede ESTA persona armar el arreglo de ESTE cobro?
 *
 * Solo si se cumplen las tres cosas: el cobro es suyo, finanzas se lo
 * habilitó, y sigue pendiente.
 *
 * NO alcanza con ser familiar. En Mis pagos uno puede PAGAR por un familiar
 * —eso se decidió en PAG-1— pero comprometerse a un arreglo de pago a nombre
 * de otra persona es otra cosa: es una deuda que queda en su ficha y que la
 * bloquea para matricularse si se atrasa. Esa la asume cada quien.
 */
export async function puedeAcogerseAlArreglo(
  paymentId: string,
  memberId: string | null,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!memberId) {
    return { ok: false, error: 'Tu usuario no tiene una ficha asociada.', status: 403 }
  }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('payments')
    .select('member_id, status, payment_plan_id, payment_plan_enabled_at')
    .eq('id', paymentId)
    .maybeSingle()
  if (!data) return { ok: false, error: 'No se encontró el pago.', status: 404 }
  const p = data as {
    member_id: string | null; status: string
    payment_plan_id: string | null; payment_plan_enabled_at: string | null
  }

  // 404 y no 403 cuando el cobro es de otra persona: un 403 confirmaría que
  // ese pago existe, y el id va en la URL.
  if (p.member_id !== memberId) {
    return { ok: false, error: 'No se encontró el pago.', status: 404 }
  }
  if (!p.payment_plan_enabled_at) {
    return {
      ok: false,
      error: 'Este cobro no tiene habilitado el arreglo de pago. Escribí a finanzas para '
        + 'conversarlo.',
      status: 403,
    }
  }
  if (p.payment_plan_id) {
    return { ok: false, error: 'Este cobro ya es parte de un arreglo de pago.', status: 409 }
  }
  if (p.status !== 'pending') {
    return { ok: false, error: 'Este cobro ya no está pendiente.', status: 409 }
  }
  return { ok: true }
}
