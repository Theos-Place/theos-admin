import { NextRequest, NextResponse } from 'next/server'
import { getFormById } from '@/lib/supabase/queries/forms'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const form = await getFormById(id)
    if (!form) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    return NextResponse.json(form)
  } catch (error) {
    console.error('GET /api/forms/[id]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
