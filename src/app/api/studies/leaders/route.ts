import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getStudyLeaders, createLeader, type LeaderWriteInput } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
  const auth = await requireRoles()
  if (auth.res) return auth.res
    return NextResponse.json(await getStudyLeaders())
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
