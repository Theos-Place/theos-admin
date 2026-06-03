import { NextRequest, NextResponse } from 'next/server'
import { updateCommittee } from '@/lib/supabase/queries/servers'

// PUT: edita el comité (nombre, líder, capacidad ideal).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await updateCommittee(id, await req.json())
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/servers/committees/[id]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
