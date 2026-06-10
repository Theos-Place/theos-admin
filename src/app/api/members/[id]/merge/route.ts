import { NextRequest, NextResponse } from 'next/server'
import { mergeMembers } from '@/lib/supabase/queries/members'
import { requireRoles } from '@/lib/auth/guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles('admin', 'editor_perfiles')
    if (auth.res) return auth.res
    const { id } = await params // miembro que se CONSERVA
    const body = (await req.json()) as { duplicate_id?: string; fields?: Record<string, unknown>; soft?: boolean }
    if (!body.duplicate_id) return NextResponse.json({ error: 'Falta duplicate_id' }, { status: 400 })
    if (body.duplicate_id === id) return NextResponse.json({ error: 'No se puede fusionar consigo mismo' }, { status: 400 })

    await mergeMembers(id, body.duplicate_id, { fields: body.fields, soft: body.soft })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/members/[id]/merge:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
