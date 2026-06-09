import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { setApplicationStatus } from '@/lib/supabase/queries/servers'

// PUT: cambia el estado. Body: { status }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
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
