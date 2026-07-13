import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getGroupSessions } from '@/lib/supabase/queries/studies'

// GET: sesiones de asistencia de un grupo (con conteo de presentes).
// Solo módulo estudios: es información de gestión del grupo.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireModuleView('estudios')
    if (auth.res) return auth.res
    const { id } = await params
    return NextResponse.json(await getGroupSessions(id))
  } catch (error) {
    console.error('GET /api/studies/groups/[id]/sessions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
