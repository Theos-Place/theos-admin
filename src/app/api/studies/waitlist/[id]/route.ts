import { NextRequest, NextResponse } from 'next/server'
import { removeFromWaitlist, promoteFromWaitlist } from '@/lib/supabase/queries/studies'

// PUT: promueve la entrada a un grupo. Body: { group_id }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { group_id } = await req.json()
    await promoteFromWaitlist(id, group_id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT waitlist promote:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await removeFromWaitlist(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE waitlist:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
