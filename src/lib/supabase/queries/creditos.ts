/**
 * FIN-9 · Congelar una matrícula y emitir el crédito.
 *
 * Las REGLAS viven en `@/lib/finance/credito-por-congelar`, con tests. Acá
 * está lo que toca la base.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import {
  montoDelCredito, motivoQueImpideCongelar, vencimientoDelCredito,
  TIPO_CREDITO_EMITIDO, TITULO_CREDITO_EMITIDO, cuerpoDelCredito,
} from '@/lib/finance/credito-por-congelar'
import type { FilaDeReclasificacion } from '@/lib/finance/reporte-de-reclasificaciones'

export class NoSePuedeCongelar extends Error {}

/** Lo que hace falta para decidir, leído de la base. */
export type ContextoDeCongelamiento = {
  member_id: string
  member_name: string
  estudio: string | null
  estado: string
  montoPagado: number
  currency: string
  /** El cobro del que sale el crédito: el pago MÁS GRANDE que se pagó. */
  origin_payment_id: string | null
  motivoQueImpide: string | null
}

/**
 * ¿Se puede congelar esta matrícula, y por cuánto?
 *
 * Se consulta ANTES de mostrar el formulario: finanzas tiene que ver el
 * monto antes de confirmar, porque el crédito es por lo PAGADO y casi nunca
 * coincide con lo cobrado.
 */
export async function contextoParaCongelar(enrollmentId: string): Promise<ContextoDeCongelamiento | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('study_enrollments')
    .select(`
      id, member_id, status,
      member:members!study_enrollments_member_id_fkey(first_name, last_name),
      group:study_groups!study_enrollments_group_id_fkey(name, plan:study_plans(name))
    `)
    .eq('id', enrollmentId).maybeSingle()
  if (!data) return null
  const e = data as {
    member_id: string; status: string
    member: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null
    group: { name: string | null; plan: { name: string } | { name: string }[] | null } | null
  }
  const m = Array.isArray(e.member) ? e.member[0] : e.member
  const g = Array.isArray(e.group) ? e.group[0] : e.group
  const planEmbed = g?.plan
  const estudio = (Array.isArray(planEmbed) ? planEmbed[0] : planEmbed)?.name ?? g?.name ?? null

  const { data: pagos } = await supabase
    .from('payments').select('id, amount, status, currency').eq('enrollment_id', enrollmentId)
  const lista = (pagos ?? []) as Array<{ id: string; amount: number; status: string; currency: string | null }>
  const montoPagado = montoDelCredito(lista)
  // El pago de ORIGEN es el pagado más grande: es el que la contabilidad va
  // a reclasificar. Con varios tractos se toma el mayor y el reporte igual
  // llega al cobro por el enrollment.
  const pagados = lista.filter(p => p.status === 'paid').sort((a, z) => Number(z.amount) - Number(a.amount))

  return {
    member_id: e.member_id,
    member_name: [m?.first_name, m?.last_name].filter(Boolean).join(' ').trim() || '—',
    estudio,
    estado: e.status,
    montoPagado,
    currency: pagados[0]?.currency ?? 'CRC',
    origin_payment_id: pagados[0]?.id ?? null,
    motivoQueImpide: motivoQueImpideCongelar({ estadoDeLaMatricula: e.status, montoPagado }),
  }
}

/**
 * Congela: saca a la persona del grupo y le emite el crédito.
 *
 * ORDEN DELIBERADO — primero el CRÉDITO y después la baja. Si se cae en el
 * medio, el peor caso es una persona con crédito que sigue en el grupo
 * (visible, se arregla en un clic) en vez de una persona dada de baja y sin
 * su plata (invisible hasta que reclame).
 */
export async function congelarMatricula(input: {
  enrollmentId: string
  motivo: string
  /**
   * Quién lo hace, como `auth.users.id` y NO como member_id.
   *
   * `approved_by` y `created_by` de `scholarships` apuntan a `auth.users`,
   * no a `members` — se leyó de la FK, después de que un member_id las
   * hiciera reventar con un 23503 en la prueba de staging.
   */
  actorUserId: string
}): Promise<{ credito_id: string; monto: number; vence: string }> {
  const supabase = createAdminClient()
  const ctx = await contextoParaCongelar(input.enrollmentId)
  if (!ctx) throw new NoSePuedeCongelar('No se encontró la matrícula.')
  if (ctx.motivoQueImpide) throw new NoSePuedeCongelar(ctx.motivoQueImpide)
  if (!ctx.origin_payment_id) throw new NoSePuedeCongelar('No hay un pago del cual salga el crédito.')

  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date())
  // El bloque SIGUIENTE: el primero cuyo cierre de matrícula todavía no pasó.
  const { data: bloque } = await supabase
    .from('capacitacion_bloques')
    .select('fecha_cierre_matricula')
    .gt('fecha_cierre_matricula', hoy)
    .order('fecha_cierre_matricula', { ascending: true })
    .limit(1).maybeSingle()
  const vence = vencimientoDelCredito({
    fechaDeCierreDelBloqueSiguiente: (bloque as { fecha_cierre_matricula: string } | null)?.fecha_cierre_matricula,
    hoy,
  })

  const { data: creado, error } = await supabase.from('scholarships').insert({
    kind: 'credito',
    member_id: ctx.member_id,
    discount_type: 'fixed',
    discount_value: ctx.montoPagado,
    currency: ctx.currency,
    status: 'active',
    origin_payment_id: ctx.origin_payment_id,
    freeze_reason: input.motivo.trim(),
    expires_at: `${vence}T23:59:59.999-06:00`,
    created_by: input.actorUserId,
    approved_by: input.actorUserId,
    approved_at: new Date().toISOString(),
    reason: `Congelamiento de matrícula${ctx.estudio ? ` · ${ctx.estudio}` : ''}`,
  }).select('id').single()
  if (error) throw error
  const creditoId = (creado as { id: string }).id

  // Ahora sí, la baja. `withdrawMember` cancela el cobro pendiente que quede.
  const { withdrawMember } = await import('./studies')
  const { data: enr } = await supabase
    .from('study_enrollments').select('group_id').eq('id', input.enrollmentId).maybeSingle()
  const groupId = (enr as { group_id: string | null } | null)?.group_id
  if (groupId) {
    await withdrawMember(
      groupId, ctx.member_id,
      `Matrícula congelada: ${input.motivo.trim()}`,
      'retirar',
    )
  }

  const fmt = new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: ctx.currency, maximumFractionDigits: 0,
  }).format(ctx.montoPagado)
  const { error: nErr } = await supabase.from('internal_notifications').insert({
    recipient_member_id: ctx.member_id,
    type: TIPO_CREDITO_EMITIDO,
    title: TITULO_CREDITO_EMITIDO,
    body: cuerpoDelCredito({ monto: fmt, estudio: ctx.estudio, vence }),
    link: '/mis-pagos',
  })
  if (nErr) console.warn('congelarMatricula: notificación falló:', nErr.message)

  return { credito_id: creditoId, monto: ctx.montoPagado, vence }
}

/**
 * FIN-9 · Las reclasificaciones de un período.
 *
 * Una fila por crédito, con el viaje completo: de qué pago salió, en qué
 * rubro entró la plata, y dónde terminó. Los créditos SIN USAR salen igual
 * —con el destino vacío— porque son plata que Theos tiene y debe.
 */
export async function reclasificacionesDelPeriodo(input: {
  anio: number
  mes?: number | null
}): Promise<FilaDeReclasificacion[]> {
  const supabase = createAdminClient()
  const { rangoDelPeriodo } = await import('@/lib/finance/reporte-de-reclasificaciones')
  const { desde, hasta } = rangoDelPeriodo(input)

  const { data, error } = await supabase
    .from('scholarships')
    .select(`
      id, discount_value, currency, status, created_at, used_at, expires_at,
      freeze_reason, reason, origin_payment_id,
      member:members!scholarships_member_id_fkey(first_name, last_name),
      origen:payments!scholarships_origin_payment_id_fkey(description, concept)
    `)
    .eq('kind', 'credito')
    .gte('created_at', desde)
    .lte('created_at', hasta)
    .order('created_at', { ascending: true })
  if (error) throw error

  // Dónde se usó cada uno: el pago que lo lleva aplicado.
  const ids = ((data ?? []) as Array<{ id: string }>).map(r => r.id)
  const destinoDe = new Map<string, string>()
  if (ids.length > 0) {
    const { data: usos } = await supabase
      .from('payments').select('scholarship_id, description, concept').in('scholarship_id', ids)
    for (const u of (usos ?? []) as Array<{ scholarship_id: string; description: string | null; concept: string | null }>) {
      destinoDe.set(u.scholarship_id, u.description ?? u.concept ?? 'Pago')
    }
  }

  const dia = (iso: string | null): string | null =>
    iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date(iso)) : null
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x)

  return ((data ?? []) as Array<Record<string, unknown>>).map(r => {
    const m = uno(r.member as { first_name: string | null; last_name: string | null } | null)
    const o = uno(r.origen as { description: string | null; concept: string | null } | null)
    return {
      persona: [m?.first_name, m?.last_name].filter(Boolean).join(' ').trim() || '—',
      emitido: dia(r.created_at as string) ?? '—',
      monto: Number(r.discount_value ?? 0),
      currency: (r.currency as string) ?? 'CRC',
      pago_origen: (r.origin_payment_id as string | null) ?? null,
      rubro_origen: o?.description ?? o?.concept ?? (r.reason as string | null) ?? '—',
      motivo: (r.freeze_reason as string | null) ?? '',
      usado: dia(r.used_at as string | null),
      rubro_destino: destinoDe.get(r.id as string) ?? null,
      estado: (r.status as string) ?? 'active',
      vence: dia(r.expires_at as string | null),
    }
  })
}
