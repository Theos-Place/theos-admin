import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getTemplates, createTemplate, type TemplateWriteInput } from '@/lib/supabase/queries/communications'

export async function GET() {
  try {
  const auth = await requireRoles()
  if (auth.res) return auth.res
    return NextResponse.json(await getTemplates())
  } catch (error) {
    console.error('GET /api/communications/templates:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('comunicaciones', 'direccion')
    if (auth.res) return auth.res
  try {
    const t = await createTemplate((await req.json()) as TemplateWriteInput)
    return NextResponse.json(t, { status: 201 })
  } catch (error) {
    console.error('POST /api/communications/templates:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
