import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getStudyDemand } from '@/lib/supabase/queries/studies'
import { getCurrentBlock, getNextBlock } from '@/lib/studies/blocks'

const GROUP_SIZE = 12

// GET /api/studies/analysis?study_code=XX — demanda por zona de un estudio,
// con contexto del bloque actual y el siguiente (para el que se calcula).
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
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
      suggestedGroups: Math.ceil(totalDemand / GROUP_SIZE),
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
