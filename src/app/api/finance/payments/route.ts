import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireVistaFinanciera } from '@/lib/auth/guard'
import {
  getPayments, getPaymentsPage, getPaymentStats, createPayment, getEnrollmentForPayment,
  type PaymentFilters,
} from '@/lib/supabase/queries/finance'
import { reportarError } from '@/lib/observabilidad'

// Validación runtime del alta manual de pagos. El input va directo al insert
// de `payments` con service role: `.strict()` corta el mass assignment.
const paymentWriteSchema = z
  .object({
    member_id: z.string().trim().min(1).nullish(),
    entity_type: z.enum(['event', 'study_group']).nullish(),
    event_id: z.string().trim().min(1).nullish(),
    study_group_id: z.string().trim().min(1).nullish(),
    amount: z.number().min(0),
    payment_method: z.enum(['card', 'sinpe', 'scholarship', 'cash']).nullish(),
    // Obligatorio: un pago debe declarar su estado explícito, no caer en el
    // default de la columna (auditoría db §1).
    status: z.enum(['paid', 'pending', 'refunded', 'partial_refund', 'cancelado', 'failed']),
    gateway_ref: z.string().trim().nullish(),
    sinpe_confirmation: z.string().trim().nullish(),
    scholarship_id: z.string().trim().min(1).nullish(),
    paid_at: z.string().trim().min(1).nullish(),
    description: z.string().trim().nullish(),
    // 2026-08-04: finanzas puede colgar un pago de una MATRÍCULA existente —
    // el cobro que quedó sin registrar, o el que se creó mal. Entra a la cola
    // de revisión como cualquier otro y NO altera el estado de la matrícula
    // (que es efectiva desde que se hizo).
    enrollment_id: z.string().uuid().nullish(),
    concept: z.enum(['matricula', 'evento', 'folletos', 'prematrimonial', 'otro']).nullish(),
    // INT-3: opcional. Sin ella, se hereda del evento o del plan del grupo
    // (currencyForPayment); no se asume colones a ciegas.
    currency: z.enum(['CRC', 'USD', 'EUR']).nullish(),
  })
  .strict()
  .refine(v => !v.enrollment_id || v.concept === 'matricula', {
    message: 'Un pago ligado a una matrícula tiene que llevar concept "matricula".',
    path: ['concept'],
  })

/**
 * FIN-9 · Cuelga de cada pago el crédito que nació de él, si se congeló.
 * Es un mapa aparte y no un embed: `scholarships.origin_payment_id` apunta
 * al pago, no al revés, y la lista no debe cambiar de forma por esto.
 */
async function conCreditoDeOrigen<T extends { id: string }>(pagos: T[]): Promise<T[]> {
  const { creditosPorPagoDeOrigen } = await import('@/lib/supabase/queries/creditos')
  const creditos = await creditosPorPagoDeOrigen(pagos.map(p => p.id))
  if (creditos.size === 0) return pagos
  return pagos.map(p => ({ ...p, credito_origen: creditos.get(p.id) ?? null }))
}

/** Los filtros de la lista, tal como los manda la pantalla (`filtrosActuales`). */
function filtrosDeLaConsulta(searchParams: URLSearchParams): PaymentFilters {
  const entity = searchParams.get('entity_type')
  const currency = searchParams.get('currency')
  return {
    search: searchParams.get('search') ?? undefined,
    entity_type: entity === 'event' || entity === 'study_group' ? entity : undefined,
    method: searchParams.get('method') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    currency: currency === 'CRC' || currency === 'USD' || currency === 'EUR' ? currency : undefined,
    // FIN-4: ?in_plan=1 → solo tractos de arreglos de pago.
    inPaymentPlan: searchParams.get('in_plan') === '1' || undefined,
    paidFrom: searchParams.get('paid_from') ?? undefined,
    paidTo: searchParams.get('paid_to') ?? undefined,
  }
}

export async function GET(req: NextRequest) {
  try {
    // REV-3: el listado de pagos es la página unificada — lo ven tanto el
    // módulo finanzas como los roles de revisión (revision_pagos, folletos,
    // coordinadores). Las escrituras siguen acotadas (POST abajo; acciones de
    // revisión en /api/payments/[id]/review con revision_pagos:edit).
    // REP-18: también un puesto de dirección (lo pide «Pagos por entidad»).
    const auth = await requireVistaFinanciera(['finanzas', 'revision_pagos'])
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl

    // PAG-7 · Lista y totales leen los MISMOS filtros, de una sola función:
    // así un filtro nuevo no puede quedar en uno y no en el otro. Y el rango
    // de fecha (PAG-6) entra acá también: la pantalla lo mandaba y la lista no
    // lo leía —solo el export—, así que el rango no filtraba la lista.
    const filtros = filtrosDeLaConsulta(searchParams)
    const hasFilter = Object.values(filtros).some(v => v !== undefined)

    // ?stats=1 → «Total cobrado» y «Pendientes» de lo filtrado (o global sin filtros).
    if (searchParams.get('stats') === '1') {
      return NextResponse.json(hasFilter ? await getPaymentStats(filtros) : await getPaymentStats())
    }

    const rawPage = searchParams.get('page')
    const rawPageSize = searchParams.get('pageSize')

    // Sin paginación ni filtros: array completo (back-compat: dashboard, etc.).
    if (rawPage === null && rawPageSize === null && !hasFilter) {
      return NextResponse.json(await conCreditoDeOrigen(await getPayments()))
    }

    const { rows, total } = await getPaymentsPage({
      ...filtros,
      page: Math.max(1, Math.trunc(Number(rawPage ?? 1) || 1)),
      pageSize: Math.min(200, Math.max(1, Math.trunc(Number(rawPageSize ?? 50) || 50))),
    })
    return NextResponse.json({ payments: await conCreditoDeOrigen(rows), total })
  } catch (error) {
    reportarError('GET /api/finance/payments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const parsed = paymentWriteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    // La matrícula tiene que existir: un enrollment_id inventado dejaría el
    // pago colgando de nada y no aparecería en la ficha de nadie.
    if (parsed.data.enrollment_id) {
      const enr = await getEnrollmentForPayment(parsed.data.enrollment_id)
      if (!enr) {
        return NextResponse.json({ error: 'La matrícula no existe.' }, { status: 404 })
      }
      // El pago es de quien tiene la matrícula: si vienen distintos, manda la
      // matrícula (evita cobrarle a la persona equivocada por un typo).
      if (parsed.data.member_id && parsed.data.member_id !== enr.member_id) {
        return NextResponse.json(
          { error: 'El pago es de otra persona que la de la matrícula.' },
          { status: 409 },
        )
      }
      parsed.data.member_id = enr.member_id
      if (enr.group_id) {
        parsed.data.study_group_id = parsed.data.study_group_id ?? enr.group_id
        parsed.data.entity_type = parsed.data.entity_type ?? 'study_group'
      }
    }
    const payment = await createPayment(parsed.data)
    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    reportarError('POST /api/finance/payments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
