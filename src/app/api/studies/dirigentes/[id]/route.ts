import { NextRequest, NextResponse } from 'next/server'
import { updateDirigenteConfig, setDirigenteActive, membersWithActiveGroups } from '@/lib/supabase/queries/studies'
import { requireRoles } from '@/lib/auth/guard'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles('admin', 'coordinador_dirigentes', 'coordinador_estudios')
    if (auth.res) return auth.res
    const { id } = await params // member_id
    const body = (await req.json()) as { qualified_study_codes?: string[]; zone_preference?: string[]; active?: boolean }
    // Toggle manual de estado (activo/inactivo). No se puede desactivar a quien
    // tiene un grupo en curso/abierto (punto 1).
    if (typeof body.active === 'boolean') {
      if (!body.active) {
        const blocked = await membersWithActiveGroups([id])
        if (blocked.has(id)) {
          return NextResponse.json({ error: 'has_active_groups' }, { status: 409 })
        }
      }
      await setDirigenteActive(id, body.active)
    }
    if (body.qualified_study_codes !== undefined || body.zone_preference !== undefined) {
      await updateDirigenteConfig(id, body)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/studies/dirigentes/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
