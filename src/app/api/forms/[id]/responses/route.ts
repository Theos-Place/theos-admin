import { NextRequest, NextResponse } from 'next/server'
import { getFormResponses, submitResponse } from '@/lib/supabase/queries/forms'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    return NextResponse.json(await getFormResponses(id))
  } catch (error) {
    console.error('GET /api/forms/[id]/responses:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

// POST: registra una respuesta. Body: { member_id?, guest_name?, guest_email?, answers }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const res = await submitResponse(id, body)
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    console.error('POST /api/forms/[id]/responses:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
