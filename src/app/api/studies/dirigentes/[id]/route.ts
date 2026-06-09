import { NextRequest, NextResponse } from 'next/server'
import { updateDirigenteConfig } from '@/lib/supabase/queries/studies'
import { requireRoles } from '@/lib/auth/guard'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles('admin', 'coordinador_dirigentes')
    if (auth.res) return auth.res
    const { id } = await params // member_id
    const body = (await req.json()) as { qualified_study_codes?: string[]; zone_preference?: string[] }
    await updateDirigenteConfig(id, body)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/studies/dirigentes/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
