import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { resolveOnBehalf, FINANCE_ON_BEHALF_ROLES } from '@/lib/auth/on-behalf'
import {
  getFinanceRequests, countOpenFinanceRequests, createFinanceRequest, notifyFinanceRolesOfRequest,
} from '@/lib/supabase/queries/finance-requests'
import type { FinanceRequestStatus, FinanceRequestType } from '@/types/finance'
import {
  esRazonDeBeca, montoPedido, MINIMO_DEL_DETALLE,
} from '@/lib/finance/solicitud-de-beca'
import { reportarError } from '@/lib/observabilidad'

const TYPES = new Set(['scholarship', 'refund'])
const STATUSES = new Set(['open', 'in_review', 'por_modificar', 'resolved', 'rejected'])

// GET: el propio perfil se consulta sin permiso extra (?member_id=propio, p.ej.
// "Mis becas"); cualquier otra consulta exige módulo finanzas o becas (según
// pantalla: /finanzas/solicitudes ve todo, /finanzas/becas solo scholarship).
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles() // solo exige sesión
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl
    const memberIdParam = searchParams.get('member_id')
    const isOwnProfile = !!memberIdParam && memberIdParam === auth.ctx.memberId
    if (!isOwnProfile) {
      const finanzas = await requireModuleView('finanzas')
      if (finanzas.res) {
        const becas = await requireModuleView('becas')
        if (becas.res) return becas.res
      }
    }
    if (searchParams.get('count') === 'open') {
      return NextResponse.json({ count: await countOpenFinanceRequests() })
    }
    const status = searchParams.get('status') ?? undefined
    const type = searchParams.get('type') ?? undefined
    return NextResponse.json(await getFinanceRequests({
      status: status && STATUSES.has(status) ? (status as FinanceRequestStatus) : undefined,
      type: type && TYPES.has(type) ? (type as FinanceRequestType) : undefined,
      member_id: searchParams.get('member_id') ?? undefined,
    }))
  } catch (error) {
    reportarError('GET /api/finance/requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: crea una solicitud. Cualquier autenticado, pero solo finanzas/dirección
// (y admin) pueden crearla a nombre de OTRO miembro; el resto queda forzado a
// su propio perfil (anti-suplantación, auditoría S2).
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const body = await req.json()
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    // FRM-4: quién la digitó, si no fue la propia persona.
    const { memberId, recordedBy, denegado } = resolveOnBehalf(auth.ctx, body?.member_id, FINANCE_ON_BEHALF_ROLES)
    if (denegado) {
      return NextResponse.json(
        { error: 'No tenés permiso para registrar a otra persona.', code: 'sin_permiso_por_otro' },
        { status: 403 },
      )
    }

    if (typeof body?.member_id === 'string' && body.member_id && body.member_id !== memberId) {
      return NextResponse.json(
        { error: 'No podés crear solicitudes a nombre de otro miembro' },
        { status: 403 },
      )
    }
    if (!memberId || !TYPES.has(body?.request_type)) {
      return NextResponse.json({ error: 'Se requiere member_id y request_type válido' }, { status: 400 })
    }
    if (reason.length < MINIMO_DEL_DETALLE) {
      return NextResponse.json(
        { error: `La razón debe tener al menos ${MINIMO_DEL_DETALLE} caracteres` }, { status: 400 })
    }
    if (body.request_type === 'refund' && !body.payment_id) {
      return NextResponse.json({ error: 'Se requiere el pago a devolver' }, { status: 400 })
    }
    if (body.request_type === 'scholarship') {
      const entityType = body.entity_type
      if (entityType !== 'study_plan' && entityType !== 'event') {
        return NextResponse.json({ error: 'Se requiere indicar si es para un estudio o un evento' }, { status: 400 })
      }
      /**
       * BEC-5 punto 3 · Para un estudio se pide el GRUPO, no el tipo.
       *
       * Antes bastaba `plan_id` —«quiero beca para Nivel 1»— y el cupo se
       * conversaba aparte. Una de las 10 solicitudes reales dice «la había
       * solicitado para Romanos pero ya está lleno»: sin grupo, nadie puede
       * avisarle cuando eso pasa. Con el grupo, el punto 5 es posible.
       *
       * `plan_id` se sigue pidiendo además del grupo: es lo que mira la
       * pantalla de revisión y lo que usan las becas ya resueltas.
       */
      if (entityType === 'study_plan' && !body.plan_id) {
        return NextResponse.json({ error: 'Se requiere el estudio' }, { status: 400 })
      }
      if (entityType === 'study_plan' && !body.study_group_id) {
        return NextResponse.json(
          { error: 'Elegí el grupo específico (día, zona y dirigente).', code: 'falta_grupo' },
          { status: 400 },
        )
      }
      if (entityType === 'event' && !body.event_id) {
        return NextResponse.json({ error: 'Se requiere el evento' }, { status: 400 })
      }
      // BEC-5 punto 1 · La razón es una de tres. Se valida acá y no solo en
      // el formulario: el endpoint se alcanza con un POST a mano, y una
      // categoría inventada rompería el conteo que motivó el cambio.
      if (!esRazonDeBeca(body.reason_category)) {
        return NextResponse.json(
          { error: 'Elegí por cuál razón pedís la beca.', code: 'falta_razon' },
          { status: 400 },
        )
      }
    }

    const request = await createFinanceRequest({
      recorded_by: recordedBy,
      member_id: memberId,
      request_type: body.request_type,
      study_group_id: body.study_group_id ?? null,
      payment_id: body.payment_id ?? null,
      // BEC-5 punto 2 · El monto es opcional; cero o negativo no es un monto.
      amount: montoPedido(body.amount),
      reason,
      entity_type: body.request_type === 'scholarship' ? body.entity_type : null,
      reason_category: body.request_type === 'scholarship' ? body.reason_category : null,
      plan_id: body.plan_id ?? null,
      event_id: body.event_id ?? null,
    })

    try { await notifyFinanceRolesOfRequest(request) } catch (e) {
      console.warn('POST /api/finance/requests: notificaciones fallaron:', e)
    }

    return NextResponse.json(request, { status: 201 })
  } catch (error) {
    reportarError('POST /api/finance/requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
