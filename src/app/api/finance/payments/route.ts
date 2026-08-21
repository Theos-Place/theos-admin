import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import {
  getPayments, getPaymentsPage, getPaymentStats, createPayment, getEnrollmentForPayment,
} from '@/lib/supabase/queries/finance'

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
    status: z.enum(['paid', 'pending', 'refunded', 'partial_refund', 'failed']),
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

export async function GET(req: NextRequest) {
  try {
    // REV-3: el listado de pagos es la página unificada — lo ven tanto el
    // módulo finanzas como los roles de revisión (revision_pagos, folletos,
    // coordinadores). Las escrituras siguen acotadas (POST abajo; acciones de
    // revisión en /api/payments/[id]/review con revision_pagos:edit).
    const auth = await requireModuleView(['finanzas', 'revision_pagos'])
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl

    // ?stats=1 → totales globales (los 4 montos del header).
    if (searchParams.get('stats') === '1') {
      return NextResponse.json(await getPaymentStats())
    }

    const rawPage = searchParams.get('page')
    const rawPageSize = searchParams.get('pageSize')
    const search = searchParams.get('search') ?? undefined
    const entity = searchParams.get('entity_type')
    const method = searchParams.get('method')
    const status = searchParams.get('status')
    const currency = searchParams.get('currency')
    // FIN-4: ?in_plan=1 → solo tractos de arreglos de pago.
    const inPlan = searchParams.get('in_plan') === '1'
    const hasFilter = !!(search || entity || method || status || currency || inPlan)

    // Sin paginación ni filtros: array completo (back-compat: dashboard, etc.).
    if (rawPage === null && rawPageSize === null && !hasFilter) {
      return NextResponse.json(await getPayments())
    }

    const { rows, total } = await getPaymentsPage({
      search,
      entity_type: entity === 'event' || entity === 'study_group' ? entity : undefined,
      method: method ?? undefined,
      status: status ?? undefined,
      currency: currency === 'CRC' || currency === 'USD' || currency === 'EUR' ? currency : undefined,
      inPaymentPlan: inPlan || undefined,
      page: Math.max(1, Math.trunc(Number(rawPage ?? 1) || 1)),
      pageSize: Math.min(200, Math.max(1, Math.trunc(Number(rawPageSize ?? 50) || 50))),
    })
    return NextResponse.json({ payments: rows, total })
  } catch (error) {
    console.error('GET /api/finance/payments:', error)
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
    console.error('POST /api/finance/payments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
