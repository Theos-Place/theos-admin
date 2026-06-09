import { NextRequest, NextResponse } from 'next/server'
import { saveGroupAttendance } from '@/lib/supabase/queries/studies'

// POST: registra la asistencia de una sesión.
// Body: { session_date, topic?, notes?, attendance: [{ member_id, present }] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    if (!body?.session_date || !Array.isArray(body?.attendance)) {
      return NextResponse.json({ error: 'Se requiere session_date y attendance[]' }, { status: 400 })
    }
    const res = await saveGroupAttendance(id, body)
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/groups/[id]/attendance:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
