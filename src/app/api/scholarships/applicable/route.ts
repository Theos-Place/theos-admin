import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { findApplicableScholarship } from '@/lib/supabase/queries/scholarships'

// GET /api/scholarships/applicable?member_id=X&entity_type=study_plan|event&entity_id=Y
// Beca asignada activa del miembro para ese destino, si existe (para el
// selector "usar mi beca" en el paso de pago). El propio perfil se consulta
// sin permiso extra; otro miembro exige el módulo becas.
export async function GET(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { searchParams } = req.nextUrl
    const memberId = searchParams.get('member_id')
    const entityType = searchParams.get('entity_type')
    const entityId = searchParams.get('entity_id')
    if (!memberId || !isUuid(memberId)) return NextResponse.json({ error: 'Se requiere member_id válido' }, { status: 400 })
    if (entityType !== 'study_plan' && entityType !== 'event') return NextResponse.json({ error: 'entity_type inválido' }, { status: 400 })
    if (!entityId || !isUuid(entityId)) return NextResponse.json({ error: 'Se requiere entity_id válido' }, { status: 400 })

    if (memberId !== auth.ctx.memberId) {
      const becas = await requireModuleView('becas', { beyondOwn: true })
      if (becas.res) return becas.res
    }

    const scholarship = await findApplicableScholarship(memberId, entityType, entityId)
    return NextResponse.json({ scholarship })
  } catch (error) {
    console.error('GET /api/scholarships/applicable:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
