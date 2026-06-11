import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { closeGroup, type CloseResult } from '@/lib/supabase/queries/studies'

// POST: cierra el grupo. Body: { results: CloseResult[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { results } = (await req.json()) as { results: CloseResult[] }
    await closeGroup(id, results ?? [], auth.ctx.memberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/studies/groups/[id]/close:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
