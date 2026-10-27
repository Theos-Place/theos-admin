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
  tocaCorrerElCredito, TIPO_CREDITO_CORRIDO, TITULO_CREDITO_CORRIDO, cuerpoDelCorrimiento, avisoDeCorrimiento,
} from '@/lib/finance/credito-por-congelar'
import { formatDate } from '@/lib/format'
import { plata } from '@/lib/finance/saldo-a-favor'
import type { FilaDeReclasificacion } from '@/lib/finance/reporte-de-reclasificaciones'
import { avisoAFinanzas, TIPO_AVISO_FINANZAS, diaEnCostaRica, type CreditoResumen } from '@/lib/finance/credito-visible'

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

  // FIN-9 · Y la campana a FINANZAS. Hasta el 2026-10-27 solo se avisaba a
  // la persona: finanzas se enteró de tres congelamientos de SCJ por correo
  // de estudios, con el crédito ya emitido y sin verlo en ninguna pantalla.
  try {
    await avisarAFinanzasDelCredito({
      member_name: ctx.member_name, monto: ctx.montoPagado, currency: ctx.currency,
      estudio: ctx.estudio, motivo: input.motivo.trim(), actorUserId: input.actorUserId,
    })
  } catch (e) {
    console.warn('congelarMatricula: aviso a finanzas falló:', e instanceof Error ? e.message : e)
  }

  return { credito_id: creditoId, monto: ctx.montoPagado, vence }
}

/** Campana a todo miembro activo con rol finanzas o admin. Best-effort. */
async function avisarAFinanzasDelCredito(i: {
  member_name: string; monto: number; currency: string; estudio: string | null; motivo: string
  actorUserId: string
}): Promise<void> {
  const supabase = createAdminClient()
  const [destinatarios, { data: actor }] = await Promise.all([
    destinatariosDeFinanzas(),
    supabase.from('members').select('first_name, last_name').eq('auth_user_id', i.actorUserId).maybeSingle(),
  ])
  if (destinatarios.length === 0) return
  const a = actor as { first_name: string | null; last_name: string | null } | null
  const quien = [a?.first_name, a?.last_name].filter(Boolean).join(' ').trim() || null
  const aviso = avisoAFinanzas({ ...i, quien })
  await campanaAFinanzas(destinatarios, TIPO_AVISO_FINANZAS, aviso)
}

/** Miembros activos con rol finanzas o admin. */
async function destinatariosDeFinanzas(): Promise<string[]> {
  const supabase = createAdminClient()
  const { data: roles } = await supabase.from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(is_active)')
    .in('role', ['admin', 'finanzas']).eq('is_active', true)
  return [...new Set(((roles ?? []) as Array<{ member_id: string; member: { is_active: boolean } | { is_active: boolean }[] | null }>)
    .filter(r => (Array.isArray(r.member) ? r.member[0] : r.member)?.is_active === true)
    .map(r => r.member_id))]
}

async function campanaAFinanzas(destinatarios: string[], type: string, aviso: { title: string; body: string }): Promise<void> {
  if (destinatarios.length === 0) return
  const { error } = await createAdminClient().from('internal_notifications').insert(destinatarios.map(memberId => ({
    recipient_member_id: memberId, type,
    title: aviso.title, body: aviso.body, link: '/finanzas/saldos#creditos',
  })))
  if (error) throw error
}

/* ────────────────────────────────────────────────────────────────────────────
 * Si no lo usó, se corre (FIN-9c, 2026-10-27)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Barrido diario (va dentro de `payment-holds-expire`, que ya mira pagos de
 * estudio): todo crédito ACTIVO cuyo vencimiento ya pasó se corre al cierre
 * de matrícula del bloque siguiente. La regla está en
 * `credito-por-congelar.ts` (3b); acá solo se lee, se escribe y se avisa.
 *
 * Avisa a la persona (su primera campana decía «hasta el X», y X cambió) y a
 * finanzas. Deja rastro en `audit_log` sin actor, como los otros crons.
 */
export async function correrCreditosSinUsar(
  hoy: string = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date()),
  opts: { dryRun?: boolean } = {},
): Promise<{ corridos: number; detalle: Array<{ credito_id: string; persona: string; vencia: string; vence: string }> }> {
  const supabase = createAdminClient()
  const dia = hoy.slice(0, 10)
  const [{ data: filas, error }, { data: bloque }] = await Promise.all([
    supabase.from('scholarships')
      .select(`${SELECT_RESUMEN}, member:members!scholarships_member_id_fkey(first_name, last_name)`)
      .eq('kind', 'credito').eq('status', 'active')
      .lt('expires_at', `${dia}T00:00:00-06:00`),
    supabase.from('capacitacion_bloques')
      .select('fecha_cierre_matricula')
      .gt('fecha_cierre_matricula', dia)
      .order('fecha_cierre_matricula', { ascending: true })
      .limit(1).maybeSingle(),
  ])
  if (error) throw error
  const vence = vencimientoDelCredito({
    fechaDeCierreDelBloqueSiguiente: (bloque as { fecha_cierre_matricula: string } | null)?.fecha_cierre_matricula,
    hoy: dia,
  })

  type Fila = FilaDeCredito & { member: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null }
  const detalle: Array<{ credito_id: string; persona: string; vencia: string; vence: string }> = []
  const destinatarios = opts.dryRun ? [] : await destinatariosDeFinanzas()

  for (const f of (filas ?? []) as Fila[]) {
    const c = aResumen(f)
    // El filtro de la consulta ya lo garantiza; la regla pura es la que manda.
    if (!tocaCorrerElCredito(c, dia) || !c.vence) continue
    const m = Array.isArray(f.member) ? f.member[0] : f.member
    const persona = [m?.first_name, m?.last_name].filter(Boolean).join(' ').trim() || f.member_id
    detalle.push({ credito_id: c.id, persona, vencia: c.vence, vence })
    if (opts.dryRun) continue

    const { error: uErr } = await supabase.from('scholarships')
      .update({ expires_at: `${vence}T23:59:59.999-06:00` })
      .eq('id', c.id).eq('status', 'active')
    if (uErr) throw uErr

    await supabase.from('audit_log').insert({
      action: 'UPDATE', entity_type: 'scholarships', entity_id: c.id,
      old_data: { expires_at: f.expires_at },
      new_data: { op: 'credito_corrido_al_bloque_siguiente', expires_at: `${vence}T23:59:59.999-06:00`, persona },
    }).then(({ error: e }) => { if (e) console.warn('audit crédito corrido:', e.message) })

    const monto = plata(c.monto, c.currency)
    const { error: nErr } = await supabase.from('internal_notifications').insert({
      recipient_member_id: f.member_id, type: TIPO_CREDITO_CORRIDO, title: TITULO_CREDITO_CORRIDO,
      body: cuerpoDelCorrimiento({ monto, vence: formatDate(vence) }), link: '/mis-pagos',
    })
    if (nErr) console.warn('correrCreditosSinUsar: aviso a la persona falló:', nErr.message)
    try {
      await campanaAFinanzas(destinatarios, TIPO_AVISO_FINANZAS, avisoDeCorrimiento({
        member_name: persona, monto, venciaEl: formatDate(c.vence), venceAhora: formatDate(vence),
      }))
    } catch (e) {
      console.warn('correrCreditosSinUsar: aviso a finanzas falló:', e instanceof Error ? e.message : e)
    }
  }
  return { corridos: opts.dryRun ? 0 : detalle.length, detalle }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Dónde se VE el crédito (FIN-9, 2026-10-27)
 * ──────────────────────────────────────────────────────────────────────────── */

const SELECT_RESUMEN = 'id, member_id, status, discount_value, currency, expires_at, freeze_reason, reason, origin_payment_id'

type FilaDeCredito = {
  id: string; member_id: string; status: string; discount_value: number | string; currency: string | null
  expires_at: string | null; freeze_reason: string | null; reason: string | null; origin_payment_id: string | null
}

/** El estudio sale de `reason` («Congelamiento de matrícula · Sirviendo como
 *  Jesús»): el crédito no guarda plan porque no está atado a un destino. */
function aResumen(f: FilaDeCredito): CreditoResumen {
  const sep = (f.reason ?? '').indexOf(' · ')
  return {
    id: f.id, status: f.status, monto: Number(f.discount_value) || 0, currency: f.currency ?? 'CRC',
    vence: diaEnCostaRica(f.expires_at),
    motivo: f.freeze_reason, origen: sep >= 0 ? (f.reason ?? '').slice(sep + 3).trim() || null : null,
    origin_payment_id: f.origin_payment_id,
  }
}

/**
 * Los créditos que nacieron de estos pagos, por id de pago. Es lo que deja
 * decir «Congelado → crédito a favor» encima de un pago que sigue en `paid`.
 */
export async function creditosPorPagoDeOrigen(paymentIds: readonly string[]): Promise<Map<string, CreditoResumen>> {
  const out = new Map<string, CreditoResumen>()
  if (paymentIds.length === 0) return out
  const supabase = createAdminClient()
  for (let i = 0; i < paymentIds.length; i += 200) {
    const { data, error } = await supabase.from('scholarships').select(SELECT_RESUMEN)
      .eq('kind', 'credito').in('origin_payment_id', paymentIds.slice(i, i + 200))
    if (error) throw error
    for (const f of (data ?? []) as FilaDeCredito[]) if (f.origin_payment_id) out.set(f.origin_payment_id, aResumen(f))
  }
  return out
}

export type CreditoListado = CreditoResumen & {
  member_id: string
  member_name: string
  created_at: string
  /** De qué pago salió, en una línea («Matrícula · Sirviendo como Jesús»). */
  pago_descripcion: string | null
}

/** Todos los créditos por congelamiento, para la pantalla de finanzas. */
export async function listarCreditos(): Promise<CreditoListado[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('scholarships')
    .select(`${SELECT_RESUMEN}, created_at,
      member:members!scholarships_member_id_fkey(first_name, last_name)`)
    .eq('kind', 'credito').order('created_at', { ascending: false })
  if (error) throw error
  type Fila = FilaDeCredito & { created_at: string; member: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null }
  const filas = (data ?? []) as Fila[]
  const pagoIds = filas.map(f => f.origin_payment_id).filter((x): x is string => !!x)
  const descripciones = new Map<string, string | null>()
  if (pagoIds.length > 0) {
    const { data: pagos } = await supabase.from('payments').select('id, description').in('id', pagoIds)
    for (const p of (pagos ?? []) as Array<{ id: string; description: string | null }>) descripciones.set(p.id, p.description)
  }
  return filas.map(f => {
    const m = Array.isArray(f.member) ? f.member[0] : f.member
    return {
      ...aResumen(f), member_id: f.member_id,
      member_name: [m?.first_name, m?.last_name].filter(Boolean).join(' ').trim() || '—',
      created_at: f.created_at,
      pago_descripcion: f.origin_payment_id ? descripciones.get(f.origin_payment_id) ?? null : null,
    }
  })
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

  const dia = diaEnCostaRica
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
