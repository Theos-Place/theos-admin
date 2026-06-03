import { NextRequest, NextResponse } from 'next/server'
import { verifyConfig } from '@/lib/supabase/queries/communications'

// POST: marca la config como verificada.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await verifyConfig(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/communications/configs/[id]/verify:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
