import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getTemplates, createTemplate } from '@/lib/supabase/queries/communications'
import { templateWriteSchema } from './schema'

export async function GET() {
  try {
    const auth = await requireModuleView('comunicaciones')
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
    const parsed = templateWriteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const t = await createTemplate(parsed.data)
    return NextResponse.json(t, { status: 201 })
  } catch (error) {
    console.error('POST /api/communications/templates:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
