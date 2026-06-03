import { NextRequest, NextResponse } from 'next/server'
import { getTemplates, createTemplate, type TemplateWriteInput } from '@/lib/supabase/queries/communications'

export async function GET() {
  try {
    return NextResponse.json(await getTemplates())
  } catch (error) {
    console.error('GET /api/communications/templates:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const t = await createTemplate((await req.json()) as TemplateWriteInput)
    return NextResponse.json(t, { status: 201 })
  } catch (error) {
    console.error('POST /api/communications/templates:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
