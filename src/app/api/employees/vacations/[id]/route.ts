import { NextRequest, NextResponse } from 'next/server'
import { setVacationStatus } from '@/lib/supabase/queries/employees'

// PUT: aprueba/rechaza una solicitud. Body: { status }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { status } = await req.json()
    await setVacationStatus(id, status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/employees/vacations/[id]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
