import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { removeFromWaitlist, promoteFromWaitlist } from '@/lib/supabase/queries/studies'

// PUT: promueve la entrada a un grupo. Body: { group_id }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { group_id } = await req.json()
    await promoteFromWaitlist(id, group_id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT waitlist promote:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await removeFromWaitlist(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE waitlist:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
