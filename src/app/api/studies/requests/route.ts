import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import {
  getStudyRequests, countOpenStudyRequests, createStudyRequest, notifyRecipientsOfRequest,
} from '@/lib/supabase/queries/study-requests'
import type { StudyRequestStatus, StudyRequestType } from '@/types/study'

const TYPES = new Set(['new_group', 'join_group', 'relocation'])
const STATUSES = new Set(['open', 'in_review', 'resolved', 'rejected'])

// GET: lista (solo coordinadores/admin). ?count=open devuelve solo el conteo.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes')
    if (auth.res) return auth.res

    const { searchParams } = req.nextUrl
    if (searchParams.get('count') === 'open') {
      return NextResponse.json({ count: await countOpenStudyRequests() })
    }
    const status = searchParams.get('status') ?? undefined
    const type = searchParams.get('type') ?? undefined
    const member_id = searchParams.get('member_id') ?? undefined
    const result = await getStudyRequests({
      status: status && STATUSES.has(status) ? (status as StudyRequestStatus) : undefined,
      type: type && TYPES.has(type) ? (type as StudyRequestType) : undefined,
      member_id,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/studies/requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: crea una solicitud. Cualquier usuario autenticado (incluso rol miembro).
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res

    const body = await req.json()
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    if (!body?.member_id || !TYPES.has(body?.request_type)) {
      return NextResponse.json({ error: 'Se requiere member_id y request_type válido' }, { status: 400 })
    }
    if (reason.length < 20) {
      return NextResponse.json({ error: 'La razón debe tener al menos 20 caracteres' }, { status: 400 })
    }

    const request = await createStudyRequest({
      member_id: body.member_id,
      request_type: body.request_type,
      plan_id: body.plan_id ?? null,
      existing_group_id: body.existing_group_id ?? null,
      current_group_id: body.current_group_id ?? null,
      proposed_location: body.proposed_location?.trim() || null,
      proposed_schedule: body.proposed_schedule?.trim() || null,
      reason,
    })

    // Notificaciones internas a los coordinadores configurados (best-effort:
    // si falla no bloquea la creación de la solicitud).
    try { await notifyRecipientsOfRequest(request) } catch (e) {
      console.warn('POST /api/studies/requests: notificaciones fallaron:', e)
    }

    return NextResponse.json(request, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
