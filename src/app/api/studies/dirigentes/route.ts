import { NextRequest, NextResponse } from 'next/server'
import { getActiveDirigentes, addDirigente } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
    return NextResponse.json(await getActiveDirigentes())
  } catch (error) {
    console.error('GET /api/studies/dirigentes:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { member_id?: string; active?: boolean }
    if (!body.member_id) return NextResponse.json({ error: 'Falta member_id' }, { status: 400 })
    await addDirigente(body.member_id, Boolean(body.active))
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/dirigentes:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
