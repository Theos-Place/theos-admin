import { NextRequest, NextResponse } from 'next/server'
import { getRelocations, createRelocation } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
    return NextResponse.json(await getRelocations())
  } catch (error) {
    console.error('GET /api/studies/relocations:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await createRelocation(await req.json())
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/relocations:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
