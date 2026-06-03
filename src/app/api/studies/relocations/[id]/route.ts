import { NextRequest, NextResponse } from 'next/server'
import { resolveRelocation } from '@/lib/supabase/queries/studies'

// PUT: marca la solicitud como resuelta.
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await resolveRelocation(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT relocations resolve:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
