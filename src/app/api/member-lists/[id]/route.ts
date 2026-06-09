import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getMemberListById, updateMemberList, deleteMemberList } from '@/lib/supabase/queries/member-lists'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const list = await getMemberListById(id)
    if (!list) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })
    return NextResponse.json(list)
  } catch (error) {
    console.error('GET /api/member-lists/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRoles('comunicaciones', 'direccion', 'editor_perfiles')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await updateMemberList(id, await req.json())
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/member-lists/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireRoles('comunicaciones', 'direccion', 'editor_perfiles')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await deleteMemberList(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/member-lists/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
