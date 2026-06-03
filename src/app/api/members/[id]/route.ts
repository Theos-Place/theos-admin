import { NextRequest, NextResponse } from 'next/server'
import { getMemberFullById } from '@/lib/supabase/queries/members'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const member = await getMemberFullById(id)
    if (!member) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }
    return NextResponse.json(member)
  } catch (error) {
    console.error('GET /api/members/[id]:', error)
    const detail = error instanceof Error
      ? { message: error.message, ...(error as unknown as Record<string, unknown>) }
      : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
