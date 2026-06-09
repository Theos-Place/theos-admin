import { NextRequest, NextResponse } from 'next/server'
import { getGroupSessions } from '@/lib/supabase/queries/studies'

// GET: sesiones de asistencia de un grupo (con conteo de presentes).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    return NextResponse.json(await getGroupSessions(id))
  } catch (error) {
    console.error('GET /api/studies/groups/[id]/sessions:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
