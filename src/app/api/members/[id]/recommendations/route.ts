import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { getMemberRecommendations, dirigenteLeadsMember } from '@/lib/supabase/queries/studies'

// GET: recomendaciones del miembro (cierres de estudio).
//  · Roles administrativos (admin/coord_estudios/coord_dirigentes/direccion) → todas.
//  · dirigente (sin rol admin) → SOLO si el miembro es/fue estudiante de uno de
//    sus grupos; si no, devuelve vacío (no expone recomendaciones ajenas).
//  · El rol miembro nunca llega acá (requireRoles lo bloquea).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'dirigente', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const isStudyAdmin = auth.ctx.roles.some(r => (STUDY_ADMIN_ROLES as string[]).includes(r))
    if (!isStudyAdmin) {
      // dirigente pelado: solo recomendaciones de miembros de sus grupos.
      const dirId = auth.ctx.memberId
      const allowed = !!dirId && (await dirigenteLeadsMember(dirId, id))
      if (!allowed) return NextResponse.json([])
    }
    return NextResponse.json(await getMemberRecommendations(id))
  } catch (error) {
    console.error('GET /api/members/[id]/recommendations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
