import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getStudyLeaders, createLeader, type LeaderWriteInput } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const leaders = await getStudyLeaders()
    // Evaluaciones (puntajes/comentarios) e is_donor solo para el módulo
    // estudios; el resto de sesiones (el hook useStudies se usa en pantallas
    // de otros módulos) recibe la lista sin los campos sensibles.
    const mod = await requireModuleView('estudios')
    if (!mod.res) return NextResponse.json(leaders)
    return NextResponse.json(leaders.map(l => ({
      ...l,
      member: l.member ? { ...l.member, is_donor: false } : l.member,
      evaluations: [],
    })))
  } catch (error) {
    console.error('GET /api/studies/leaders:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const leader = await createLeader((await req.json()) as LeaderWriteInput)
    return NextResponse.json(leader, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/leaders:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
