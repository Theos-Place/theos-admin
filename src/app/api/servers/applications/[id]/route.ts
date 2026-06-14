import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { setApplicationStatus, assignApplication } from '@/lib/supabase/queries/servers'

// PUT: cambia el estado. Body: { status }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('encargado_staff', 'coordinador_servidores', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { status } = await req.json()
    await setApplicationStatus(id, status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/servers/applications/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH: asigna responsable. Body: { action: 'assign'|'take'|'unassign', assignee_member_id? }
//  - assign: asigna al assignee_member_id (coordinador de servidores)
//  - take: se auto-asigna el usuario actual
//  - unassign: quita el responsable
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const body = await req.json()
    const action = body?.action as 'assign' | 'take' | 'unassign' | undefined
    const changedBy = auth.ctx.memberId

    let assignee: string | null
    if (action === 'take') assignee = changedBy
    else if (action === 'unassign') assignee = null
    else if (action === 'assign') {
      assignee = typeof body?.assignee_member_id === 'string' ? body.assignee_member_id : null
      if (!assignee) return NextResponse.json({ error: 'Falta assignee_member_id' }, { status: 400 })
    } else {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    await assignApplication(id, assignee, changedBy)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/servers/applications/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
