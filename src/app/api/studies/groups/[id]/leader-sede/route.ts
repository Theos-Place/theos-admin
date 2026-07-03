import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getLeaderSedeForGroup } from '@/lib/supabase/queries/folletos'

// GET: sede tomada del perfil del dirigente del grupo (para prellenar el paso de
// folletos en el cierre, editable por quien cierra).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    return NextResponse.json({ sede: await getLeaderSedeForGroup(id) })
  } catch (error) {
    console.error('GET /api/studies/groups/[id]/leader-sede:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
