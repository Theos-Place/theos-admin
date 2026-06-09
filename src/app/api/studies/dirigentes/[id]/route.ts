import { NextRequest, NextResponse } from 'next/server'
import { updateDirigenteConfig } from '@/lib/supabase/queries/studies'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params // member_id
    const body = (await req.json()) as { qualified_study_codes?: string[]; zone_preference?: string[] }
    await updateDirigenteConfig(id, body)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/studies/dirigentes/[id]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
