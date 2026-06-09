import { NextRequest, NextResponse } from 'next/server'
import { getDuplicatePairs, dismissDuplicatePair } from '@/lib/supabase/queries/members'

export async function GET() {
  try {
    return NextResponse.json(await getDuplicatePairs())
  } catch (error) {
    console.error('GET /api/members/duplicates:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { a?: string; b?: string }
    if (!body.a || !body.b) return NextResponse.json({ error: 'Faltan ids' }, { status: 400 })
    await dismissDuplicatePair(body.a, body.b)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/members/duplicates:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
