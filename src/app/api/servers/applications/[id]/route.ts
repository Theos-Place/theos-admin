import { NextRequest, NextResponse } from 'next/server'
import { setApplicationStatus } from '@/lib/supabase/queries/servers'

// PUT: cambia el estado. Body: { status }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { status } = await req.json()
    await setApplicationStatus(id, status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/servers/applications/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
