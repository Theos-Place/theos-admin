import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { updateCommittee } from '@/lib/supabase/queries/servers'

// PUT: edita el comité (nombre, líder, capacidad ideal).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await updateCommittee(id, await req.json())
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/servers/committees/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
