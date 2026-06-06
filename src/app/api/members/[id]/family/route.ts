import { NextRequest, NextResponse } from 'next/server'
import { getMemberFamily } from '@/lib/supabase/queries/members'

// GET: otros integrantes de la familia del miembro (para check-in en familia).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    return NextResponse.json(await getMemberFamily(id))
  } catch (error) {
    console.error('GET /api/members/[id]/family:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
