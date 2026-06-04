import { NextRequest, NextResponse } from 'next/server'
import { getEmployeeDocSignedUrl } from '@/lib/supabase/queries/employees'

// GET: redirige a una URL firmada temporal del documento privado.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const url = await getEmployeeDocSignedUrl(id)
    if (!url) return NextResponse.json({ error: 'Documento sin archivo' }, { status: 404 })
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('GET /api/employees/documents/[id]/download:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
