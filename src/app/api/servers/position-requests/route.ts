import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES, STAFF_IMPORT_ROLES } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPositionRequest, getPositionRequests, getManageableCommitteeIds, type PositionRequestInput } from '@/lib/supabase/queries/servers'

// GET: lista de solicitudes de puesto nuevo (default: pendientes). Solo Staff/admin.
export async function GET(req: NextRequest) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const status = req.nextUrl.searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null
    return NextResponse.json(await getPositionRequests(status ?? undefined))
  } catch (error) {
    console.error('GET /api/servers/position-requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: un coordinador solicita un puesto nuevo para un comité que gestiona (o un
// admin global, para cualquiera). Crea la solicitud 'pending' y notifica a Staff/admin.
export async function POST(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const input = (await req.json()) as PositionRequestInput
    if (!input?.committee_id || !input?.title?.trim()) {
      return NextResponse.json({ error: 'Comité y nombre del puesto son obligatorios.' }, { status: 400 })
    }
    // Permiso (puntos 1): solo admin + coordinación de staff (cualquier comité), o
    // coordinadores/líderes de comité (solo los comités que gestionan). Dirección
    // queda fuera salvo que lidere un comité.
    const isStaffGlobal = auth.ctx.roles.includes('admin') || auth.ctx.roles.some(r => STAFF_IMPORT_ROLES.includes(r))
    if (!isStaffGlobal) {
      const manageable = auth.ctx.memberId ? await getManageableCommitteeIds(auth.ctx.memberId) : []
      if (manageable.length === 0) {
        return NextResponse.json({ error: 'No tenés permiso para solicitar puestos nuevos.' }, { status: 403 })
      }
      if (!manageable.includes(input.committee_id)) {
        return NextResponse.json({ error: 'No podés solicitar puestos para este comité.' }, { status: 403 })
      }
    }
    const { id } = await createPositionRequest({ ...input, requested_by: auth.ctx.memberId })

    // Notificar a Staff/admin (notificaciones internas) — best-effort.
    try {
      const supabase = createAdminClient()
      const { data: committee } = await supabase.from('areas').select('name').eq('id', input.committee_id).maybeSingle()
      const { data: roleRows } = await supabase
        .from('member_roles').select('member_id')
        .in('role', ['encargado_staff', 'coordinador_servidores', 'direccion', 'admin'])
        .eq('is_active', true)
      const recipientIds = [...new Set(((roleRows ?? []) as Array<{ member_id: string }>).map(r => r.member_id))]
      if (recipientIds.length) {
        await supabase.from('internal_notifications').insert(recipientIds.map(rid => ({
          recipient_member_id: rid,
          type: 'position_request',
          title: 'Nueva solicitud de puesto',
          body: `${input.title.trim()} · ${(committee as { name?: string } | null)?.name ?? 'comité'}`,
          link: '/servidores/admin?solicitudes=1',
        })))
      }
    } catch (e) {
      console.warn('No se pudo notificar la solicitud de puesto:', e)
    }

    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/position-requests:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
