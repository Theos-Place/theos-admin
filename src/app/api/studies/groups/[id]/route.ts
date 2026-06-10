import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { updateGroup, getGroupById, type GroupWriteInput } from '@/lib/supabase/queries/studies'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const auth = await requireRoles()
  if (auth.res) return auth.res
    const { id } = await params
    const group = await getGroupById(id)
    if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    return NextResponse.json(group)
  } catch (error) {
    console.error('GET /api/studies/groups/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const patch = (await req.json()) as Partial<GroupWriteInput>
    await updateGroup(id, patch)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/studies/groups/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
