import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { isStudyGroupsOnly } from '@/lib/auth/roles'
import { getStudyDemand } from '@/lib/supabase/queries/studies'
import { getCurrentBlock, getNextBlock, suggestedGroups } from '@/lib/studies/blocks'

// GET /api/studies/analysis?study_code=XX — demanda por zona de un estudio,
// con contexto del bloque actual y el siguiente (para el que se calcula).
// Información de planificación interna: solo módulo estudios más allá de
// 'own' (SEC-1: dirigente/miembro no ven la demanda global).
export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('estudios', { beyondOwn: true })
    if (auth.res) return auth.res
    // El rol acotado de grupos pasa el permiso de módulo (lo necesita para el
    // listado de grupos) pero la demanda es planificación: no es suya.
    if (isStudyGroupsOnly(auth.ctx.roles)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const code = req.nextUrl.searchParams.get('study_code')
    if (!code) return NextResponse.json({ error: 'Se requiere study_code' }, { status: 400 })

    const now = new Date()
    const demand = await getStudyDemand(code, now)
    const current = getCurrentBlock(now)
    const next = getNextBlock(now)
    const totalDemand = demand.totalGraduating + demand.totalEligible

    return NextResponse.json({
      ...demand,
      totalDemand,
      suggestedGroups: suggestedGroups(totalDemand),
      currentBlock: { block: current.block, label: current.label },
      nextBlock: {
        block: next.block,
        label: next.label,
        startsAt: next.startsAt.toISOString(),
        enrollmentOpens: next.enrollmentOpens.toISOString(),
      },
    })
  } catch (error) {
    console.error('GET /api/studies/analysis:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
