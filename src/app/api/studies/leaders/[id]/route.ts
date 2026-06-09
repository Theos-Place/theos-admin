import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { updateLeader, type LeaderWriteInput } from '@/lib/supabase/queries/studies'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await updateLeader(id, (await req.json()) as Partial<LeaderWriteInput>)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/studies/leaders/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
