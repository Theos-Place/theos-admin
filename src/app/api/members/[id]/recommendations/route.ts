import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getMemberRecommendations } from '@/lib/supabase/queries/studies'

// GET: recomendaciones del miembro (cierres de estudio). Solo roles de
// estudios y administración — el rol miembro NO las ve (admin pasa siempre).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'dirigente', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    return NextResponse.json(await getMemberRecommendations(id))
  } catch (error) {
    console.error('GET /api/members/[id]/recommendations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
