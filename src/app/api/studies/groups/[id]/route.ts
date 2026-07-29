import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { GROUP_ADMIN_ROLES } from '@/lib/auth/roles'
import { groupViewerScope } from '@/lib/auth/studies-scope'
import { updateGroup, getGroupById, deleteGroup, countActiveEnrollments, isMemberOfGroup } from '@/lib/supabase/queries/studies'
import { groupWriteSchema } from '../schema'
import { validateEnrollmentDates } from '@/lib/studies/enrollment-window'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    const group = await getGroupById(id)
    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    // SEC-1: el roster completo (nombres y notas de los inscritos) es solo para
    // quien tiene estudios más allá de 'own' o para el dirigente DE ESTE grupo.
    // Un miembro inscrito ve el grupo con SOLO su propia inscripción (vista
    // read-only); cualquier otra sesión (p. ej. la confirmación de matrícula)
    // recibe el grupo sin inscripciones — comportamiento histórico.
    const g = group as { leader_id: string | null; co_leader_id: string | null; enrollments?: Array<{ member_id: string }> }
    const scope = groupViewerScope({
      roles: auth.ctx.roles,
      memberId: auth.ctx.memberId,
      group: g,
      isEnrolled: auth.ctx.memberId ? await isMemberOfGroup(id, auth.ctx.memberId) : false,
    })
    if (scope === 'admin' || scope === 'leader') {
      return NextResponse.json({ ...group, viewer_scope: scope })
    }
    if (scope === 'member') {
      const own = (g.enrollments ?? []).filter(e => e.member_id === auth.ctx.memberId)
      return NextResponse.json({ ...group, enrollments: own, viewer_scope: 'member' })
    }
    return NextResponse.json({ ...group, enrollments: [], viewer_scope: 'none' })
  } catch (error) {
    console.error('GET /api/studies/groups/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles(...GROUP_ADMIN_ROLES)
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = groupWriteSchema.partial().safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    // GRU-1: la coherencia de la ventana se valida sobre el grupo RESULTANTE
    // (patch parcial mergeado con lo guardado).
    if ('enrollment_start_date' in parsed.data || 'enrollment_end_date' in parsed.data || 'starts_at' in parsed.data) {
      const current = await getGroupById(id)
      const merged = {
        enrollment_start_date: parsed.data.enrollment_start_date !== undefined ? parsed.data.enrollment_start_date : current?.enrollment_start_date,
        enrollment_end_date: parsed.data.enrollment_end_date !== undefined ? parsed.data.enrollment_end_date : current?.enrollment_end_date,
        starts_at: parsed.data.starts_at !== undefined ? parsed.data.starts_at : current?.starts_at,
      }
      const dateError = validateEnrollmentDates(merged)
      if (dateError) return NextResponse.json({ error: dateError, code: 'fechas_matricula' }, { status: 400 })
    }
    await updateGroup(id, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'DIRIGENTE_NO_RECOMENDADO') {
      return NextResponse.json(
        { error: 'El dirigente o co-dirigente elegido está marcado como no recomendado para dar estudios.' },
        { status: 400 },
      )
    }
    console.error('PUT /api/studies/groups/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: elimina un grupo. Regla global de borrado: si tiene personas activas
// (matriculadas / en espera / con pago pendiente) NO se borra (409); la UI
// muestra el ActiveWarningModal. Sin activos, la UI pide confirmación por
// palabra clave (DeleteConfirmModal) antes de llamar acá.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...GROUP_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const group = await getGroupById(id)
    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    const active = await countActiveEnrollments(id)
    if (active > 0) {
      return NextResponse.json(
        { error: `El grupo tiene ${active} persona${active !== 1 ? 's' : ''} activa${active !== 1 ? 's' : ''}. Reubicá o dá de baja a esas personas antes de eliminarlo.`, code: 'activos', active_count: active },
        { status: 409 },
      )
    }
    await deleteGroup(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/studies/groups/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
