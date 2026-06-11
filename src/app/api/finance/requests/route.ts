import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, resolveTargetMemberId } from '@/lib/auth/guard'
import {
  getFinanceRequests, countOpenFinanceRequests, createFinanceRequest, notifyFinanceRolesOfRequest,
} from '@/lib/supabase/queries/finance-requests'
import type { FinanceRequestStatus, FinanceRequestType } from '@/types/finance'

const TYPES = new Set(['scholarship', 'refund'])
const STATUSES = new Set(['open', 'in_review', 'resolved', 'rejected'])

// GET: lista (solo finanzas/admin). ?count=open devuelve solo el conteo.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles('finanzas')
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl
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
    console.error('GET /api/finance/requests:', error)
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
    const memberId = resolveTargetMemberId(auth.ctx, body?.member_id, ['finanzas', 'direccion'])
    if (typeof body?.member_id === 'string' && body.member_id && body.member_id !== memberId) {
      return NextResponse.json(
        { error: 'No podés crear solicitudes a nombre de otro miembro' },
        { status: 403 },
      )
    }
    if (!memberId || !TYPES.has(body?.request_type)) {
      return NextResponse.json({ error: 'Se requiere member_id y request_type válido' }, { status: 400 })
    }
    if (reason.length < 20) {
      return NextResponse.json({ error: 'La razón debe tener al menos 20 caracteres' }, { status: 400 })
    }
    if (body.request_type === 'refund' && !body.payment_id) {
      return NextResponse.json({ error: 'Se requiere el pago a devolver' }, { status: 400 })
    }

    const request = await createFinanceRequest({
      member_id: memberId,
      request_type: body.request_type,
      study_group_id: body.study_group_id ?? null,
      payment_id: body.payment_id ?? null,
      amount: typeof body.amount === 'number' && body.amount > 0 ? body.amount : null,
      reason,
    })

    try { await notifyFinanceRolesOfRequest(request) } catch (e) {
      console.warn('POST /api/finance/requests: notificaciones fallaron:', e)
    }

    return NextResponse.json(request, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
